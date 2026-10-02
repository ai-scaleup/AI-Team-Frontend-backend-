// src/membership/assigned-membership.helpers.ts
//
// Plain functions over a Prisma client for the SHARED token pool of a
// membership grant (AssignedMembership). Every agent a membership reaches --
// its single agents and the agents of its teams -- draws on the same pool,
// so a chat with ALEX and a chat with LARA both count against the one figure.
//
// The pool is DERIVED FROM THE LEDGER: its spend is the sum of what every
// covered agent has in DailyTokenUsage since the start of the current 30-day
// cycle's day. That is the same window the per-agent quota is enforced on,
// and it means a chat that happened earlier the same day the membership was
// assigned (or before the backend restarted) is never missed. The columns on
// the row (usedTokens / inputTokens / outputTokens / tokensLeft /
// cycleStartsAt) are a rollup of that sum, refreshed whenever the ledger
// moves through the token service or a membership endpoint.
//
// The token ledger (TokenUsageService), the membership endpoints and the
// admin dashboard all sit in different modules, so the pool maths lives here
// rather than on one service.
import { AgentName, Prisma } from 'src/generated/prisma/client';
import { resolveTemplateAgents } from './membership.service';

type Db = Prisma.TransactionClient;

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const CYCLE_DAYS = 30;

/** Midnight UTC of a day, the shape dailyTokenUsage stores its dates in. */
const startOfUtcDay = (value: Date) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

/** The template fields the pool needs: its allowance and the agents it reaches. */
export const membershipPoolTemplateSelect = {
  id: true,
  name: true,
  monthlyTokenLimit: true,
  includedAgents: true,
  includedTeams: {
    select: {
      team: {
        select: { isActive: true, agents: { select: { agentName: true } } },
      },
    },
  },
} satisfies Prisma.MembershipTemplateSelect;

type PoolTemplate = Prisma.MembershipTemplateGetPayload<{
  select: typeof membershipPoolTemplateSelect;
}>;

/** The grant columns the pool maths reads. */
export type MembershipPoolRow = {
  id: string;
  startsAt: Date;
  cycleStartsAt: Date;
  monthlyTokenLimit: number | null;
  template: PoolTemplate;
};

/** The pool figures for one grant as the ledger has them right now. */
export type MembershipPoolFigures = {
  cycleStartsAt: Date;
  usedTokens: number;
  inputTokens: number;
  outputTokens: number;
  tokensLeft: number | null;
};

export const tokensLeftFor = (limit: number | null, usedTokens: number) =>
  limit === null ? null : Math.max(0, limit - usedTokens);

/** The shared allowance: the grant's override, else the template figure. */
export const membershipPoolLimit = (row: {
  monthlyTokenLimit: number | null;
  template: { monthlyTokenLimit: number };
}) => row.monthlyTokenLimit ?? row.template.monthlyTokenLimit;

/**
 * Start of the 30-day cycle a grant is in right now, counted from when the
 * grant started. The allowance is "per month", so the pool is measured over
 * this window and starts again at the next one.
 */
export function currentMembershipCycleStart(startsAt: Date, now = new Date()) {
  const daysSince = Math.max(
    0,
    Math.floor((now.getTime() - startsAt.getTime()) / MS_PER_DAY),
  );
  const cycles = Math.floor(daysSince / CYCLE_DAYS);
  return new Date(startsAt.getTime() + cycles * CYCLE_DAYS * MS_PER_DAY);
}

/**
 * The day the pool's ledger window opens on. The ledger is per calendar
 * day (UTC), so the cycle boundary is snapped to the start of its day --
 * otherwise a membership assigned this afternoon would ignore what its
 * agents spent this morning.
 */
export const membershipCycleLedgerFrom = (cycleStartsAt: Date) =>
  startOfUtcDay(cycleStartsAt);

/** Whether the membership reaches this agent (single agent or team agent). */
export const membershipCoversAgent = (
  template: Pick<PoolTemplate, 'includedAgents' | 'includedTeams'>,
  agentName: AgentName,
) => resolveTemplateAgents(template).includes(agentName);

export type LedgerRow = {
  agentName: AgentName;
  date: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/**
 * Sums the ledger rows that fall inside a grant's current cycle for the
 * agents it covers. Pure: the caller loads the rows once for the user and
 * this is applied per grant.
 */
export function poolFiguresFromLedger(
  row: MembershipPoolRow,
  ledger: LedgerRow[],
  now = new Date(),
): MembershipPoolFigures {
  const cycleStartsAt = currentMembershipCycleStart(row.startsAt, now);
  const from = membershipCycleLedgerFrom(cycleStartsAt);
  const agents = new Set<AgentName>(resolveTemplateAgents(row.template));

  let inputTokens = 0;
  let outputTokens = 0;
  let usedTokens = 0;
  for (const entry of ledger) {
    if (entry.date < from || !agents.has(entry.agentName)) continue;
    inputTokens += entry.inputTokens;
    outputTokens += entry.outputTokens;
    usedTokens += entry.totalTokens;
  }

  return {
    cycleStartsAt,
    usedTokens,
    inputTokens,
    outputTokens,
    tokensLeft: tokensLeftFor(membershipPoolLimit(row), usedTokens),
  };
}

/**
 * Loads the ledger rows that can fall inside any of the given grants'
 * cycles: one query for the user, from the earliest cycle day.
 */
export async function loadMembershipLedger(
  db: Db,
  oauthId: string,
  rows: MembershipPoolRow[],
  now = new Date(),
): Promise<LedgerRow[]> {
  if (rows.length === 0) return [];
  const from = rows
    .map((row) =>
      membershipCycleLedgerFrom(currentMembershipCycleStart(row.startsAt, now)),
    )
    .reduce((earliest, d) => (d < earliest ? d : earliest));
  return db.dailyTokenUsage.findMany({
    where: { oauthId, date: { gte: from } },
    select: {
      agentName: true,
      date: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
    },
  });
}

/**
 * The pool figures of several grants of one user, computed from the ledger
 * without writing anything. Keyed by grant id.
 */
export async function computeMembershipPools<T extends MembershipPoolRow>(
  db: Db,
  oauthId: string,
  rows: T[],
  now = new Date(),
): Promise<Map<string, MembershipPoolFigures>> {
  const ledger = await loadMembershipLedger(db, oauthId, rows, now);
  return membershipPoolsFromLedger(rows, ledger, now);
}

/**
 * {@link computeMembershipPools} over ledger rows the caller already holds.
 * The ledger must reach back to every grant's cycle start; rows before it
 * are ignored.
 */
export function membershipPoolsFromLedger(
  rows: MembershipPoolRow[],
  ledger: LedgerRow[],
  now = new Date(),
): Map<string, MembershipPoolFigures> {
  return new Map(
    rows.map((row) => [row.id, poolFiguresFromLedger(row, ledger, now)]),
  );
}

/** A grant with its pool figures overlaid, as every read returns it. */
export async function withComputedPools<T extends MembershipPoolRow>(
  db: Db,
  oauthId: string,
  rows: T[],
  now = new Date(),
): Promise<(T & MembershipPoolFigures)[]> {
  const pools = await computeMembershipPools(db, oauthId, rows, now);
  return rows.map((row) => ({ ...row, ...pools.get(row.id)! }));
}

/**
 * Re-derives one grant's stored rollup from the ledger and persists it. The
 * allowance is never touched. Returns the figures written.
 */
export async function refreshMembershipPool(
  db: Db,
  oauthId: string,
  row: MembershipPoolRow,
  now = new Date(),
): Promise<MembershipPoolFigures> {
  const [figures] = (await withComputedPools(db, oauthId, [row], now)).map(
    ({ cycleStartsAt, usedTokens, inputTokens, outputTokens, tokensLeft }) => ({
      cycleStartsAt,
      usedTokens,
      inputTokens,
      outputTokens,
      tokensLeft,
    }),
  );
  await db.assignedMembership.update({
    where: { id: row.id },
    data: figures,
  });
  return figures;
}

/**
 * Every live membership grant of the user that reaches the agent. "Live" is
 * active and not expired; whether the agent is covered is decided from the
 * template, which is why the rows come back with their template attached.
 */
export async function findLiveMembershipsForAgent(
  db: Db,
  oauthId: string,
  agentName: AgentName,
  now = new Date(),
): Promise<MembershipPoolRow[]> {
  const rows = await db.assignedMembership.findMany({
    where: {
      user: { oauthId },
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      startsAt: true,
      cycleStartsAt: true,
      monthlyTokenLimit: true,
      template: { select: membershipPoolTemplateSelect },
    },
  });
  return rows.filter((row) => membershipCoversAgent(row.template, agentName));
}

/**
 * Brings the stored rollup of every live membership grant covering
 * (user, agent) back in line with the ledger. Called by the token ledger
 * AFTER it has written a chat's spend, so the pool follows real usage no
 * matter which of the membership's agents was chatting -- that is what
 * makes the allowance shared.
 */
export async function syncAssignedMembershipPools(
  db: Db,
  oauthId: string,
  agentName: AgentName,
) {
  const now = new Date();
  const rows = await findLiveMembershipsForAgent(db, oauthId, agentName, now);
  if (rows.length === 0) return;
  const pools = await computeMembershipPools(db, oauthId, rows, now);
  for (const row of rows) {
    await db.assignedMembership.update({
      where: { id: row.id },
      data: pools.get(row.id)!,
    });
  }
}
