// src/single-assigned-agent/single-assigned-agent.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AgentName,
  Prisma,
  SingleAssignedAgent,
  User,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { recordGrantUsageDay } from 'src/token-usage/grant-usage-daily.helpers';
import {
  CreateSingleAssignedAgentDto,
  ListSingleAssignedAgentsQuery,
  UpdateSingleAssignedAgentDto,
} from './dto/single-assigned-agent.dto';

type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const userSelect = {
  select: { id: true, email: true, oauthId: true, username: true },
} as const;

type AssignmentWithUser = Prisma.SingleAssignedAgentGetPayload<{
  include: { user: typeof userSelect };
}>;

/**
 * The ONLY writer of SingleAssignedAgent rows.
 *
 * A row here is a direct, per-user agent grant. Teams (AssignedTeam) and
 * memberships (AssignedMembership) are separate tiers with their own tables
 * and never materialize into this one. Any other module that needs to change
 * this table goes through this service;
 * single-assigned-agent.ownership.spec.ts fails the test run otherwise.
 */
@Injectable()
export class SingleAssignedAgentService {
  private readonly logger = new Logger(SingleAssignedAgentService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * Explicit expiresAt wins (null clears it); otherwise durationDays is
   * counted from startsAt, falling back to the row's current start, then now.
   */
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

  private tokensLeftFor(tokenLimit: number | null, usedTokens: number) {
    return tokenLimit === null ? null : Math.max(0, tokenLimit - usedTokens);
  }

  /**
   * Quota falls back to userAgentTokenUsage when no assignment grants the
   * agent, so revoking the last grant must not leave a spendable budget.
   */
  private async clearLegacyQuotaIfUnassigned(
    tx: Prisma.TransactionClient,
    userId: string,
    oauthId: string,
    agentName: AgentName,
  ) {
    const stillAssigned = await tx.singleAssignedAgent.findFirst({
      where: { userId, agentName, isActive: true },
      select: { id: true },
    });
    if (stillAssigned) return;
    await tx.userAgentTokenUsage.updateMany({
      where: { oauthId, agentName },
      data: { totalTokenLimit: 0, totalTokensLeft: 0 },
    });
  }

  private async getOrThrow(id: string): Promise<AssignmentWithUser> {
    if (!id?.trim()) throw new BadRequestException('Assignment id is required');
    const row = await this.prisma.singleAssignedAgent.findUnique({
      where: { id },
      include: { user: userSelect },
    });
    if (!row) throw new NotFoundException(`Agent assignment "${id}" not found`);
    return row;
  }

  /* -------------------------------- CREATE -------------------------------- */

  /**
   * Creates a new grant. One active row per (user, agent) is the invariant the
   * rest of the platform relies on, so a second active grant is refused
   * rather than silently merged — PATCH the existing one instead.
   */
  async create(dto: CreateSingleAssignedAgentDto): Promise<AssignmentWithUser> {
    const user = await this.resolveUser(dto);
    const isActive = dto.isActive ?? true;

    if (isActive) {
      const existing = await this.prisma.singleAssignedAgent.findFirst({
        where: { userId: user.id, agentName: dto.agentName, isActive: true },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          `User ${user.email} already has an active ${dto.agentName} assignment (${existing.id})`,
        );
      }
    }

    const expiresAt = this.computeExpiry(
      dto.startsAt,
      dto.expiresAt,
      dto.durationDays,
    );
    const tokenLimit = dto.tokenLimit ?? null;

    return this.prisma.singleAssignedAgent.create({
      data: {
        userId: user.id,
        agentName: dto.agentName,
        ...(dto.startsAt ? { startsAt: dto.startsAt } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(dto.durationDays !== undefined
          ? { durationDays: dto.durationDays }
          : {}),
        isActive,
        tokenLimit,
        tokensLeft: this.tokensLeftFor(tokenLimit, 0),
      },
      include: { user: userSelect },
    });
  }

  /* --------------------------------- READ --------------------------------- */

  async findAll(
    q: ListSingleAssignedAgentsQuery,
  ): Promise<Paginated<AssignmentWithUser>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const now = new Date();

    const where: Prisma.SingleAssignedAgentWhereInput = {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.email ? { user: { email: q.email.trim() } } : {}),
      ...(q.agentName ? { agentName: q.agentName } : {}),
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
    const [data, total] = await Promise.all([
      this.prisma.singleAssignedAgent.findMany({
        where,
        include: { user: userSelect },
        orderBy: { [q.sortBy ?? 'createdAt']: q.sortOrder ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.singleAssignedAgent.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<AssignmentWithUser> {
    return this.getOrThrow(id);
  }

  /* -------------------------------- UPDATE -------------------------------- */

  async update(
    id: string,
    dto: UpdateSingleAssignedAgentDto,
  ): Promise<AssignmentWithUser> {
    const existing = await this.getOrThrow(id);

    // A renewal is a fresh grant on the same row: it starts now (unless the
    // caller says otherwise), so durationDays is counted from the renewal.
    const startsAt = dto.startsAt ?? (dto.resetUsage ? new Date() : undefined);

    const expiresAt = this.computeExpiry(
      startsAt,
      dto.expiresAt,
      dto.durationDays,
      existing.startsAt,
    );

    const data: Prisma.SingleAssignedAgentUpdateInput = {
      ...(startsAt ? { startsAt } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(dto.durationDays !== undefined
        ? { durationDays: dto.durationDays }
        : {}),
      ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
    };

    const usedTokens = dto.resetUsage ? 0 : existing.usedTokens;
    if (dto.resetUsage) {
      data.usedTokens = 0;
      data.inputTokens = 0;
      data.outputTokens = 0;
    }

    const tokenLimit =
      dto.tokenLimit !== undefined ? dto.tokenLimit : existing.tokenLimit;
    if (dto.tokenLimit !== undefined) data.tokenLimit = dto.tokenLimit;
    if (dto.tokenLimit !== undefined || dto.resetUsage) {
      data.tokensLeft = this.tokensLeftFor(tokenLimit, usedTokens);
    }

    // Re-activating must not create a second active grant for the same agent.
    if (dto.isActive === true && !existing.isActive) {
      const clash = await this.prisma.singleAssignedAgent.findFirst({
        where: {
          userId: existing.userId,
          agentName: existing.agentName,
          isActive: true,
          NOT: { id },
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(
          `User ${existing.user.email} already has an active ${existing.agentName} assignment (${clash.id})`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.singleAssignedAgent.update({
        where: { id },
        data,
        include: { user: userSelect },
      });

      if (dto.isActive === false && existing.isActive) {
        await this.clearLegacyQuotaIfUnassigned(
          tx,
          existing.userId,
          existing.user.oauthId,
          existing.agentName,
        );
      }

      return updated;
    });
  }

  /**
   * Applies what one chat spent to the user's live grant for that agent.
   *
   * The chat reports `inputTokens` and `outputTokens`; the spend applied is
   * their sum. Both are deltas, not running totals: positive draws the
   * allowance down, negative gives it back. The grant's rollup is the only
   * thing moved -- `tokenLimit` is the admin's number and is never rewritten
   * here, so `tokensLeft` is simply re-derived from it. Both counters floor at
   * 0, so a refund larger than the recorded spend cannot push the grant
   * negative.
   */
  async recordTokenUsage(
    email: string,
    agentName: AgentName,
    split: { inputTokens: number; outputTokens: number },
  ): Promise<AssignmentWithUser> {
    const user = await this.resolveUser({ email });
    const usedTokens = split.inputTokens + split.outputTokens;

    // One active grant per (user, agent) is the platform invariant; newest
    // first is only a tie-break for data that predates it.
    const existing = await this.prisma.singleAssignedAgent.findFirst({
      where: { userId: user.id, agentName, isActive: true },
      orderBy: { startsAt: 'desc' },
      select: { id: true, tokenLimit: true, usedTokens: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `User ${user.email} has no active ${agentName} assignment`,
      );
    }

    const newUsedTokens = Math.max(0, existing.usedTokens + usedTokens);

    // Single-agent spend lives on this grant only. It is deliberately kept out
    // of the DailyTokenUsage ledger: team grants and membership pools are
    // derived from that ledger for the same agent, so writing it there would
    // charge one chat to every tier that covers the agent. The usage charts
    // get it from GrantTokenUsageDaily instead.
    const updated = await this.prisma.singleAssignedAgent.update({
      where: { id: existing.id },
      data: {
        usedTokens: newUsedTokens,
        tokensLeft: this.tokensLeftFor(existing.tokenLimit, newUsedTokens),
        ...(split.inputTokens
          ? { inputTokens: { increment: split.inputTokens } }
          : {}),
        ...(split.outputTokens
          ? { outputTokens: { increment: split.outputTokens } }
          : {}),
      },
      include: { user: userSelect },
    });
    await recordGrantUsageDay(this.prisma, {
      oauthId: user.oauthId,
      agentName,
      source: 'SINGLE',
      inputTokens: split.inputTokens,
      outputTokens: split.outputTokens,
      totalTokens: newUsedTokens - existing.usedTokens,
    });
    return updated;
  }

  /**
   * Sets the user's live grant for an agent to an absolute spend figure.
   *
   * Unlike {@link recordTokenUsage}, `totalUsedTokens` is not added to what is
   * already there -- it replaces it, so a caller that tracks the running total
   * itself can push the authoritative number without needing to know what the
   * grant last recorded. `tokenLimit` is the admin's number and is untouched;
   * the allowance is reduced by subtracting the new total from it.
   */
  async updateToken(
    email: string,
    agentName: AgentName,
    totalUsedTokens: number,
  ): Promise<AssignmentWithUser> {
    const user = await this.resolveUser({ email });

    const existing = await this.prisma.singleAssignedAgent.findFirst({
      where: { userId: user.id, agentName, isActive: true },
      orderBy: { startsAt: 'desc' },
      select: { id: true, tokenLimit: true, usedTokens: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `User ${user.email} has no active ${agentName} assignment`,
      );
    }

    // Grant only, as in recordTokenUsage: the ledger feeds team and
    // membership figures and must not carry single-agent spend.
    const updated = await this.prisma.singleAssignedAgent.update({
      where: { id: existing.id },
      data: {
        usedTokens: totalUsedTokens,
        tokensLeft: this.tokensLeftFor(existing.tokenLimit, totalUsedTokens),
      },
      include: { user: userSelect },
    });
    // The caller sends a running total, so the day's spend is the change.
    await recordGrantUsageDay(this.prisma, {
      oauthId: user.oauthId,
      agentName,
      source: 'SINGLE',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: totalUsedTokens - existing.usedTokens,
    });
    return updated;
  }

  /* -------------------------------- DELETE -------------------------------- */

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.getOrThrow(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.singleAssignedAgent.delete({ where: { id } });
      await this.clearLegacyQuotaIfUnassigned(
        tx,
        existing.userId,
        existing.user.oauthId,
        existing.agentName,
      );
    });

    return { deleted: true, id };
  }

  /* ----------------------------- BULK / CRON ------------------------------ */

  /**
   * Flips every active grant whose expiry has passed to isActive: false.
   * Rows are kept for history; nothing is deleted.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoExpireCron(): Promise<number> {
    const res = await this.prisma.singleAssignedAgent.updateMany({
      where: { isActive: true, expiresAt: { not: null, lte: new Date() } },
      data: { isActive: false },
    });
    if (res.count) {
      this.logger.debug(
        `Auto-deactivated ${res.count} SingleAssignedAgent records`,
      );
    }
    return res.count;
  }

  /**
   * Zeroes the allowance on every grant. Returned un-awaited so the caller can
   * fold it into a batch $transaction alongside the other usage resets.
   */
  resetAllTokenLimits(): Prisma.PrismaPromise<Prisma.BatchPayload> {
    return this.prisma.singleAssignedAgent.updateMany({
      data: { tokenLimit: 0, tokensLeft: 0 },
    });
  }

  /** Deactivates every active grant held by the given users. */
  async deactivateAllForUsers(userIds: string[]): Promise<number> {
    if (!userIds.length) return 0;
    const res = await this.prisma.singleAssignedAgent.updateMany({
      where: { userId: { in: userIds }, isActive: true },
      data: { isActive: false },
    });
    return res.count;
  }
}

export type { AssignmentWithUser, SingleAssignedAgent };
