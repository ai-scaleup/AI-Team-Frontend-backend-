import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import type { AgentName } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { agentNamesToConversationAgentIds } from 'src/common/agent-slug';
import {
  CreateMembershipDto,
  UpdateMembershipDto,
} from './dto/membership.dto';

/**
 * Every read of a template carries its live teams, so callers can render the
 * bundled teams (and the agents inside them) without a second round trip.
 * Deactivated links are left out: they exist only to preserve history.
 */
const TEMPLATE_INCLUDE = {
  includedGroups: {
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      groupId: true,
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          singleConversationTokenLimit: true,
          items: { select: { agentName: true } },
        },
      },
    },
  },
} satisfies Prisma.MembershipTemplateInclude;

/**
 * The admin UI renders a template's team chips from a flat id list, so every
 * template goes out with includedGroupIds alongside the richer includedGroups.
 * Callers that only need the ids never have to walk the link objects.
 */
const withGroupIds = <T extends { includedGroups: { groupId: string }[] }>(
  template: T,
) => ({
  ...template,
  includedGroupIds: template.includedGroups.map((link) => link.groupId),
});

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deduplicate the requested team ids and confirm each one exists, so a typo
   * fails the request instead of silently producing a membership that grants
   * nothing.
   */
  private async resolveGroupIds(groupIds?: string[]): Promise<string[]> {
    if (!groupIds?.length) return [];

    const unique = Array.from(
      new Set(groupIds.map((id) => id?.trim()).filter(Boolean) as string[]),
    );
    if (unique.length === 0) return [];

    const found = await this.prisma.agentGroup.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });

    if (found.length !== unique.length) {
      const known = new Set(found.map((g) => g.id));
      const missing = unique.filter((id) => !known.has(id));
      throw new NotFoundException(`AgentGroup not found: ${missing.join(', ')}`);
    }

    return unique;
  }

  /**
   * Bring a template's team links in line with groupIds.
   *
   * Links that drop out are deactivated, never deleted — the row stays so the
   * template keeps its history, and re-adding the same team reuses that row
   * rather than piling up duplicates (the template+group pair is unique).
   */
  private async syncTemplateGroups(
    tx: Prisma.TransactionClient,
    membershipTemplateId: string,
    groupIds: string[],
  ): Promise<void> {
    const keep = new Set(groupIds);

    for (const groupId of groupIds) {
      await tx.membershipTemplateGroup.upsert({
        where: {
          membershipTemplateId_groupId: { membershipTemplateId, groupId },
        },
        create: { membershipTemplateId, groupId, isActive: true },
        update: { isActive: true },
      });
    }

    const live = await tx.membershipTemplateGroup.findMany({
      where: { membershipTemplateId, isActive: true },
      select: { id: true, groupId: true },
    });

    const toDeactivate = live
      .filter((link) => !keep.has(link.groupId))
      .map((link) => link.id);

    if (toDeactivate.length) {
      await tx.membershipTemplateGroup.updateMany({
        where: { id: { in: toDeactivate } },
        data: { isActive: false },
      });
    }
  }

  async createMembership(data: CreateMembershipDto) {
    const groupIds = await this.resolveGroupIds(data.includedGroupIds);

    const created = await this.prisma.membershipTemplate.create({
      data: {
        name: data.name,
        durationDays: data.durationDays,
        monthlyTokenLimit: data.monthlyTokenLimit,
        includedAgents: data.includedAgents || [],
        ...(groupIds.length
          ? { includedGroups: { create: groupIds.map((groupId) => ({ groupId })) } }
          : {}),
      },
      include: TEMPLATE_INCLUDE,
    });

    return withGroupIds(created);
  }

  async listMemberships() {
    const templates = await this.prisma.membershipTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: TEMPLATE_INCLUDE,
    });

    return templates.map(withGroupIds);
  }

  async getMembership(id: string) {
    const membership = await this.prisma.membershipTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });

    if (!membership) throw new NotFoundException('Membership not found');

    return withGroupIds(membership);
  }

  async updateMembership(id: string, data: UpdateMembershipDto) {
    await this.getMembership(id);

    // Resolved before the transaction opens, so an unknown team id fails the
    // request without having written anything.
    const groupIds =
      data.includedGroupIds === undefined
        ? undefined
        : await this.resolveGroupIds(data.includedGroupIds);

    return this.prisma.$transaction(async (tx) => {
      await tx.membershipTemplate.update({
        where: { id },
        data: {
          name: data.name,
          durationDays: data.durationDays,
          monthlyTokenLimit: data.monthlyTokenLimit,
          includedAgents: data.includedAgents,
        },
      });

      if (groupIds !== undefined) {
        await this.syncTemplateGroups(tx, id, groupIds);
      }

      const updated = await tx.membershipTemplate.findUniqueOrThrow({
        where: { id },
        include: TEMPLATE_INCLUDE,
      });

      return withGroupIds(updated);
    });
  }

  async deleteMembership(id: string) {
    await this.getMembership(id);

    const [, deletedMembership] = await this.prisma.$transaction([
      this.prisma.assignedMembership.deleteMany({
        where: { membershipTemplateId: id },
      }),
      this.prisma.membershipTemplate.delete({
        where: { id },
      }),
    ]);

    return deletedMembership;
  }

  /* ------------------- teams granted through a membership ------------------ */

  /**
   * Give the user the teams a membership bundles, on the membership's clock.
   *
   * Both an AssignedGroup and the per-agent AssignedAgent rows are written,
   * because access is read off AssignedAgent while a team's per-conversation
   * allowance is read off AssignedGroup — writing only one of the two would
   * grant tokens the user cannot spend, or agents with no team allowance
   * behind them.
   *
   * Everything here is a create or an update on the active row; no assignment
   * the user already holds is removed.
   */
  private async grantTemplateGroups(
    userId: string,
    groupIds: string[],
    expiresAt: Date,
    durationDays: number,
  ): Promise<void> {
    for (const groupId of groupIds) {
      const group = await this.prisma.agentGroup.findUnique({
        where: { id: groupId },
        select: {
          singleConversationTokenLimit: true,
          items: { select: { agentName: true } },
        },
      });
      if (!group) continue;

      const existingGroup = await this.prisma.assignedGroup.findFirst({
        where: { userId, groupId, isActive: true },
        select: { id: true, expiresAt: true },
      });

      if (existingGroup) {
        // An assignment the user already holds is only ever extended: a
        // membership must not cut short a team an admin granted for longer,
        // and an open-ended grant (null expiry) stays open-ended.
        const keepsLonger =
          existingGroup.expiresAt === null || existingGroup.expiresAt > expiresAt;
        if (!keepsLonger) {
          await this.prisma.assignedGroup.update({
            where: { id: existingGroup.id },
            data: { expiresAt, durationDays },
          });
        }
      } else {
        await this.prisma.assignedGroup.create({
          data: { userId, groupId, expiresAt, durationDays, isActive: true },
        });
      }

      for (const { agentName } of group.items) {
        const existingAgent = await this.prisma.assignedAgent.findFirst({
          where: { userId, agentName, isActive: true },
          select: { id: true, expiresAt: true },
        });

        if (existingAgent) {
          const keepsLonger =
            existingAgent.expiresAt === null ||
            existingAgent.expiresAt > expiresAt;
          if (!keepsLonger) {
            await this.prisma.assignedAgent.update({
              where: { id: existingAgent.id },
              data: { expiresAt, durationDays },
            });
          }
        } else {
          await this.prisma.assignedAgent.create({
            data: { userId, agentName, expiresAt, durationDays, isActive: true },
          });
        }
      }

      await this.applyGroupTokenLimitToUserConversations(userId, group);
    }
  }

  /**
   * Hand the team's per-conversation allowance to the chats the user already
   * holds with its agents, the way a direct team assignment does. New chats
   * pick it up on their own via ConversationService.resolveTeamTokenLimit.
   *
   * A limit of 0 is the column default and means "no team allowance
   * configured", so it is left alone rather than freezing every chat.
   */
  private async applyGroupTokenLimitToUserConversations(
    userId: string,
    group: {
      singleConversationTokenLimit: number;
      items: { agentName: AgentName }[];
    },
  ): Promise<void> {
    if (group.singleConversationTokenLimit <= 0) return;

    const agentIds = agentNamesToConversationAgentIds(
      group.items.map((i) => i.agentName),
    );
    if (agentIds.length === 0) return;

    const limit = group.singleConversationTokenLimit;
    await this.prisma.$executeRaw`
      UPDATE "Conversation"
      SET "tokenLimit" = ${limit},
          "tokenLeft" = GREATEST(${limit} - COALESCE("tokenUsed", 0), 0)
      WHERE "userId" = ${userId}
        AND "agentId" IN (${Prisma.join(agentIds)})`;
  }

  async assignMembership(
    userId: string,
    membershipTemplateId: string,
    durationOverride?: number,
    monthlyTokenLimitOverride?: number,
  ) {
    const template = await this.prisma.membershipTemplate.findUnique({
      where: { id: membershipTemplateId },
      include: {
        includedGroups: {
          where: { isActive: true },
          select: { groupId: true },
        },
      },
    });
    if (!template) throw new NotFoundException('Template not found');

    const durationDays = durationOverride ?? template.durationDays;
    const monthlyTokenLimit =
      monthlyTokenLimitOverride ?? template.monthlyTokenLimit;
    const msPerDay = 1000 * 60 * 60 * 24;
    const expiresAt = new Date(Date.now() + durationDays * msPerDay);

    const assignment = await this.prisma.assignedMembership.create({
      data: {
        userId,
        membershipTemplateId,
        expiresAt,
        isActive: true,
        monthlyTokenLimit,
      },
    });

    // The membership row on its own grants tokens but no agents — access is
    // read off AssignedAgent. Materializing the bundled teams is what makes a
    // membership's agents actually reachable for the user.
    const groupIds = template.includedGroups.map((link) => link.groupId);
    if (groupIds.length) {
      await this.grantTemplateGroups(userId, groupIds, expiresAt, durationDays);
    }

    return assignment;
  }
}
