/**
 * Applies prisma/manual/20261002_prod_additive_upgrade.sql in ONE transaction
 * and commits only if nothing was lost.
 *
 * Before the SQL runs it records, for every table, the row count and a content
 * fingerprint (md5 over every row). After the SQL it checks that
 *   - every table that existed before has the same rows, byte for byte
 *     (AssignedAgent is compared with SingleAssignedAgent and with the
 *     compatibility view, the membership grants on their original columns);
 *   - the copies are complete (teams = groups, team agents = group items, ...);
 *   - the compatibility view accepts the writes the deployed server issues
 *     (tried inside a savepoint that is rolled back).
 * Any failed check, or any SQL error, rolls the whole transaction back.
 *
 * Usage:
 *   ts-node scripts/apply-prod-additive-upgrade.ts --project <ref>            dry run, always rolls back
 *   ts-node scripts/apply-prod-additive-upgrade.ts --project <ref> --apply    commits when every check passes
 *
 * --project is the Supabase project ref in DIRECT_URL; the script refuses to
 * run against any other database.
 */
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SQL_FILE = path.join('prisma', 'manual', '20261002_prod_additive_upgrade.sql');

function loadEnv() {
  try {
    process.loadEnvFile(path.join(process.cwd(), '.env'));
  } catch {
    // No .env — rely on platform-injected env vars.
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

type Snapshot = Record<string, { count: number; fingerprint: string }>;

async function main() {
  loadEnv();
  const apply = process.argv.includes('--apply');
  const expectedProject = arg('--project');
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) throw new Error('DIRECT_URL is not set');
  const project = new URL(directUrl).username.split('.')[1] ?? '(unknown)';
  if (!expectedProject || expectedProject !== project) {
    throw new Error(
      `DIRECT_URL points at project "${project}" but --project is "${expectedProject}". Refusing to run.`,
    );
  }

  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const forbidden = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .filter((line) => /\b(DROP|TRUNCATE|DELETE)\b/i.test(line) && !/ON DELETE CASCADE/i.test(line));
  if (forbidden.length) {
    throw new Error(`Destructive statement in ${SQL_FILE}:\n${forbidden.join('\n')}`);
  }

  const client = new Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const rows = async <T = any>(text: string, params?: unknown[]): Promise<T[]> =>
    (await client.query(text, params)).rows;
  const one = async (text: string, params?: unknown[]): Promise<any> => (await rows(text, params))[0];

  // Fingerprint of a relation: md5 over the md5 of every row, in a stable order.
  const fingerprint = async (relation: string, columns: string) =>
    (
      await one(
        `SELECT count(*)::int AS count,
                COALESCE(md5(string_agg(md5(ROW(${columns})::text), '' ORDER BY md5(ROW(${columns})::text))), '') AS fingerprint
           FROM "${relation}" t`,
      )
    ) as { count: number; fingerprint: string };

  const tableNames = async () =>
    (
      await rows<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`,
      )
    ).map((r) => r.tablename);

  const columnsOf = async (table: string) =>
    (
      await rows<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      )
    ).map((r) => `t."${r.column_name}"`);

  const failures: string[] = [];
  const check = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
    if (!ok) failures.push(label);
  };

  console.log(`project ${project} — ${apply ? 'APPLY' : 'DRY RUN (will roll back)'}`);
  let committed = false;
  try {
    // One snapshot for the whole run, so rows the live server writes meanwhile
    // cannot make the before/after comparison differ.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    // Give up rather than queue behind a long-running query on a live table.
    await client.query(`SET LOCAL lock_timeout = '10s'`);
    await client.query(`SET LOCAL statement_timeout = '180s'`);

    // ── before ──────────────────────────────────────────────
    const before: Snapshot = {};
    const beforeColumns: Record<string, string> = {};
    for (const table of await tableNames()) {
      if (table === '_prisma_migrations') continue;
      beforeColumns[table] = (await columnsOf(table)).join(', ');
      before[table] = await fingerprint(table, beforeColumns[table]);
    }
    const alreadyRenamed = !('AssignedAgent' in before);
    const expected = {
      teamAgentRows: (
        await one(
          `SELECT count(*)::int n FROM "AssignedGroup" g JOIN "AgentGroupItem" i ON i."groupId" = g."groupId"`,
        )
      ).n as number,
      activeMembershipLinks: (
        await one(`SELECT count(*)::int n FROM "MembershipTemplateGroup" WHERE "isActive"`)
      ).n as number,
    };
    console.log(`captured ${Object.keys(before).length} tables before the change`);

    // ── the change ──────────────────────────────────────────
    await client.query(sql);

    // ── after ───────────────────────────────────────────────
    console.log('existing tables, same rows as before:');
    for (const [table, was] of Object.entries(before)) {
      if (table === 'AssignedAgent') continue; // renamed, checked below
      const now = await fingerprint(table, beforeColumns[table]);
      check(
        now.count === was.count && now.fingerprint === was.fingerprint,
        `${table}: ${was.count} rows -> ${now.count}`,
      );
    }

    if (!alreadyRenamed) {
      console.log('AssignedAgent -> SingleAssignedAgent:');
      const was = before['AssignedAgent'];
      const renamedColumns = beforeColumns['AssignedAgent'].replace(
        't."monthlyTokenLimit"',
        't."tokenLimit"',
      );
      const table = await fingerprint('SingleAssignedAgent', renamedColumns);
      check(
        table.count === was.count && table.fingerprint === was.fingerprint,
        `SingleAssignedAgent holds the same ${was.count} rows`,
      );
      const view = await fingerprint('AssignedAgent', beforeColumns['AssignedAgent']);
      check(
        view.count === was.count && view.fingerprint === was.fingerprint,
        `compatibility view "AssignedAgent" returns the same ${was.count} rows under the old column names`,
      );
    }

    console.log('copies:');
    const n = async (table: string) => (await one(`SELECT count(*)::int n FROM "${table}"`)).n as number;
    check((await n('AgentTeam')) === before['AgentGroup'].count, `AgentTeam = AgentGroup (${before['AgentGroup'].count})`);
    check(
      (await n('AgentTeamAgent')) === before['AgentGroupItem'].count,
      `AgentTeamAgent = AgentGroupItem (${before['AgentGroupItem'].count})`,
    );
    check(
      (await n('AssignedTeam')) === before['AssignedGroup'].count,
      `AssignedTeam = AssignedGroup (${before['AssignedGroup'].count})`,
    );
    check(
      (await n('AssignedTeamAgent')) === expected.teamAgentRows,
      `AssignedTeamAgent = one row per grant and team agent (${expected.teamAgentRows})`,
    );
    check(
      (await n('MembershipTemplateTeam')) === expected.activeMembershipLinks,
      `MembershipTemplateTeam = active MembershipTemplateGroup links (${expected.activeMembershipLinks})`,
    );
    const mismatched = await one(
      `SELECT count(*)::int n
         FROM "AssignedGroup" g
         LEFT JOIN "AssignedTeam" t ON t."id" = g."id"
        WHERE t."id" IS NULL
           OR t."userId" <> g."userId" OR t."teamId" <> g."groupId"
           OR t."isActive" <> g."isActive"
           OR t."startsAt" <> g."startsAt"
           OR t."expiresAt" IS DISTINCT FROM g."expiresAt"
           OR t."durationDays" IS DISTINCT FROM g."durationDays"
           OR t."tokenLimit" IS DISTINCT FROM g."monthlyTokenLimit"`,
    );
    check(mismatched.n === 0, 'every AssignedGroup row has an identical AssignedTeam row');

    console.log('schema:');
    check(
      (await one(
        `SELECT count(*)::int n FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'AgentName' AND e.enumlabel = 'LUCA'`,
      )).n === 1,
      'AgentName has LUCA',
    );
    const newTables = [
      'SingleAssignedAgent', 'AgentTeam', 'AgentTeamAgent', 'AssignedTeam', 'AssignedTeamAgent',
      'MembershipTemplateTeam', 'GrantTokenUsageDaily', 'CompactionSettings', 'CompactionState',
      'CompactionTurn', 'CompactionSummary', 'CompactionEvent',
    ];
    const present = new Set(await tableNames());
    check(newTables.every((t) => present.has(t)), `all ${newTables.length} tables of the new schema exist`);
    check(
      Object.keys(before).every((t) => t === 'AssignedAgent' || present.has(t)),
      'no table that existed before is gone',
    );

    console.log('compatibility view accepts the old server\'s writes (savepoint, rolled back):');
    await client.query('SAVEPOINT view_writes');
    try {
      const user = await one(`SELECT id FROM "User" LIMIT 1`);
      const id = 'upgrade-check-' + Date.now();
      await client.query(
        `INSERT INTO "AssignedAgent" ("id", "userId", "agentName", "monthlyTokenLimit", "updatedAt")
         VALUES ($1, $2, 'JIM', 123, CURRENT_TIMESTAMP)`,
        [id, user.id],
      );
      await client.query(`UPDATE "AssignedAgent" SET "monthlyTokenLimit" = 456, "isActive" = false WHERE "id" = $1`, [id]);
      const row = await one(
        `SELECT "tokenLimit", "isActive", "usedTokens", "threshold50Notified" FROM "SingleAssignedAgent" WHERE "id" = $1`,
        [id],
      );
      check(
        row?.tokenLimit === 456 && row.isActive === false && row.usedTokens === 0 && row.threshold50Notified === false,
        'insert + update through the view reach SingleAssignedAgent, defaults filled in',
      );
      const deleted = await client.query(`DELETE FROM "AssignedAgent" WHERE "id" = $1`, [id]);
      check(deleted.rowCount === 1, 'delete through the view works');
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT view_writes');
    }

    if (failures.length) {
      console.log(`\n${failures.length} check(s) FAILED — rolling back, the database is unchanged.`);
      await client.query('ROLLBACK');
      process.exitCode = 1;
    } else if (!apply) {
      console.log('\nAll checks passed. DRY RUN — rolling back, the database is unchanged.');
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
      committed = true;
      console.log('\nAll checks passed. COMMITTED.');
    }
  } catch (error) {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    console.error('\nERROR — rolled back, the database is unchanged.');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
