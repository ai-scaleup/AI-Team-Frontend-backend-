/**
 * Full database backup -> backups/backup-<timestamp>.json
 *
 * READ-ONLY: issues nothing but SELECTs. It can never modify the database.
 *
 * Tables are discovered from the Postgres catalog rather than hardcoded, so a
 * newly added model is picked up automatically. (The older export scripts
 * hardcoded their table lists and silently drifted to covering 7 of 21 models.)
 *
 * Rows are streamed to disk one at a time — the dump is far larger than we want
 * to hold in memory as a single string.
 *
 * Usage: npm run backup:db
 */
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  try {
    process.loadEnvFile(envPath);
  } catch {
    // No .env (CI / production) — rely on platform-injected env vars.
  }
}

/**
 * Parent-before-child, so a restore can insert in file order without tripping
 * foreign keys. Tables not listed here are appended alphabetically.
 *
 * These are physical table names, not Prisma model names — the chat log and
 * lead models carry @@map, so their table names are snake_case.
 */
const RESTORE_ORDER = [
  'User',
  'UserPreference',
  'AgentGroup',
  'AgentGroupItem',
  'AssignedAgent',
  'AssignedGroup',
  'MembershipTemplate',
  'AssignedMembership',
  'Conversation',
  'Message',
  'chat_logs',
  'metis_chat_logs',
  'chiara_leads',
  'chiara_inbound_chat_logs',
  'freap_chiara_inbound_chat_logs',
  'freap_jennifer_chat_logs',
  'TagField',
  'Tag',
  'UserAgentTokenUsage',
  'DailyTokenUsage',
  'TokenUsageAlertRule',
  'TokenLimitStopLog',
  'UserAlert',
];

function orderTables(found: string[]): string[] {
  const known = RESTORE_ORDER.filter((t) => found.includes(t));
  const extra = found.filter((t) => !RESTORE_ORDER.includes(t)).sort();
  return [...known, ...extra];
}

async function backupDatabase() {
  loadEnv();

  // DIRECT_URL bypasses the transaction-mode pooler; either works for reads.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Neither DIRECT_URL nor DATABASE_URL is set.');
  }

  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(backupDir, `backup-${stamp}.json`);
  // Write to a temp file and rename at the end, so an interrupted run never
  // leaves behind a truncated file that looks like a usable backup.
  const tempPath = `${outputPath}.partial`;

  const client = new Client({ connectionString });
  await client.connect();

  const out = fs.createWriteStream(tempPath, { encoding: 'utf-8' });
  const write = (chunk: string) =>
    new Promise<void>((resolve, reject) => {
      out.write(chunk, (err) => (err ? reject(err) : resolve()));
    });

  const counts: Record<string, number> = {};

  try {
    const { rows: tableRows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`,
    );
    const tables = orderTables(tableRows.map((r) => r.table_name));

    console.log(`Backing up ${tables.length} tables...\n`);

    await write(`{\n  "exportedAt": ${JSON.stringify(startedAt.toISOString())},\n`);
    await write(`  "tableOrder": ${JSON.stringify(tables)},\n`);
    await write('  "tables": {\n');

    for (const [index, table] of tables.entries()) {
      // Identifier is quoted for case-sensitivity; it comes from the catalog,
      // not from user input.
      const { rows } = await client.query(`SELECT * FROM "${table}";`);
      counts[table] = rows.length;

      await write(`    ${JSON.stringify(table)}: {\n`);
      await write(`      "count": ${rows.length},\n`);
      await write('      "data": [');
      for (const [rowIndex, row] of rows.entries()) {
        await write(`${rowIndex === 0 ? '' : ','}\n        ${JSON.stringify(row)}`);
      }
      await write(rows.length ? '\n      ]\n' : ']\n');
      await write(`    }${index === tables.length - 1 ? '' : ','}\n`);

      console.log(`  ${table.padEnd(24)} ${rows.length} rows`);
    }

    await write('  }\n}\n');
  } catch (error) {
    out.destroy();
    fs.rmSync(tempPath, { force: true });
    throw error;
  } finally {
    await client.end();
  }

  await new Promise<void>((resolve, reject) => {
    out.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });

  fs.renameSync(tempPath, outputPath);

  const sizeMb = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  console.log(`\nBackup complete: ${total} rows across ${Object.keys(counts).length} tables`);
  console.log(`Saved to: ${outputPath} (${sizeMb} MB)`);
  console.log('\nThis file contains production user data. Keep it out of git.');
}

backupDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
