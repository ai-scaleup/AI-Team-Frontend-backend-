import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentName, Prisma } from 'src/generated/prisma/client';
import {
  normalizeAgents,
  normalizeIds,
  normalizeTokenLimit,
} from 'src/membership/membership.service';
import { PrismaService } from 'src/prisma/prisma.service';

export class CreateAgencyMembershipDto {
  name!: string;
  /** Single agents bundled into the membership. */
  includedAgents?: AgentName[];
  /** Agent teams bundled into the membership, by AgentTeam id. */
  includedTeamIds?: string[];
  /** Tokens each seat gets per 30-day cycle. */
  monthlyTokenLimit!: number;
}

/** Every field is optional; the ones left out stay as they are. */
export type UpdateAgencyMembershipDto = Partial<CreateAgencyMembershipDto>;

const agencyMembershipInclude = {
  includedTeams: {
    orderBy: { createdAt: 'asc' },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          isActive: true,
          agents: { select: { agentName: true } },
        },
      },
    },
  },
} satisfies Prisma.AgencyMembershipInclude;

type AgencyMembershipRow = Prisma.AgencyMembershipGetPayload<{
  include: typeof agencyMembershipInclude;
}>;

export type AgencyMembershipView = {
  id: string;
  name: string;
  includedAgents: AgentName[];
  includedTeams: {
    id: string;
    name: string;
    isActive: boolean;
    agents: AgentName[];
  }[];
  monthlyTokenLimit: number;
  createdAt: Date;
  updatedAt: Date;
};

function toView(row: AgencyMembershipRow): AgencyMembershipView {
  return {
    id: row.id,
    name: row.name,
    includedAgents: row.includedAgents,
    includedTeams: row.includedTeams.map(({ team }) => ({
      id: team.id,
      name: team.name,
      isActive: team.isActive,
      agents: team.agents.map((a) => a.agentName),
    })),
    monthlyTokenLimit: row.monthlyTokenLimit,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Agency memberships: the plans agencies buy seat pools of. Only ever
 * created and archived — never deleted — so this service has no delete.
 */
@Injectable()
export class AgencyMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  /** Names are unique among memberships that are not archived. */
  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.prisma.agencyMembership.findFirst({
      where: {
        archivedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash)
      throw new ConflictException(
        `An agency membership named "${name}" already exists`,
      );
  }

  private async assertTeamsExist(teamIds: string[]) {
    if (!teamIds.length) return;
    const found = await this.prisma.agentTeam.findMany({
      where: { id: { in: teamIds } },
      select: { id: true },
    });
    const known = new Set(found.map((t) => t.id));
    const missing = teamIds.filter((id) => !known.has(id));
    if (missing.length)
      throw new NotFoundException(`Team(s) not found: ${missing.join(', ')}`);
  }

  async list(): Promise<AgencyMembershipView[]> {
    const rows = await this.prisma.agencyMembership.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: 'asc' },
      include: agencyMembershipInclude,
    });
    return rows.map(toView);
  }

  async create(data: CreateAgencyMembershipDto): Promise<AgencyMembershipView> {
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) throw new BadRequestException('name is required');
    const includedAgents = normalizeAgents(data.includedAgents);
    const includedTeamIds = normalizeIds(
      data.includedTeamIds,
      'includedTeamIds',
    );
    if (!includedAgents.length && !includedTeamIds.length)
      throw new BadRequestException('Pick at least one agent or team');
    const monthlyTokenLimit = normalizeTokenLimit(data.monthlyTokenLimit);
    if (monthlyTokenLimit < 1)
      throw new BadRequestException('monthlyTokenLimit must be at least 1');

    await this.assertTeamsExist(includedTeamIds);
    await this.assertNameFree(name);

    const row = await this.prisma.agencyMembership.create({
      data: {
        name,
        includedAgents,
        monthlyTokenLimit,
        ...(includedTeamIds.length
          ? {
              includedTeams: {
                create: includedTeamIds.map((teamId) => ({ teamId })),
              },
            }
          : {}),
      },
      include: agencyMembershipInclude,
    });
    return toView(row);
  }

  async update(
    id: string,
    data: UpdateAgencyMembershipDto,
  ): Promise<AgencyMembershipView> {
    const current = await this.prisma.agencyMembership.findUnique({
      where: { id },
      include: { includedTeams: { select: { teamId: true } } },
    });
    if (!current || current.archivedAt)
      throw new NotFoundException('Agency membership not found');

    let name: string | undefined;
    if (data?.name !== undefined) {
      name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name) throw new BadRequestException('name cannot be empty');
    }
    const includedAgents =
      data?.includedAgents === undefined
        ? undefined
        : normalizeAgents(data.includedAgents);
    const includedTeamIds =
      data?.includedTeamIds === undefined
        ? undefined
        : normalizeIds(data.includedTeamIds, 'includedTeamIds');
    let monthlyTokenLimit: number | undefined;
    if (data?.monthlyTokenLimit !== undefined) {
      monthlyTokenLimit = normalizeTokenLimit(data.monthlyTokenLimit);
      if (monthlyTokenLimit < 1)
        throw new BadRequestException('monthlyTokenLimit must be at least 1');
    }

    const agentCount = (includedAgents ?? current.includedAgents).length;
    const teamCount = (
      includedTeamIds ?? current.includedTeams.map((t) => t.teamId)
    ).length;
    if (!agentCount && !teamCount)
      throw new BadRequestException('Pick at least one agent or team');

    if (includedTeamIds) await this.assertTeamsExist(includedTeamIds);
    if (name) await this.assertNameFree(name, id);

    const row = await this.prisma.$transaction(async (tx) => {
      if (includedTeamIds) {
        // Replace the team list: drop links not in the new list, add the
        // rest. Only link rows change; the membership row is updated in place.
        await tx.agencyMembershipTeam.deleteMany({
          where: { agencyMembershipId: id, teamId: { notIn: includedTeamIds } },
        });
        for (const teamId of includedTeamIds) {
          await tx.agencyMembershipTeam.upsert({
            where: {
              agencyMembershipId_teamId: { agencyMembershipId: id, teamId },
            },
            create: { agencyMembershipId: id, teamId },
            update: {},
          });
        }
      }
      return tx.agencyMembership.update({
        where: { id },
        data: { name, includedAgents, monthlyTokenLimit },
        include: agencyMembershipInclude,
      });
    });
    return toView(row);
  }

  /** Hides the membership from the list; the row itself is kept. */
  async archive(id: string): Promise<{ id: string; archivedAt: Date }> {
    const row = await this.prisma.agencyMembership.findUnique({
      where: { id },
      select: { id: true, archivedAt: true },
    });
    if (!row || row.archivedAt)
      throw new NotFoundException('Agency membership not found');
    const updated = await this.prisma.agencyMembership.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: { id: true, archivedAt: true },
    });
    return { id: updated.id, archivedAt: updated.archivedAt! };
  }
}
