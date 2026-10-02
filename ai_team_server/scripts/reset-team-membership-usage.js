/**
 * Zero the team and membership token usage for ONE user, leaving their
 * single-agent grants (SingleAssignedAgent) untouched.
 *
 *   node scripts/reset-team-membership-usage.js user@example.com
 *
 * - AssignedTeamAgent / AssignedTeam: used/input/output -> 0, tokensLeft back to the limit
 * - AssignedMembership: used/input/output -> 0, tokensLeft back to the limit, alert flags cleared
 * - DailyTokenUsage rows for the user are deleted (the membership pool is recomputed
 *   from this ledger, so it must go too or the next chat restores the old total)
 * - UserAgentTokenUsage lifetime counters -> 0
 *
 * Every affected row is written to scripts/backups/ as JSON before anything changes,
 * and all writes run in one transaction.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/reset-team-membership-usage.js <email>');
  process.exit(1);
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL });
  await c.connect();

  const [user] = (await c.query(`select id, "oauthId" from "User" where email = $1`, [email])).rows;
  if (!user) throw new Error(`User ${email} not found`);

  const byUser = async (sql) => (await c.query(sql, [user.id])).rows;
  const byOauth = async (sql) => (await c.query(sql, [user.oauthId])).rows;
  const backup = {
    email,
    user,
    AssignedTeam: await byUser(`select * from "AssignedTeam" where "userId" = $1`),
    AssignedTeamAgent: await byUser(
      `select ta.* from "AssignedTeamAgent" ta join "AssignedTeam" a on a.id = ta."assignedTeamId" where a."userId" = $1`,
    ),
    AssignedMembership: await byUser(`select * from "AssignedMembership" where "userId" = $1`),
    DailyTokenUsage: await byOauth(`select * from "DailyTokenUsage" where "oauthId" = $1`),
    UserAgentTokenUsage: await byOauth(`select * from "UserAgentTokenUsage" where "oauthId" = $1`),
  };
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `token-reset-${email}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log('Backup written to', file);

  await c.query('begin');
  try {
    const res = {};
    res.teamAgents = (await c.query(
      `update "AssignedTeamAgent" ta
          set "usedTokens" = 0, "inputTokens" = 0, "outputTokens" = 0,
              "tokensLeft" = ta."tokenLimit", "updatedAt" = now()
         from "AssignedTeam" a
        where a.id = ta."assignedTeamId" and a."userId" = $1`,
      [user.id],
    )).rowCount;
    res.teams = (await c.query(
      `update "AssignedTeam" a
          set "usedTokens" = 0, "inputTokens" = 0, "outputTokens" = 0,
              "tokensLeft" = (select case when count("tokenLimit") = 0 then null else sum("tokenLimit") end
                                from "AssignedTeamAgent" where "assignedTeamId" = a.id),
              "updatedAt" = now()
        where a."userId" = $1`,
      [user.id],
    )).rowCount;
    res.memberships = (await c.query(
      `update "AssignedMembership" m
          set "usedTokens" = 0, "inputTokens" = 0, "outputTokens" = 0,
              "tokensLeft" = coalesce(m."monthlyTokenLimit",
                (select "monthlyTokenLimit" from "MembershipTemplate" where id = m."membershipTemplateId")),
              "threshold50Notified" = false, "threshold80Notified" = false,
              "threshold90Notified" = false, "threshold100Notified" = false,
              "updatedAt" = now()
        where m."userId" = $1`,
      [user.id],
    )).rowCount;
    res.dailyRowsDeleted = (await c.query(
      `delete from "DailyTokenUsage" where "oauthId" = $1`,
      [user.oauthId],
    )).rowCount;
    res.lifetimeCounters = (await c.query(
      `update "UserAgentTokenUsage"
          set "totalUsedInputTokens" = 0, "totalUsedOutputTokens" = 0, "totalUsedTokens" = 0,
              "totalTokensLeft" = "totalTokenLimit", "updatedAt" = now()
        where "oauthId" = $1`,
      [user.oauthId],
    )).rowCount;
    await c.query('commit');
    console.log('Rows affected:', res);
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
