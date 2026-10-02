import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentName, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokenUsageService } from 'src/token-usage/services/token-usage.service';
import {
  CreateMembershipDto,
  RecordMembershipTokenUsageByEmailDto,
  RecordMembershipTokenUsageDto,
  UpdateMembershipAssignmentDto,
  UpdateMembershipDto,
} from './dto/membership.dto';
import {
  MembershipPoolFigures,
  membershipCoversAgent,
  membershipPoolLimit,
  membershipPoolTemplateSelect,
  refreshMembershipPool,
  withComputedPools,
} from './assigned-membership.helpers';

/**
 * Every read of a template carries its linked agent teams so the response can
 * show single agents and teams side by side. AgentTeam is only read here.
 */
export const membershipTemplateInclude = {
  includedTeams: {
    orderBy: { createdAt: 'asc' },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          agents: { select: { agentName: true } },
        },
      },
    },
  },
} satisfies Prisma.MembershipTemplateInclude;

type TemplateRow = Prisma.MembershipTemplateGetPayload<{
  include: typeof membershipTemplateInclude;
}>;

/** Minimal team shape shared by the raw include and the flattened view. */
type TemplateTeamLink = {
  team: { agents: { agentName: AgentName }[]; isActive: boolean };
};

export type MembershipTeamSummary = {
  id: string;
  name: string;
  description: string;
  agents: AgentName[];
  isActive: boolean;
};

/** Flattened shape returned by every template endpoint. */
export type MembershipTemplateView = {
  id: string;
  name: string;
  durationDays: number;
  monthlyTokenLimit: number;
  /** Single agents bundled directly into the membership. */
  includedAgents: AgentName[];
  /** Agent teams bundled into the membership. */
  includedTeams: MembershipTeamSummary[];
  includedTeamIds: string[];
  /** Union of single agents and every active team's agents. */
  effectiveAgents: AgentName[];
  createdAt: Date;
  updatedAt: Date;
};

/** Agents a template grants: its single agents plus its active teams' agents. */
export function resolveTemplateAgents(template: {
  includedAgents: AgentName[];
  includedTeams?: TemplateTeamLink[];
}): AgentName[] {
  const out = new Set<AgentName>(template.includedAgents);
  for (const link of template.includedTeams ?? []) {
    if (!link.team.isActive) continue;
    for (const a of link.team.agents) out.add(a.agentName);
  }
  return [...out];
}

/** Dedupes and validates an agent list; rejects unknown agent names. */
export function normalizeAgents(agents: unknown): AgentName[] {
  if (agents === undefined || agents === null) return [];
  if (!Array.isArray(agents))
    throw new BadRequestException('agents must be an array of agent names');
  const valid = new Set<string>(Object.values(AgentName));
  const out: AgentName[] = [];
  for (const a of agents) {
    if (typeof a !== 'string' || !valid.has(a))
      throw new BadRequestException(`Unknown agent name: ${String(a)}`);
    if (!out.includes(a as AgentName)) out.push(a as AgentName);
  }
  return out;
}

function normalizeIds(ids: unknown, label: string): string[] {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids))
    throw new BadRequestException(`${label} must be an array of ids`);
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !id.trim())
      throw new BadRequestException(`${label} contains an invalid id`);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Allowances are whole, non-negative token counts. */
function normalizeTokenLimit(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0)
    throw new BadRequestException(
      'monthlyTokenLimit must be a non-negative integer',
    );
  return n;
}

/** A usage delta: any integer, negative for a refund or correction. */
function toSignedInt(value: unknown, label: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n))
    throw new BadRequestException(`${label} must be an integer`);
  return n;
}

/**
 * Every read of a grant carries the user it belongs to and the template
 * fields the shared pool needs (allowance and reachable agents).
 */
export const assignmentInclude = {
  user: { select: { id: true, email: true, oauthId: true, username: true } },
  template: { select: membershipPoolTemplateSelect },
} satisfies Prisma.AssignedMembershipInclude;

type AssignmentRow = Prisma.AssignedMembershipGetPayload<{
  include: typeof assignmentInclude;
}>;

/** A grant as every assignment endpoint returns it. */
export type MembershipAssignmentView = {
  id: string;
  userId: string;
  membershipTemplateId: string;
  user: AssignmentRow['user'];
  template: {
    id: string;
    name: string;
    monthlyTokenLimit: number;
    includedAgents: AgentName[];
  };
  /** Every agent the grant reaches; all of them draw on the one pool. */
  agents: AgentName[];
  startsAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  /** The SHARED allowance per 30-day cycle (override, else the template's). */
  monthlyTokenLimit: number;
  /** Start of the cycle the counters below belong to. */
  cycleStartsAt: Date;
  /** Combined spend of every agent this cycle. */
  usedTokens: number;
  inputTokens: number;
  outputTokens: number;
  tokensLeft: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Flattens a grant row with its pool figures. The figures come from the
 * ledger (see assigned-membership.helpers.ts), never from the row's own
 * cached columns, so a read is right even if no write has refreshed them.
 */
export function toAssignmentView(
  row: AssignmentRow & MembershipPoolFigures,
): MembershipAssignmentView {
  const current = row;
  return {
    id: row.id,
    userId: row.userId,
    membershipTemplateId: row.membershipTemplateId,
    user: row.user,
    template: {
      id: row.template.id,
      name: row.template.name,
      monthlyTokenLimit: row.template.monthlyTokenLimit,
      includedAgents: row.template.includedAgents,
    },
    agents: resolveTemplateAgents(row.template),
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    monthlyTokenLimit: membershipPoolLimit(row),
    cycleStartsAt: current.cycleStartsAt,
    usedTokens: current.usedTokens,
    inputTokens: current.inputTokens,
    outputTokens: current.outputTokens,
    tokensLeft: current.tokensLeft,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toView(row: TemplateRow): MembershipTemplateView {
  const includedTeams = row.includedTeams.map(({ team }) => ({
    id: team.id,
    name: team.name,
    description: team.description,
    agents: team.agents.map((a) => a.agentName),
    isActive: team.isActive,
  }));
  return {
    id: row.id,
    name: row.name,
    durationDays: row.durationDays,
    monthlyTokenLimit: row.monthlyTokenLimit,
    includedAgents: row.includedAgents,
    includedTeams,
    includedTeamIds: includedTeams.map((t) => t.id),
    effectiveAgents: resolveTemplateAgents(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Membership tier. A template carries two separate bundles — single agents
 * (includedAgents) and agent teams (MembershipTemplateTeam -> AgentTeam) —
 * and an AssignedMembership row is the whole grant. This tier only reads
 * AgentTeam; it never writes SingleAssignedAgent, AgentTeam or AssignedTeam.
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    // Owns the usage ledger the admin dashboard reads; spend recorded on a
    // membership pool is mirrored there so the two never disagree.
    private readonly tokenUsage: TokenUsageService,
  ) {}

  /* ------------------------------- helpers ------------------------------- */

  private async getRowOrThrow(id: string): Promise<TemplateRow> {
    const membership = await this.prisma.membershipTemplate.findUnique({
      where: { id },
      include: membershipTemplateInclude,
    });
    if (!membership) throw new NotFoundException('Membership not found');
    return membership;
  }

  /** Every id must point at an existing AgentTeam. */
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

  /* ------------------------------ templates ------------------------------ */

  async createMembership(data: CreateMembershipDto) {
    const includedTeamIds = normalizeIds(
      data.includedTeamIds,
      'includedTeamIds',
    );
    await this.assertTeamsExist(includedTeamIds);

    const row = await this.prisma.membershipTemplate.create({
      data: {
        name: data.name,
        durationDays: data.durationDays,
        monthlyTokenLimit: data.monthlyTokenLimit,
        includedAgents: normalizeAgents(data.includedAgents),
        ...(includedTeamIds.length
          ? {
              includedTeams: {
                create: includedTeamIds.map((teamId) => ({ teamId })),
              },
            }
          : {}),
      },
      include: membershipTemplateInclude,
    });
    return toView(row);
  }

  async listMemberships() {
    const rows = await this.prisma.membershipTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: membershipTemplateInclude,
    });
    return rows.map(toView);
  }

  async getMembership(id: string) {
    return toView(await this.getRowOrThrow(id));
  }

  async updateMembership(id: string, data: UpdateMembershipDto) {
    await this.getRowOrThrow(id);

    const includedTeamIds =
      data.includedTeamIds === undefined
        ? undefined
        : normalizeIds(data.includedTeamIds, 'includedTeamIds');
    if (includedTeamIds) await this.assertTeamsExist(includedTeamIds);

    const row = await this.prisma.$transaction(async (tx) => {
      if (includedTeamIds) {
        // Replace the team list: drop links not in the new list, add the rest.
        await tx.membershipTemplateTeam.deleteMany({
          where: {
            membershipTemplateId: id,
            teamId: { notIn: includedTeamIds },
          },
        });
        for (const teamId of includedTeamIds) {
          await tx.membershipTemplateTeam.upsert({
            where: {
              membershipTemplateId_teamId: {
                membershipTemplateId: id,
                teamId,
              },
            },
            create: { membershipTemplateId: id, teamId },
            update: {},
          });
        }
      }

      return tx.membershipTemplate.update({
        where: { id },
        data: {
          name: data.name,
          durationDays: data.durationDays,
          monthlyTokenLimit: data.monthlyTokenLimit,
          includedAgents:
            data.includedAgents === undefined
              ? undefined
              : normalizeAgents(data.includedAgents),
        },
        include: membershipTemplateInclude,
      });
    });
    return toView(row);
  }

  async deleteMembership(id: string) {
    const row = await this.getRowOrThrow(id);

    await this.prisma.$transaction([
      this.prisma.assignedMembership.deleteMany({
        where: { membershipTemplateId: id },
      }),
      this.prisma.membershipTemplate.delete({
        where: { id },
      }),
    ]);

    return toView(row);
  }

  /* --------------------------- single agents ---------------------------- */

  async addAgents(id: string, agents: unknown) {
    const row = await this.getRowOrThrow(id);
    const merged = normalizeAgents([
      ...row.includedAgents,
      ...normalizeAgents(agents),
    ]);
    return this.updateMembership(id, { includedAgents: merged });
  }

  async removeAgent(id: string, agent: string) {
    const row = await this.getRowOrThrow(id);
    const [target] = normalizeAgents([agent]);
    if (!row.includedAgents.includes(target))
      throw new NotFoundException(
        `Agent ${target} is not a single agent of this membership`,
      );
    return this.updateMembership(id, {
      includedAgents: row.includedAgents.filter((a) => a !== target),
    });
  }

  /* -------------------------------- teams ------------------------------- */

  async addTeams(id: string, teamIds: unknown) {
    await this.getRowOrThrow(id);
    const ids = normalizeIds(teamIds, 'teamIds');
    if (!ids.length) throw new BadRequestException('teamIds is required');
    await this.assertTeamsExist(ids);

    await this.prisma.membershipTemplateTeam.createMany({
      data: ids.map((teamId) => ({ membershipTemplateId: id, teamId })),
      skipDuplicates: true,
    });
    return this.getMembership(id);
  }

  async removeTeam(id: string, teamId: string) {
    await this.getRowOrThrow(id);
    const { count } = await this.prisma.membershipTemplateTeam.deleteMany({
      where: { membershipTemplateId: id, teamId },
    });
    if (!count)
      throw new NotFoundException(
        `Team ${teamId} is not linked to this membership`,
      );
    return this.getMembership(id);
  }

  /* ------------------------------ assignment ---------------------------- */

  /**
   * A grant is one SHARED pool: `monthlyTokenLimit` is what all of the
   * membership's agents may spend together per 30-day cycle, and the
   * usage columns hold their combined spend. Every response is passed
   * through {@link withCurrentCycle} so a grant whose cycle ended shows a
   * fresh pool even before the next chat persists the rollover.
   */
  private async getAssignmentRowOrThrow(
    assignmentId: string,
  ): Promise<AssignmentRow> {
    if (!assignmentId?.trim())
      throw new BadRequestException('Assignment id is required');
    const row = await this.prisma.assignedMembership.findUnique({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
    if (!row) throw new NotFoundException('Membership assignment not found');
    return row;
  }

  async assignMembership(
    userId: string,
    membershipTemplateId: string,
    durationOverride?: number,
    monthlyTokenLimitOverride?: number,
  ) {
    if (!userId?.trim()) throw new BadRequestException('userId is required');
    const [template, user] = await Promise.all([
      this.prisma.membershipTemplate.findUnique({
        where: { id: membershipTemplateId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
    ]);
    if (!template) throw new NotFoundException('Template not found');
    if (!user) throw new NotFoundException('User not found');

    const durationDays = durationOverride ?? template.durationDays;
    const monthlyTokenLimit = normalizeTokenLimit(
      monthlyTokenLimitOverride ?? template.monthlyTokenLimit,
    );
    const msPerDay = 1000 * 60 * 60 * 24;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * msPerDay);

    const row = await this.prisma.assignedMembership.create({
      data: {
        userId,
        membershipTemplateId,
        startsAt: now,
        expiresAt,
        isActive: true,
        monthlyTokenLimit,
        cycleStartsAt: now,
        tokensLeft: monthlyTokenLimit,
      },
      include: assignmentInclude,
    });
    // The first cycle starts today: whatever the membership's agents already
    // spent today is in the pool from the start, exactly as it is enforced.
    const figures = await refreshMembershipPool(
      this.prisma,
      row.user.oauthId,
      row,
      now,
    );
    return toAssignmentView({ ...row, ...figures });
  }

  /** Reads with their pool figures, one ledger query per user. */
  private async viewAll(rows: AssignmentRow[], now = new Date()) {
    const byUser = new Map<string, AssignmentRow[]>();
    for (const row of rows) {
      const list = byUser.get(row.user.oauthId) ?? [];
      list.push(row);
      byUser.set(row.user.oauthId, list);
    }
    const views = new Map<string, MembershipAssignmentView>();
    for (const [oauthId, userRows] of byUser) {
      const computed = await withComputedPools(
        this.prisma,
        oauthId,
        userRows,
        now,
      );
      for (const row of computed) views.set(row.id, toAssignmentView(row));
    }
    return rows.map((row) => views.get(row.id)!);
  }

  private async viewOne(row: AssignmentRow, now = new Date()) {
    const [view] = await this.viewAll([row], now);
    return view;
  }

  async listAssignments(query: {
    userId?: string;
    email?: string;
    activeOnly?: boolean;
  }) {
    const now = new Date();
    const email = query.email?.trim();
    const rows = await this.prisma.assignedMembership.findMany({
      where: {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(email ? { user: { email } } : {}),
        ...(query.activeOnly
          ? {
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            }
          : {}),
      },
      include: assignmentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return this.viewAll(rows, now);
  }

  async getAssignment(assignmentId: string) {
    return this.viewOne(await this.getAssignmentRowOrThrow(assignmentId));
  }

  /**
   * Changes the grant's shared allowance and/or timing. Raising or lowering
   * `monthlyTokenLimit` re-prices `tokensLeft` against the spend already
   * in the ledger this cycle; it does not hand the pool back.
   */
  async updateAssignment(
    assignmentId: string,
    data: UpdateMembershipAssignmentDto,
  ) {
    const existing = await this.getAssignmentRowOrThrow(assignmentId);

    const update: Prisma.AssignedMembershipUpdateInput = {};

    if (data.monthlyTokenLimit !== undefined) {
      update.monthlyTokenLimit = normalizeTokenLimit(data.monthlyTokenLimit);
    }

    let effectiveStartsAt = existing.startsAt;
    if (data.startsAt !== undefined && data.startsAt !== null) {
      const startsAt = new Date(data.startsAt);
      if (Number.isNaN(startsAt.getTime()))
        throw new BadRequestException('startsAt must be a valid date');
      update.startsAt = startsAt;
      effectiveStartsAt = startsAt;
    }

    if (data.expiresAt !== undefined) {
      if (data.expiresAt === null) update.expiresAt = null;
      else {
        const expiresAt = new Date(data.expiresAt);
        if (Number.isNaN(expiresAt.getTime()))
          throw new BadRequestException('expiresAt must be a valid date');
        update.expiresAt = expiresAt;
      }
    } else if (data.durationDays !== undefined) {
      const days = Number(data.durationDays);
      if (!Number.isInteger(days) || days < 1)
        throw new BadRequestException(
          'durationDays must be an integer of at least 1',
        );
      const expiresAt = new Date(effectiveStartsAt);
      expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
      update.expiresAt = expiresAt;
    }

    if (data.isActive !== undefined) {
      if (typeof data.isActive !== 'boolean')
        throw new BadRequestException('isActive must be a boolean');
      update.isActive = data.isActive;
    }

    const row = await this.prisma.assignedMembership.update({
      where: { id: assignmentId },
      data: update,
      include: assignmentInclude,
    });
    // The cached rollup follows the new allowance / start date.
    const figures = await refreshMembershipPool(
      this.prisma,
      row.user.oauthId,
      row,
    );
    return toAssignmentView({ ...row, ...figures });
  }

  /**
   * Applies what one chat cost to the grant's SHARED pool. `agentName` says
   * which of the membership's agents was chatting -- it must be one the
   * membership reaches -- but the spend lands on the one pool every agent of
   * the membership draws from. `inputTokens` and `outputTokens` are signed
   * deltas: positive spends, negative refunds.
   *
   * The spend is written to the usage ledger (the pool is the ledger summed
   * over the membership's agents), which floors each counter at 0, and the
   * grant's cached rollup is then re-derived from it. Team and single-agent
   * grants are not touched: each tier is charged only by its own endpoint.
   */
  async recordTokenUsage(
    assignmentId: string,
    agentName: string,
    split: RecordMembershipTokenUsageDto,
  ) {
    const [agent] = normalizeAgents([agentName]);
    const inputTokens = toSignedInt(split?.inputTokens, 'inputTokens');
    const outputTokens = toSignedInt(split?.outputTokens, 'outputTokens');

    const existing = await this.getAssignmentRowOrThrow(assignmentId);
    if (!membershipCoversAgent(existing.template, agent))
      throw new BadRequestException(
        `Agent ${agent} is not part of membership "${existing.template.name}"`,
      );

    await this.tokenUsage.applyAgentTokenDelta(
      existing.user.email,
      agent,
      { totalTokens: inputTokens + outputTokens, inputTokens, outputTokens },
      // A membership chat is paid by the membership alone, so the team rows
      // for this agent stay put. This grant is refreshed below, so the
      // membership sync is skipped here too.
      { syncTeamGrants: false, syncMembershipGrants: false },
    );

    const figures = await refreshMembershipPool(
      this.prisma,
      existing.user.oauthId,
      existing,
    );
    return toAssignmentView({ ...existing, ...figures });
  }

  /**
   * Same as {@link recordTokenUsage}, but the grant is addressed by the
   * user's email and the membership. `membershipId` is the template id (the
   * user's newest live grant of it is used); an assignment id of that user
   * is accepted too.
   */
  async recordTokenUsageByEmail(data: RecordMembershipTokenUsageByEmailDto) {
    const email = data?.email?.trim();
    const membershipId = data?.membershipId?.trim();
    if (!email) throw new BadRequestException('email is required');
    if (!membershipId)
      throw new BadRequestException('membershipId is required');

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${email} not found`);

    const now = new Date();
    const grant = await this.prisma.assignedMembership.findFirst({
      where: {
        userId: user.id,
        OR: [{ membershipTemplateId: membershipId }, { id: membershipId }],
        isActive: true,
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!grant)
      throw new NotFoundException(
        `No active membership ${membershipId} found for ${email}`,
      );

    return this.recordTokenUsage(grant.id, data.agentName, data);
  }

  /**
   * Revoke a user's membership. The row is flipped to inactive rather than
   * deleted so usage history and threshold flags survive.
   */
  async revokeMembership(assignmentId: string) {
    const row = await this.prisma.assignedMembership.findUnique({
      where: { id: assignmentId },
    });
    if (!row) throw new NotFoundException('Membership assignment not found');

    return this.prisma.assignedMembership.update({
      where: { id: assignmentId },
      data: { isActive: false },
    });
  }
}
