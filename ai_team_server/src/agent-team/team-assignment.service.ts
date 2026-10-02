// src/agent-team/team-assignment.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentName, Prisma, User } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { recordGrantUsageDay } from 'src/token-usage/grant-usage-daily.helpers';
import { AgentTeamService } from './agent-team.service';
import {
  refreshAssignedTeamRollup,
  tokensLeftFor,
} from './assigned-team-agent.helpers';
import {
  CreateTeamAssignmentDto,
  ListTeamAssignmentsQuery,
  RecordTeamAgentTokenUsageDto,
  UpdateTeamAssignmentDto,
} from './dto/team-assignment.dto';

type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const assignmentInclude = {
  user: { select: { id: true, email: true, oauthId: true, username: true } },
  team: {
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      agents: { select: { agentName: true }, orderBy: { createdAt: 'asc' } },
    },
  },
  // Per-agent slice of the grant: each agent's own limit and spend.
  agents: {
    select: {
      id: true,
      agentName: true,
      tokenLimit: true,
      usedTokens: true,
      inputTokens: true,
      outputTokens: true,
      tokensLeft: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.AssignedTeamInclude;

type AssignmentRow = Prisma.AssignedTeamGetPayload<{
  include: typeof assignmentInclude;
}>;

/** Row with the team's agent list flattened to `AgentName[]`. */
export type TeamAssignmentView = Omit<AssignmentRow, 'team'> & {
  team: Omit<AssignmentRow['team'], 'agents'> & {
    agents: AssignmentRow['team']['agents'][number]['agentName'][];
  };
};

function toView(row: AssignmentRow): TeamAssignmentView {
  return {
    ...row,
    team: { ...row.team, agents: row.team.agents.map((a) => a.agentName) },
  };
}

/**
 * The ONLY writer of AssignedTeam / AssignedTeamAgent limits. A row is a
 * per-user grant of a whole AgentTeam; the grant's tokenLimit is what EACH
 * agent in the team gets, held on its own AssignedTeamAgent row. This tier
 * never reads or writes SingleAssignedAgent or the membership tables.
 */
@Injectable()
export class TeamAssignmentService {
  private readonly logger = new Logger(TeamAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: AgentTeamService,
  ) {}

  /* ------------------------------- helpers ------------------------------- */

  private async resolveUser(sel: {
    email?: string;
    userId?: string;
  }): Promise<User> {
    if (sel.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: sel.userId },
      });
      if (!user) throw new NotFoundException(`User "${sel.userId}" not found`);
      return user;
    }
    const email = sel.email?.trim();
    if (!email) throw new BadRequestException('email or userId is required');
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user)
      throw new NotFoundException(`User with email "${email}" not found`);
    return user;
  }

  /** Explicit expiresAt wins (null clears); else durationDays from startsAt. */
  private computeExpiry(
    startsAt: Date | undefined,
    expiresAt: Date | null | undefined,
    durationDays: number | null | undefined,
    currentStartsAt?: Date,
  ): Date | null | undefined {
    if (expiresAt !== undefined) return expiresAt;
    if (durationDays && durationDays > 0) {
      const base = new Date(startsAt ?? currentStartsAt ?? new Date());
      base.setUTCDate(base.getUTCDate() + durationDays);
      return base;
    }
    return undefined;
  }

  private async getOrThrow(id: string): Promise<AssignmentRow> {
    if (!id?.trim()) throw new BadRequestException('Assignment id is required');
    const row = await this.prisma.assignedTeam.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!row) throw new NotFoundException(`Team assignment "${id}" not found`);
    return row;
  }

  private async assertNoActiveClash(
    userId: string,
    teamId: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.assignedTeam.findFirst({
      where: {
        userId,
        teamId,
        isActive: true,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        `User already has an active assignment for this team (${clash.id})`,
      );
    }
  }

  /* -------------------------------- CREATE -------------------------------- */

  /**
   * One active row per (user, team); a second is refused, PATCH instead.
   *
   * The per-agent allowance comes from the request when given, else from the
   * team's own tokenLimit, and every agent in the team gets its own row
   * carrying that full amount.
   */
  async create(dto: CreateTeamAssignmentDto): Promise<TeamAssignmentView> {
    const [user, team] = await Promise.all([
      this.resolveUser(dto),
      this.teams.resolveTeam(dto),
    ]);
    const isActive = dto.isActive ?? true;
    if (isActive) await this.assertNoActiveClash(user.id, team.id);

    const expiresAt = this.computeExpiry(
      dto.startsAt,
      dto.expiresAt,
      dto.durationDays,
    );
    const tokenLimit =
      dto.tokenLimit !== undefined ? dto.tokenLimit : (team.tokenLimit ?? null);

    const roster = await this.prisma.agentTeamAgent.findMany({
      where: { teamId: team.id },
      select: { agentName: true },
      orderBy: { createdAt: 'asc' },
    });

    const row = await this.prisma.assignedTeam.create({
      data: {
        userId: user.id,
        teamId: team.id,
        ...(dto.startsAt ? { startsAt: dto.startsAt } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(dto.durationDays !== undefined
          ? { durationDays: dto.durationDays }
          : {}),
        isActive,
        tokenLimit,
        // Grant-level tokensLeft is the sum across agents.
        tokensLeft: tokenLimit === null ? null : tokenLimit * roster.length,
        agents: {
          create: roster.map(({ agentName }) => ({
            agentName,
            tokenLimit,
            tokensLeft: tokensLeftFor(tokenLimit, 0),
          })),
        },
      },
      include: assignmentInclude,
    });
    return toView(row);
  }

  /* --------------------------------- READ --------------------------------- */

  async findAll(
    q: ListTeamAssignmentsQuery,
  ): Promise<Paginated<TeamAssignmentView>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const now = new Date();

    const where: Prisma.AssignedTeamWhereInput = {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.email ? { user: { email: q.email.trim() } } : {}),
      ...(q.teamId ? { teamId: q.teamId } : {}),
      ...(typeof q.isActive === 'boolean' ? { isActive: q.isActive } : {}),
      ...(q.activeOnly
        ? {
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          }
        : {}),
    };

    // These are independent reads. Avoid a batch transaction here because the
    // runtime pool can intentionally be limited to one connection; concurrent
    // list requests would otherwise fail with P2028 while waiting to begin a
    // transaction. The adapter will queue the ordinary queries safely.
    const [rows, total] = await Promise.all([
      this.prisma.assignedTeam.findMany({
        where,
        include: assignmentInclude,
        orderBy: { [q.sortBy ?? 'createdAt']: q.sortOrder ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assignedTeam.count({ where }),
    ]);

    return {
      data: rows.map(toView),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<TeamAssignmentView> {
    return toView(await this.getOrThrow(id));
  }

  /* -------------------------------- UPDATE -------------------------------- */

  /** A new `tokenLimit` is applied to every agent row of the grant. */
  async update(
    id: string,
    dto: UpdateTeamAssignmentDto,
  ): Promise<TeamAssignmentView> {
    const existing = await this.getOrThrow(id);

    if (dto.isActive === true && !existing.isActive) {
      await this.assertNoActiveClash(existing.userId, existing.teamId, id);
    }

    const expiresAt = this.computeExpiry(
      dto.startsAt,
      dto.expiresAt,
      dto.durationDays,
      existing.startsAt,
    );

    const data: Prisma.AssignedTeamUpdateInput = {
      ...(dto.startsAt ? { startsAt: dto.startsAt } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(dto.durationDays !== undefined
        ? { durationDays: dto.durationDays }
        : {}),
      ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
      ...(dto.tokenLimit !== undefined ? { tokenLimit: dto.tokenLimit } : {}),
    };

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.assignedTeam.update({ where: { id }, data });
      if (dto.tokenLimit !== undefined) {
        const limit = dto.tokenLimit;
        // Each agent keeps what it spent; only its allowance moves.
        for (const agent of existing.agents) {
          await tx.assignedTeamAgent.update({
            where: { id: agent.id },
            data: {
              tokenLimit: limit,
              tokensLeft: tokensLeftFor(limit, agent.usedTokens),
            },
          });
        }
        await refreshAssignedTeamRollup(tx, id);
      }
      return tx.assignedTeam.findUniqueOrThrow({
        where: { id },
        include: assignmentInclude,
      });
    });
    return toView(row);
  }

  /* ------------------------------ TOKEN USAGE ------------------------------ */

  /**
   * Applies one chat's spend to a single agent row of a user's live grant
   * for a team. `inputTokens` and `outputTokens` are signed deltas; their sum
   * moves `usedTokens` (floored at 0) and `tokensLeft` is re-derived from the
   * row's own `tokenLimit`, which is never touched. The grant rollup is then
   * re-summed from its agent rows. Nothing else moves: not the usage ledger,
   * not the user's single-agent grant, not any membership pool.
   */
  async recordAgentTokenUsage(
    email: string,
    teamId: string,
    agentName: AgentName,
    split: RecordTeamAgentTokenUsageDto,
  ): Promise<TeamAssignmentView> {
    const user = await this.resolveUser({ email });
    const now = new Date();

    // One active grant per (user, team) is the invariant; newest first is
    // only a tie-break for data that predates it.
    const grant = await this.prisma.assignedTeam.findFirst({
      where: {
        userId: user.id,
        teamId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        team: { select: { name: true } },
        agents: {
          where: { agentName },
          select: {
            id: true,
            tokenLimit: true,
            usedTokens: true,
            inputTokens: true,
            outputTokens: true,
          },
        },
      },
    });
    if (!grant) {
      throw new NotFoundException(
        `User ${user.email} has no active assignment for team "${teamId}"`,
      );
    }
    const agent = grant.agents[0];
    if (!agent) {
      throw new NotFoundException(
        `Agent ${agentName} is not part of team "${grant.team.name}"`,
      );
    }

    const floor = (current: number, change: number) =>
      Math.max(0, current + change);
    const usedTokens = floor(
      agent.usedTokens,
      split.inputTokens + split.outputTokens,
    );

    // Team spend lives on this grant only. It is kept out of the
    // DailyTokenUsage ledger because membership pools are derived from that
    // ledger for the same agent, so writing it there would also charge the
    // membership. The usage charts get it from GrantTokenUsageDaily instead.
    const inputTokens = floor(agent.inputTokens, split.inputTokens);
    const outputTokens = floor(agent.outputTokens, split.outputTokens);
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.assignedTeamAgent.update({
        where: { id: agent.id },
        data: {
          usedTokens,
          inputTokens,
          outputTokens,
          tokensLeft: tokensLeftFor(agent.tokenLimit, usedTokens),
        },
      });
      await refreshAssignedTeamRollup(tx, grant.id);
      return tx.assignedTeam.findUniqueOrThrow({
        where: { id: grant.id },
        include: assignmentInclude,
      });
    });
    await recordGrantUsageDay(this.prisma, {
      oauthId: user.oauthId,
      agentName,
      source: 'TEAM',
      inputTokens: inputTokens - agent.inputTokens,
      outputTokens: outputTokens - agent.outputTokens,
      totalTokens: usedTokens - agent.usedTokens,
    });
    return toView(row);
  }

  /* -------------------------------- DELETE -------------------------------- */

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    await this.getOrThrow(id);
    await this.prisma.assignedTeam.delete({ where: { id } });
    return { deleted: true, id };
  }

  /* --------------------------------- CRON --------------------------------- */

  /** Flips expired active grants to isActive: false; rows are kept. */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoExpireCron(): Promise<number> {
    const res = await this.prisma.assignedTeam.updateMany({
      where: { isActive: true, expiresAt: { not: null, lte: new Date() } },
      data: { isActive: false },
    });
    if (res.count) {
      this.logger.debug(`Auto-deactivated ${res.count} AssignedTeam records`);
    }
    return res.count;
  }
}
