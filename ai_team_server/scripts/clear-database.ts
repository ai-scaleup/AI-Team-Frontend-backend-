/**
 * Delete every application row while preserving tables, schema, and Prisma's
 * migration history.
 *
 * Usage:
 *   npx ts-node scripts/clear-database.ts
 *   npx ts-node scripts/clear-database.ts --preserve-users
 */
import { Client } from 'pg';
import * as path from 'node:path';

function loadEnv() {
  try {
    process.loadEnvFile(path.join(process.cwd(), '.env'));
  } catch {
    // Render and CI inject environment variables without an .env file.
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function clearDatabase() {
  loadEnv();

  const preserveUsers = process.argv.includes('--preserve-users');
  const preservedTables = [
    '_prisma_migrations',
    ...(preserveUsers ? ['User', 'pearl_whitelabel_User'] : []),
  ];

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Neither DIRECT_URL nor DATABASE_URL is set.');
  }

  const target = new URL(connectionString);
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const identity = await client.query<{
      database_name: string;
      database_user: string;
    }>(
      'SELECT current_database() AS database_name, current_user AS database_user;',
    );

    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND NOT (table_name = ANY($1::text[]))
        ORDER BY table_name;`,
      [preservedTables],
    );
    const tables = rows.map((row) => row.table_name);

    console.log(
      `Target: ${identity.rows[0].database_name} on ${target.hostname}:${target.port || '5432'} as ${identity.rows[0].database_user}`,
    );
    console.log(
      `Clearing ${tables.length} application tables; preserving ${preservedTables.join(', ')}.`,
    );

    if (tables.length === 0) {
      console.log('No application tables found.');
      return;
    }

    let rowsBefore = 0;
    for (const table of tables) {
      const result = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)};`,
      );
      const count = Number(result.rows[0].count);
      rowsBefore += count;
      if (count > 0) console.log(`  ${table}: ${count} rows`);
    }

    await client.query('BEGIN;');
    try {
      const identifiers = tables.map(quoteIdentifier).join(', ');
      await client.query(
        `TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE;`,
      );
      await client.query('COMMIT;');
    } catch (error) {
      await client.query('ROLLBACK;');
      throw error;
    }

    let rowsAfter = 0;
    for (const table of tables) {
      const result = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)};`,
      );
      rowsAfter += Number(result.rows[0].count);
    }

    if (rowsAfter !== 0) {
      throw new Error(
        `Verification failed: ${rowsAfter} application rows remain.`,
      );
    }

    console.log(`Deleted ${rowsBefore} rows from the selected tables.`);

    if (preserveUsers) {
      const users = await client.query<{
        application_users: string;
        pearl_users: string;
      }>(
        `SELECT
           (SELECT COUNT(*)::text FROM "User") AS application_users,
           (SELECT COUNT(*)::text FROM "pearl_whitelabel_User") AS pearl_users;`,
      );
      console.log(
        `Preserved ${users.rows[0].application_users} application users and ${users.rows[0].pearl_users} Pearl users.`,
      );
    }
  } finally {
    await client.end();
  }
}

clearDatabase().catch((error) => {
  console.error(
    'Database clear failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
