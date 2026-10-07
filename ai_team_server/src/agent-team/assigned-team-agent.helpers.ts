// src/agent-team/assigned-team-agent.helpers.ts
//
// Plain functions over a Prisma client for the per-agent slice of a team
// grant (AssignedTeamAgent). They are shared by the team CRUD path (roster
// changes), the team assignment path (limits) and the token ledger (usage),
// which sit in different modules, so they live here rather than on one
// service.
import { AgentName, Prisma } from 'src/generated/prisma/client';

type Db = Prisma.TransactionClient;

export const tokensLeftFor = (tokenLimit: number | null, usedTokens: number) =>
  tokenLimit === null ? null : Math.max(0, tokenLimit - usedTokens);

/**
 * Re-derives a grant's rollup from its agent rows. Every write to an
 * AssignedTeamAgent row ends here so the two levels cannot drift. The grant's
 * tokensLeft is the SUM of what each agent still has (null while no agent
 * row carries a limit, i.e. the grant is access only).
 */
export async function refreshAssignedTeamRollup(
  db: Db,
  assignedTeamId: string,
) {
  const agg = await db.assignedTeamAgent.aggregate({
    where: { assignedTeamId },
    _sum: {
      usedTokens: true,
      inputTokens: true,
      outputTokens: true,
      tokensLeft: true,
    },
    _count: { tokenLimit: true },
  });
  await db.assignedTeam.update({
    where: { id: assignedTeamId },
    data: {
      usedTokens: agg._sum.usedTokens ?? 0,
      inputTokens: agg._sum.inputTokens ?? 0,
      outputTokens: agg._sum.outputTokens ?? 0,
      tokensLeft: agg._count.tokenLimit > 0 ? (agg._sum.tokensLeft ?? 0) : null,
    },
  });
}

/**
 * Brings every grant of a team in line with the team's current roster:
 * agents added to the team get a row seeded with the grant's per-agent
 * limit, agents removed from the team lose theirs.
 *
 * Runs inside the team PATCH transaction against a remote pooler, so the
 * roster change is applied to all grants at once rather than grant by grant:
 * a per-grant loop of four round trips pushed a team with a handful of
 * grants past the interactive transaction timeout.
 */
export async function syncAssignedTeamAgents(
  db: Db,
  teamId: string,
  agentNames: AgentName[],
) {
  const grants = await db.assignedTeam.findMany({
    where: { teamId },
    select: { id: true, tokenLimit: true },
  });
  if (grants.length === 0) return;
  const grantIds = grants.map((g) => g.id);

  await db.assignedTeamAgent.deleteMany({
    where: {
      assignedTeamId: { in: grantIds },
      agentName: { notIn: agentNames },
    },
  });
  if (agentNames.length) {
    await db.assignedTeamAgent.createMany({
      data: grants.flatMap((grant) =>
        agentNames.map((agentName) => ({
          assignedTeamId: grant.id,
          agentName,
          tokenLimit: grant.tokenLimit,
          tokensLeft: grant.tokenLimit,
        })),
      ),
      skipDuplicates: true,
    });
  }

  // Same rollup as refreshAssignedTeamRollup, aggregated for all grants in
  // one query. A grant left with no agent rows is absent from the result and
  // rolls up to zero usage, access only.
  const sums = await db.assignedTeamAgent.groupBy({
    by: ['assignedTeamId'],
    where: { assignedTeamId: { in: grantIds } },
    _sum: {
      usedTokens: true,
      inputTokens: true,
      outputTokens: true,
      tokensLeft: true,
    },
    _count: { tokenLimit: true },
  });
  const byGrant = new Map(sums.map((s) => [s.assignedTeamId, s]));

  for (const grantId of grantIds) {
    const agg = byGrant.get(grantId);
    await db.assignedTeam.update({
      where: { id: grantId },
      data: {
        usedTokens: agg?._sum.usedTokens ?? 0,
        inputTokens: agg?._sum.inputTokens ?? 0,
        outputTokens: agg?._sum.outputTokens ?? 0,
        tokensLeft:
          agg && agg._count.tokenLimit > 0 ? (agg._sum.tokensLeft ?? 0) : null,
      },
    });
  }
}

/**
 * Moves the spend of every live team grant that covers (user, agent) by a
 * signed delta. Called by the token ledger so the per-agent team figures
 * follow real usage without the chat having to know which tier granted the
 * agent. Counters floor at 0; tokenLimit is never touched.
 */
export async function applyAssignedTeamAgentDelta(
  db: Db,
  oauthId: string,
  agentName: AgentName,
  delta: { totalTokens: number; inputTokens: number; outputTokens: number },
) {
  const now = new Date();
  const rows = await db.assignedTeamAgent.findMany({
    where: {
      agentName,
      grant: {
        user: { oauthId },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
    select: {
      id: true,
      assignedTeamId: true,
      tokenLimit: true,
      usedTokens: true,
      inputTokens: true,
      outputTokens: true,
    },
  });
  if (rows.length === 0) return;

  const floor = (current: number, change: number) =>
    Math.max(0, current + change);

  for (const row of rows) {
    const usedTokens = floor(row.usedTokens, delta.totalTokens);
    await db.assignedTeamAgent.update({
      where: { id: row.id },
      data: {
        usedTokens,
        inputTokens: floor(row.inputTokens, delta.inputTokens),
        outputTokens: floor(row.outputTokens, delta.outputTokens),
        tokensLeft: tokensLeftFor(row.tokenLimit, usedTokens),
      },
    });
  }
  for (const grantId of new Set(rows.map((r) => r.assignedTeamId))) {
    await refreshAssignedTeamRollup(db, grantId);
  }
}
