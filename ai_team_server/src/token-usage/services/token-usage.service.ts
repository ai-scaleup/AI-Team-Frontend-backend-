import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AgentName } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { resolveTemplateAgents } from 'src/membership/membership.service';
import {
  computeMembershipPools,
  LedgerRow,
  membershipPoolLimit,
  membershipPoolsFromLedger,
  syncAssignedMembershipPools,
} from 'src/membership/assigned-membership.helpers';
import { applyAssignedTeamAgentDelta } from 'src/agent-team/assigned-team-agent.helpers';

const MODEL = 'claude-sonnet-4-6';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Midnight UTC of a day, the shape dailyTokenUsage stores its dates in. */
const startOfUtcDay = (value: Date) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

const getAnthropicApiKey = () =>
  process.env.ANTHROPIC_API_KEY ||
  process.env.CLAUDE_API_KEY ||
  process.env.anthropic_api_key ||
  process.env.claude_api_key;

export interface ClaudeCallOptions {
  oauthId: string;
  agentName: AgentName;
  messages: Anthropic.MessageParam[];
  system?: string;
  maxTokens?: number;
}

export interface CountTextTokensResult {
  model: string;
  totalUsedInputTokens: number;
  totalUsedTokens: number;
}

export interface SetTokenUsageInput {
  totalUsedInputTokens: number;
  totalUsedOutputTokens: number;
}

export interface SetDailyTokenUsageInput {
  inputTokens: number;
  outputTokens: number;
}

/**
 * The allowance an agent draws on, and the cycle that allowance resets with.
 *
 * Two parts add up to `limit`: `agentLimit` is measured against the agent's
 * OWN cycle spend (direct grant + team slices, or the legacy fallback), while
 * `poolLimit` is the membership pool SHARED with every other agent of the
 * membership, measured against `poolUsed` -- what all of them spent.
 */
export interface AgentQuota {
  agentName: AgentName;
  limit: number;
  cycleStart: Date;
  agentLimit: number;
  poolLimit: number;
  poolUsed: number;
  poolLeft: number;
}

export type QuotaUser = NonNullable<
  Awaited<ReturnType<TokenUsageService['loadQuotaUser']>>
>;

/** Pool spend per membership grant id, as the ledger has it right now. */
type PoolUsage = Awaited<ReturnType<typeof computeMembershipPools>>;

@Injectable()
export class TokenUsageService {
  private readonly anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = getAnthropicApiKey();

    if (!apiKey) {
      throw new Error(
        'Anthropic API key is not configured. Set ANTHROPIC_API_KEY or CLAUDE_API_KEY in ai_team_server/.env.',
      );
    }

    this.anthropic = new Anthropic({ apiKey });
  }

  private async resolveEmailToOauthId(email: string): Promise<string> {
    const normalizedEmail = email?.trim();

    if (!normalizedEmail) {
      throw new BadRequestException('email is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { oauthId: true },
    });

    if (!user) {
      throw new NotFoundException(
        `User with email "${normalizedEmail}" not found`,
      );
    }

    return user.oauthId;
  }

  private parseDateParam(date: string): Date {
    const normalizedDate = date?.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    const parsedDate = new Date(`${normalizedDate}T00:00:00Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== normalizedDate
    ) {
      throw new BadRequestException('date must be a valid calendar date');
    }

    return parsedDate;
  }

  /**
   * The user plus every assignment shape that can grant an agent an allowance.
   * The three tiers are read side by side; none of them references another.
   */
  private loadQuotaUser(oauthId: string) {
    return this.prisma.user.findUnique({
      where: { oauthId },
      include: {
        agents: { where: { isActive: true } },
        teams: {
          where: { isActive: true },
          include: {
            team: { include: { agents: true } },
            // The allowance lives per agent on the grant's own rows.
            agents: { select: { agentName: true, tokenLimit: true } },
          },
        },
        memberships: {
          where: { isActive: true },
          include: {
            template: {
              include: {
                includedTeams: {
                  select: {
                    team: {
                      select: {
                        isActive: true,
                        agents: { select: { agentName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Allowance an agent draws from the assignments the user holds, before the
   * legacy fallback. Kept separate so many agents can be priced off one load.
   *
   * `agentLimit` is the per-agent part (direct grant + team slices), which
   * the caller measures against this agent's own cycle spend. The membership
   * part is a shared pool: `poolLimit` and `poolUsed` cover every agent of
   * the membership, so what is left for THIS agent is `poolLeft` however the
   * spend was split between agents. `pools` is that spend, summed from the
   * ledger by {@link loadPoolUsage}.
   */
  private resolveAssignedQuota(
    user: QuotaUser,
    agentName: AgentName,
    pools: PoolUsage,
  ) {
    let agentLimit = 0;
    let poolLimit = 0;
    let poolUsed = 0;
    let earliestStart = new Date();
    let hasAccess = false;

    // Check direct
    const directAssigned = user.agents.find((a) => a.agentName === agentName);
    if (directAssigned) {
      hasAccess = true;
      agentLimit += directAssigned.tokenLimit || 0;
      if (directAssigned.startsAt < earliestStart)
        earliestStart = directAssigned.startsAt;
    }

    // Check teams -- the grant's tokenLimit is what each agent gets, held on
    // the agent's own AssignedTeamAgent row; the grant figure is the fallback
    // for a row written before the per-agent split existed.
    for (const t of user.teams) {
      if (
        t.team.isActive &&
        t.team.agents.some((a) => a.agentName === agentName)
      ) {
        hasAccess = true;
        const perAgent = t.agents.find((a) => a.agentName === agentName);
        agentLimit += (perAgent ? perAgent.tokenLimit : t.tokenLimit) || 0;
        if (t.startsAt < earliestStart) earliestStart = t.startsAt;
      }
    }

    // Check memberships -- an agent counts when the template lists it as a
    // single agent or through one of its (active) membership teams. The
    // allowance is one pool for the whole membership, and its spend is what
    // ALL of its agents have in the ledger this cycle.
    for (const m of user.memberships) {
      if (resolveTemplateAgents(m.template).includes(agentName)) {
        hasAccess = true;
        poolLimit += membershipPoolLimit(m);
        poolUsed += pools.get(m.id)?.usedTokens ?? 0;
        if (m.startsAt < earliestStart) earliestStart = m.startsAt;
      }
    }

    return {
      totalLimit: agentLimit + poolLimit,
      agentLimit,
      poolLimit,
      poolUsed,
      poolLeft: Math.max(0, poolLimit - poolUsed),
      earliestStart,
      hasAccess,
    };
  }

  /**
   * Start of the 30-day allowance cycle the assignment is currently in, snapped
   * to the start of its UTC day. Cycle usage is summed from dailyTokenUsage,
   * whose date column is a plain date stored at UTC midnight, so a boundary
   * that kept the assignment's time of day would drop that entire day of
   * usage -- every token an agent assigned earlier today has already spent.
   */
  private resolveCycleStart(earliestStart: Date) {
    const now = new Date();
    let daysSince = Math.floor(
      (now.getTime() - earliestStart.getTime()) / MS_PER_DAY,
    );
    if (daysSince < 0) daysSince = 0;
    const cycles = Math.floor(daysSince / 30);
    return startOfUtcDay(
      new Date(earliestStart.getTime() + cycles * 30 * MS_PER_DAY),
    );
  }

  /** The ledger-derived spend of each of the user's live membership pools. */
  private loadPoolUsage(user: QuotaUser): Promise<PoolUsage> {
    const now = new Date();
    return computeMembershipPools(
      this.prisma,
      user.oauthId,
      this.liveMemberships(user, now),
      now,
    );
  }

  /** The membership grants whose pool still counts: not yet expired. */
  private liveMemberships(user: QuotaUser, now: Date) {
    return user.memberships.filter(
      (m) => m.expiresAt === null || m.expiresAt > now,
    );
  }

  private async calculateUserQuota(oauthId: string, agentName: AgentName) {
    const user = await this.loadQuotaUser(oauthId);

    if (!user)
      return {
        limit: 100000,
        agentLimit: 100000,
        poolLimit: 0,
        poolUsed: 0,
        poolLeft: 0,
        cycleStart: startOfUtcDay(new Date(new Date().setDate(1))),
        userId: null,
      };

    const pools = await this.loadPoolUsage(user);
    const quota = this.resolveAssignedQuota(user, agentName, pools);
    let agentLimit = quota.agentLimit;

    // fallback to legacy limit if no tier grants anything at all
    if (quota.totalLimit === 0) {
      const legacy = await this.prisma.userAgentTokenUsage.findUnique({
        where: { oauthId_agentName: { oauthId, agentName } },
      });
      // totalTokenLimit is the configured legacy allowance; totalTokensLeft is
      // what is left of it, so only the former can stand in as a limit here.
      agentLimit = legacy ? legacy.totalTokenLimit : 100000;
    }

    return {
      limit: agentLimit + quota.poolLimit,
      agentLimit,
      poolLimit: quota.poolLimit,
      poolUsed: quota.poolUsed,
      poolLeft: quota.poolLeft,
      cycleStart: this.resolveCycleStart(quota.earliestStart),
      userId: user.id,
    };
  }

  /**
   * Limit and cycle start for several agents at once, resolved exactly the way
   * callClaude resolves them, so a reported balance matches what is enforced.
   */
  async getAgentQuotas(
    oauthId: string,
    agentNames: AgentName[],
  ): Promise<AgentQuota[]> {
    if (agentNames.length === 0) return [];

    const [user, legacyRows] = await Promise.all([
      this.loadQuotaUser(oauthId),
      this.prisma.userAgentTokenUsage.findMany({
        where: { oauthId, agentName: { in: agentNames } },
        select: { agentName: true, totalTokenLimit: true },
      }),
    ]);

    if (!user) {
      const cycleStart = startOfUtcDay(new Date(new Date().setDate(1)));
      return agentNames.map((agentName) => ({
        agentName,
        limit: 100000,
        cycleStart,
        agentLimit: 100000,
        poolLimit: 0,
        poolUsed: 0,
        poolLeft: 0,
      }));
    }

    const pools = await this.loadPoolUsage(user);
    return this.resolveAgentQuotas(user, agentNames, legacyRows, pools);
  }

  /**
   * {@link getAgentQuotas} over data the caller has already loaded, so a page
   * that shows the user does not read it all a second time. `user` holds the
   * ACTIVE grants in the shape loadQuotaUser reads, `legacyRows` the user's
   * userAgentTokenUsage rows, and `ledger` the user's dailyTokenUsage rows
   * from the start of every live membership's cycle (earlier rows are fine).
   */
  agentQuotasFromLoaded(
    user: QuotaUser,
    agentNames: AgentName[],
    legacyRows: { agentName: AgentName; totalTokenLimit: number }[],
    ledger: LedgerRow[],
  ): AgentQuota[] {
    const now = new Date();
    const pools = membershipPoolsFromLedger(
      this.liveMemberships(user, now),
      ledger,
      now,
    );
    return this.resolveAgentQuotas(user, agentNames, legacyRows, pools);
  }

  private resolveAgentQuotas(
    user: QuotaUser,
    agentNames: AgentName[],
    legacyRows: { agentName: AgentName; totalTokenLimit: number }[],
    pools: PoolUsage,
  ): AgentQuota[] {
    const legacyLimits = new Map(
      legacyRows.map((row) => [row.agentName, row.totalTokenLimit]),
    );

    return agentNames.map((agentName) => {
      const quota = this.resolveAssignedQuota(user, agentName, pools);
      const agentLimit =
        quota.totalLimit === 0
          ? (legacyLimits.get(agentName) ?? 100000)
          : quota.agentLimit;

      return {
        agentName,
        limit: agentLimit + quota.poolLimit,
        cycleStart: this.resolveCycleStart(quota.earliestStart),
        agentLimit,
        poolLimit: quota.poolLimit,
        poolUsed: quota.poolUsed,
        poolLeft: quota.poolLeft,
      };
    });
  }

  private async checkThresholds(
    userId: string,
    oauthId: string,
    used: number,
    limit: number,
  ) {
    if (!userId || limit <= 0) return;
    const percent = used / limit;

    let threshold = 0;
    if (percent >= 1.0) threshold = 100;
    else if (percent >= 0.9) threshold = 90;
    else if (percent >= 0.8) threshold = 80;
    else if (percent >= 0.5) threshold = 50;

    if (threshold > 0) {
      const typeStr = `TOKEN_THRESHOLD_${threshold}`;
      // Check if we recently alerted this threshold to avoid spamming
      const existing = await this.prisma.userAlert.findFirst({
        where: {
          userId,
          type: typeStr,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (!existing) {
        await this.prisma.userAlert.create({
          data: {
            userId,
            type: typeStr,
            message: `You have reached ${threshold}% of your monthly token limit.`,
          },
        });
      }
    }
  }

  async callClaude(opts: ClaudeCallOptions): Promise<Anthropic.Message> {
    const { oauthId, agentName, messages, system, maxTokens = 8096 } = opts;

    const { limit, agentLimit, poolLimit, poolLeft, cycleStart, userId } =
      await this.calculateUserQuota(oauthId, agentName);

    // Get current cycle usage
    const cycleUsages = await this.prisma.dailyTokenUsage.findMany({
      where: { oauthId, agentName, date: { gte: cycleStart } },
    });
    const ESTIMATE_BUFFER = 1000; // the call itself is not priced yet
    const agentCycleUsed = cycleUsages.reduce(
      (sum, d) => sum + d.totalTokens,
      0,
    );
    const totalCycleUsed = agentCycleUsed + ESTIMATE_BUFFER;

    // What this agent may still spend: its own allowance minus its own cycle
    // spend, plus whatever is left of the membership pool it shares with the
    // membership's other agents. A pool exhausted by ALEX blocks LARA too.
    // The buffer comes off the combined balance once.
    const agentLeft =
      agentLimit > 0 ? Math.max(0, agentLimit - agentCycleUsed) : 0;
    const available =
      agentLeft + (poolLimit > 0 ? poolLeft : 0) - ESTIMATE_BUFFER;

    if (available <= 0) {
      await this.prisma.tokenLimitStopLog.create({
        data: {
          oauthId,
          agentName,
          reason: 'monthly limit reached',
          attemptedTokens: totalCycleUsed,
        },
      });
      throw new ForbiddenException(
        `Token limit of ${limit} reached for agent ${agentName}`,
      );
    }

    let response: Anthropic.Message;
    try {
      response = await this.anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages,
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `Claude API error: ${err?.message}`,
      );
    }

    const input = response.usage?.input_tokens ?? 0;
    const output = response.usage?.output_tokens ?? 0;
    const totalNew = input + output;

    // Track daily usage
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(`${todayStr}T00:00:00Z`);

    await this.prisma.dailyTokenUsage.upsert({
      where: { oauthId_agentName_date: { oauthId, agentName, date: today } },
      create: {
        oauthId,
        agentName,
        date: today,
        inputTokens: input,
        outputTokens: output,
        totalTokens: totalNew,
      },
      update: {
        inputTokens: { increment: input },
        outputTokens: { increment: output },
        totalTokens: { increment: totalNew },
      },
    });

    // Update legacy usage tracker just to keep it in sync for total overall
    const existingLegacyUsage =
      await this.prisma.userAgentTokenUsage.findUnique({
        where: { oauthId_agentName: { oauthId, agentName } },
        select: { totalUsedTokens: true },
      });
    const legacyTokensLeft = Math.max(
      0,
      limit - ((existingLegacyUsage?.totalUsedTokens ?? 0) + totalNew),
    );

    await this.prisma.userAgentTokenUsage.upsert({
      where: { oauthId_agentName: { oauthId, agentName } },
      create: {
        oauthId,
        agentName,
        totalUsedInputTokens: input,
        totalUsedOutputTokens: output,
        totalUsedTokens: totalNew,
        totalTokensLeft: legacyTokensLeft,
        totalTokenLimit: limit,
      },
      update: {
        totalUsedInputTokens: { increment: input },
        totalUsedOutputTokens: { increment: output },
        totalUsedTokens: { increment: totalNew },
        totalTokensLeft: legacyTokensLeft,
        totalTokenLimit: limit,
      },
    });

    // Per-agent team rows and shared membership pools follow the ledger.
    await applyAssignedTeamAgentDelta(this.prisma, oauthId, agentName, {
      totalTokens: totalNew,
      inputTokens: input,
      outputTokens: output,
    });
    await syncAssignedMembershipPools(this.prisma, oauthId, agentName);

    // Check thresholds against the combined allowance: what was gone before
    // this call (the buffer is not real spend), plus what it just cost.
    const exactCycleUsed = limit - (available + ESTIMATE_BUFFER) + totalNew;
    if (userId) {
      await this.checkThresholds(userId, oauthId, exactCycleUsed, limit);
    }

    return response;
  }

  async setTokenLimit(
    email: string,
    agentName: AgentName,
    totalTokenLimit: number,
  ) {
    const oauthId = await this.resolveEmailToOauthId(email);

    // Raising or lowering the allowance re-prices the balance against usage
    // already spent; it does not hand the whole allowance back.
    const existingUsage = await this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
      select: { totalUsedTokens: true },
    });
    const totalTokensLeft = Math.max(
      0,
      totalTokenLimit - (existingUsage?.totalUsedTokens ?? 0),
    );

    return this.prisma.userAgentTokenUsage.upsert({
      where: { oauthId_agentName: { oauthId, agentName } },
      create: {
        oauthId,
        agentName,
        totalTokenLimit,
        totalTokensLeft,
      },
      update: { totalTokenLimit, totalTokensLeft },
    });
  }

  async setTokenUsage(
    email: string,
    agentName: AgentName,
    usage: SetTokenUsageInput,
  ) {
    const inputTokens = Number(usage?.totalUsedInputTokens);
    const outputTokens = Number(usage?.totalUsedOutputTokens);
    const totalTokens = inputTokens + outputTokens;

    if (
      !Number.isInteger(inputTokens) ||
      inputTokens < 0 ||
      !Number.isInteger(outputTokens) ||
      outputTokens < 0
    ) {
      throw new BadRequestException(
        'totalUsedInputTokens and totalUsedOutputTokens must be non-negative integers',
      );
    }

    const oauthId = await this.resolveEmailToOauthId(email);

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(`${todayStr}T00:00:00Z`);

    const existingUsage = await this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
      select: { totalTokenLimit: true, totalUsedTokens: true },
    });

    const totalTokenLimit = existingUsage?.totalTokenLimit ?? 100000;
    const nextTotalUsedTokens =
      (existingUsage?.totalUsedTokens ?? 0) + totalTokens;
    const totalTokensLeft = Math.max(0, totalTokenLimit - nextTotalUsedTokens);

    const tokenUsage = await this.prisma.$transaction(async (tx) => {
      await tx.dailyTokenUsage.upsert({
        where: { oauthId_agentName_date: { oauthId, agentName, date: today } },
        create: {
          oauthId,
          agentName,
          date: today,
          inputTokens,
          outputTokens,
          totalTokens,
        },
        update: {
          inputTokens: { increment: inputTokens },
          outputTokens: { increment: outputTokens },
          totalTokens: { increment: totalTokens },
        },
      });
      const lifetime = await tx.userAgentTokenUsage.upsert({
        where: { oauthId_agentName: { oauthId, agentName } },
        create: {
          oauthId,
          agentName,
          totalUsedInputTokens: inputTokens,
          totalUsedOutputTokens: outputTokens,
          totalUsedTokens: totalTokens,
          totalTokenLimit,
          totalTokensLeft,
        },
        update: {
          totalUsedInputTokens: { increment: inputTokens },
          totalUsedOutputTokens: { increment: outputTokens },
          totalUsedTokens: { increment: totalTokens },
          totalTokensLeft,
        },
      });
      // The per-agent team rows and the shared membership pools follow the
      // ledger, so every grant covering this agent shows the same spend the
      // chat just reported.
      await applyAssignedTeamAgentDelta(tx, oauthId, agentName, {
        totalTokens,
        inputTokens,
        outputTokens,
      });
      await syncAssignedMembershipPools(tx, oauthId, agentName);
      return lifetime;
    });

    return tokenUsage;
  }

  /**
   * Moves an agent's ledger by a signed amount, today's row taking the change.
   *
   * setTokenUsage only ever increments, which is right for a workflow run
   * reporting what it just spent. Callers that correct or refund a figure need
   * to move the ledger down as well, so this one reads the current values and
   * writes absolutes, flooring each counter at 0 rather than letting a refund
   * push it negative. Both the per-day row (what the admin usage table reads)
   * and the lifetime rollup are kept in step.
   *
   * By default every live team grant and every live membership pool covering
   * (user, agent) moves by the same amount. A caller that already wrote ONE
   * specific grant itself (the team-assignment or membership usage endpoint)
   * passes `syncTeamGrants: false` / `syncMembershipGrants: false` so that
   * grant is not moved twice and unrelated grants of that tier are left alone.
   */
  async applyAgentTokenDelta(
    email: string,
    agentName: AgentName,
    delta: { totalTokens: number; inputTokens?: number; outputTokens?: number },
    options: { syncTeamGrants?: boolean; syncMembershipGrants?: boolean } = {},
  ) {
    const totalDelta = Math.trunc(delta.totalTokens || 0);
    const inputDelta = Math.trunc(delta.inputTokens || 0);
    const outputDelta = Math.trunc(delta.outputTokens || 0);
    if (!totalDelta && !inputDelta && !outputDelta) return;

    const oauthId = await this.resolveEmailToOauthId(email);

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(`${todayStr}T00:00:00Z`);

    const [daily, lifetime] = await Promise.all([
      this.prisma.dailyTokenUsage.findUnique({
        where: { oauthId_agentName_date: { oauthId, agentName, date: today } },
        select: { inputTokens: true, outputTokens: true, totalTokens: true },
      }),
      this.prisma.userAgentTokenUsage.findUnique({
        where: { oauthId_agentName: { oauthId, agentName } },
        select: {
          totalTokenLimit: true,
          totalUsedTokens: true,
          totalUsedInputTokens: true,
          totalUsedOutputTokens: true,
        },
      }),
    ]);

    const floor = (current: number, change: number) =>
      Math.max(0, current + change);

    const dayInput = floor(daily?.inputTokens ?? 0, inputDelta);
    const dayOutput = floor(daily?.outputTokens ?? 0, outputDelta);
    const dayTotal = floor(daily?.totalTokens ?? 0, totalDelta);

    const totalTokenLimit = lifetime?.totalTokenLimit ?? 100000;
    const lifeInput = floor(lifetime?.totalUsedInputTokens ?? 0, inputDelta);
    const lifeOutput = floor(lifetime?.totalUsedOutputTokens ?? 0, outputDelta);
    const lifeTotal = floor(lifetime?.totalUsedTokens ?? 0, totalDelta);

    await this.prisma.$transaction([
      this.prisma.dailyTokenUsage.upsert({
        where: { oauthId_agentName_date: { oauthId, agentName, date: today } },
        create: {
          oauthId,
          agentName,
          date: today,
          inputTokens: dayInput,
          outputTokens: dayOutput,
          totalTokens: dayTotal,
        },
        update: {
          inputTokens: dayInput,
          outputTokens: dayOutput,
          totalTokens: dayTotal,
        },
      }),
      this.prisma.userAgentTokenUsage.upsert({
        where: { oauthId_agentName: { oauthId, agentName } },
        create: {
          oauthId,
          agentName,
          totalUsedInputTokens: lifeInput,
          totalUsedOutputTokens: lifeOutput,
          totalUsedTokens: lifeTotal,
          totalTokenLimit,
          totalTokensLeft: Math.max(0, totalTokenLimit - lifeTotal),
        },
        update: {
          totalUsedInputTokens: lifeInput,
          totalUsedOutputTokens: lifeOutput,
          totalUsedTokens: lifeTotal,
          totalTokensLeft: Math.max(0, totalTokenLimit - lifeTotal),
        },
      }),
    ]);

    // Team grants and membership pools covering this agent move by the same
    // signed amount.
    const signedDelta = {
      totalTokens: totalDelta,
      inputTokens: inputDelta,
      outputTokens: outputDelta,
    };
    if (options.syncTeamGrants !== false) {
      await applyAssignedTeamAgentDelta(
        this.prisma,
        oauthId,
        agentName,
        signedDelta,
      );
    }
    if (options.syncMembershipGrants !== false) {
      await syncAssignedMembershipPools(this.prisma, oauthId, agentName);
    }
  }

  async setDailyTokenUsage(
    email: string,
    agentName: AgentName,
    date: string,
    usage: SetDailyTokenUsageInput,
  ) {
    const inputTokens = Number(usage?.inputTokens);
    const outputTokens = Number(usage?.outputTokens);
    const totalTokens = inputTokens + outputTokens;

    if (
      !Number.isInteger(inputTokens) ||
      inputTokens < 0 ||
      !Number.isInteger(outputTokens) ||
      outputTokens < 0
    ) {
      throw new BadRequestException(
        'inputTokens and outputTokens must be non-negative integers',
      );
    }

    const oauthId = await this.resolveEmailToOauthId(email);
    const usageDate = this.parseDateParam(date);

    const existingUsage = await this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
      select: { totalTokenLimit: true, totalUsedTokens: true },
    });

    const totalTokenLimit = existingUsage?.totalTokenLimit ?? 100000;
    const nextTotalUsedTokens =
      (existingUsage?.totalUsedTokens ?? 0) + totalTokens;
    const totalTokensLeft = Math.max(0, totalTokenLimit - nextTotalUsedTokens);

    const [dailyTokenUsage] = await this.prisma.$transaction([
      this.prisma.dailyTokenUsage.upsert({
        where: {
          oauthId_agentName_date: { oauthId, agentName, date: usageDate },
        },
        create: {
          oauthId,
          agentName,
          date: usageDate,
          inputTokens,
          outputTokens,
          totalTokens,
        },
        update: {
          inputTokens: { increment: inputTokens },
          outputTokens: { increment: outputTokens },
          totalTokens: { increment: totalTokens },
        },
      }),
      this.prisma.userAgentTokenUsage.upsert({
        where: { oauthId_agentName: { oauthId, agentName } },
        create: {
          oauthId,
          agentName,
          totalUsedInputTokens: inputTokens,
          totalUsedOutputTokens: outputTokens,
          totalUsedTokens: totalTokens,
          totalTokenLimit,
          totalTokensLeft,
        },
        update: {
          totalUsedInputTokens: { increment: inputTokens },
          totalUsedOutputTokens: { increment: outputTokens },
          totalUsedTokens: { increment: totalTokens },
          totalTokensLeft,
        },
      }),
    ]);

    // A day's row may fall inside a membership's current cycle; the shared
    // pools are summed from these rows, so keep their rollup in line.
    await syncAssignedMembershipPools(this.prisma, oauthId, agentName);

    return dailyTokenUsage;
  }

  async countTextTokens(text: string): Promise<CountTextTokensResult> {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new BadRequestException('text must be a non-empty string');
    }

    try {
      const tokenCount = await this.anthropic.messages.countTokens({
        model: MODEL,
        messages: [{ role: 'user', content: text }],
      });

      return {
        model: MODEL,
        totalUsedInputTokens: tokenCount.input_tokens,
        totalUsedTokens: tokenCount.input_tokens,
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Claude token count error: ${err?.message}`,
      );
    }
  }

  async getUserUsage(email: string) {
    const oauthId = await this.resolveEmailToOauthId(email);

    return this.prisma.userAgentTokenUsage.findMany({
      where: { oauthId },
      orderBy: { totalUsedTokens: 'desc' },
    });
  }

  async getAgentUsage(email: string, agentName: AgentName) {
    const oauthId = await this.resolveEmailToOauthId(email);

    return this.prisma.userAgentTokenUsage.findUnique({
      where: { oauthId_agentName: { oauthId, agentName } },
    });
  }

  async getDailyTokenUsage(email: string, agentName: AgentName, date: string) {
    const oauthId = await this.resolveEmailToOauthId(email);
    const usageDate = this.parseDateParam(date);

    const dailyTokenUsage = await this.prisma.dailyTokenUsage.findUnique({
      where: {
        oauthId_agentName_date: { oauthId, agentName, date: usageDate },
      },
    });

    if (dailyTokenUsage) {
      return { ...dailyTokenUsage, recordExists: true };
    }

    return {
      id: null,
      oauthId,
      agentName,
      date: usageDate,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      createdAt: null,
      updatedAt: null,
      recordExists: false,
    };
  }

  async getAllUsage() {
    return this.prisma.userAgentTokenUsage.findMany({
      include: { user: { select: { email: true, username: true } } },
      orderBy: { totalUsedTokens: 'desc' },
    });
  }
}
