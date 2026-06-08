import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkExternalAccount = {
  provider?: string;
  provider_user_id?: string;
};

type ClerkUser = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  external_accounts?: ClerkExternalAccount[];
};

type PreferenceRow = {
  id: string;
  oauthId: string;
  agentName: string;
  email?: string | null;
};

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // The script can still use shell-provided env vars.
    }
  }
}

function readProductionClerkKey() {
  const activeKey = process.env.CLERK_SECRET_KEY;
  if (activeKey?.startsWith('sk_live_')) return activeKey;

  const envPath = path.join(process.cwd(), '.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  const commentedLiveKey = envText.match(
    /^#\s*CLERK_SECRET_KEY=(sk_live_[^\r\n]+)/m,
  )?.[1];

  if (!commentedLiveKey) {
    throw new Error('Production CLERK_SECRET_KEY was not found.');
  }

  return commentedLiveKey;
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getPrimaryEmail(user: ClerkUser) {
  const emails = user.email_addresses ?? [];
  const primaryEmail = emails.find(
    (email) => email.id === user.primary_email_address_id,
  );

  return primaryEmail?.email_address ?? emails[0]?.email_address ?? null;
}

async function fetchAllClerkUsers(secretKey: string) {
  const users: ClerkUser[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const response = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Clerk API error ${response.status}: ${error}`);
    }

    const batch = (await response.json()) as ClerkUser[];
    if (batch.length === 0) break;

    users.push(...batch);
    offset += limit;

    if (batch.length < limit) break;
  }

  return users;
}

function buildOauthEmailMap(users: ClerkUser[]) {
  const oauthIdToEmail = new Map<string, string>();

  for (const user of users) {
    const email = getPrimaryEmail(user);
    if (!email) continue;

    oauthIdToEmail.set(user.id, email);

    for (const account of user.external_accounts ?? []) {
      if (account.provider_user_id) {
        oauthIdToEmail.set(account.provider_user_id, email);
      }
    }
  }

  return oauthIdToEmail;
}

async function main() {
  loadEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const clerkSecretKey = readProductionClerkKey();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    console.log('Fetching production Clerk users...');
    const clerkUsers = await fetchAllClerkUsers(clerkSecretKey);
    const oauthIdToEmail = buildOauthEmailMap(clerkUsers);

    console.log('Creating UserPreference backup before update...');
    const beforeResult = await client.query<PreferenceRow>(
      'SELECT * FROM public."UserPreference" ORDER BY "oauthId", "agentName"',
    );

    const backupDir = path.join(process.cwd(), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const backupPath = path.join(
      backupDir,
      `UserPreference-before-email-backfill-${getTimestamp()}.json`,
    );
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          rowCount: beforeResult.rowCount,
          rows: beforeResult.rows,
        },
        null,
        2,
      ),
      'utf8',
    );

    await client.query('BEGIN');
    await client.query(
      'ALTER TABLE public."UserPreference" ADD COLUMN IF NOT EXISTS "email" text',
    );

    let updated = 0;
    let alreadyCorrect = 0;
    const unresolvedOauthIds = new Set<string>();

    for (const preference of beforeResult.rows) {
      const email = oauthIdToEmail.get(preference.oauthId);

      if (!email) {
        unresolvedOauthIds.add(preference.oauthId);
        continue;
      }

      if (preference.email?.toLowerCase() === email.toLowerCase()) {
        alreadyCorrect++;
        continue;
      }

      const result = await client.query(
        'UPDATE public."UserPreference" SET "email" = $1 WHERE "id" = $2 AND "oauthId" = $3',
        [email, preference.id, preference.oauthId],
      );
      updated += result.rowCount ?? 0;
    }

    await client.query(
      'CREATE INDEX IF NOT EXISTS "UserPreference_email_idx" ON public."UserPreference" ("email")',
    );
    await client.query('COMMIT');

    const afterResult = await client.query<PreferenceRow>(
      'SELECT "id", "oauthId", "agentName", "email" FROM public."UserPreference" ORDER BY "oauthId", "agentName"',
    );

    const reportPath = path.join(
      backupDir,
      `UserPreference-email-backfill-report-${getTimestamp()}.json`,
    );
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          backupPath,
          clerkUsers: clerkUsers.length,
          totalPreferenceRows: beforeResult.rowCount,
          updated,
          alreadyCorrect,
          unresolvedOauthIds: [...unresolvedOauthIds].sort(),
          rows: afterResult.rows,
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log('\nUserPreference email backfill complete.');
    console.log(`Backup: ${backupPath}`);
    console.log(`Report: ${reportPath}`);
    console.log(`Clerk users fetched: ${clerkUsers.length}`);
    console.log(`Preference rows checked: ${beforeResult.rowCount}`);
    console.log(`Rows updated: ${updated}`);
    console.log(`Already correct: ${alreadyCorrect}`);
    console.log(`Unresolved oauthIds: ${unresolvedOauthIds.size}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
