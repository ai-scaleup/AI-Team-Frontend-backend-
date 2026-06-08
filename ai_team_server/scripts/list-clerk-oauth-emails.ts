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
  first_name?: string | null;
  last_name?: string | null;
  created_at?: number;
};

type ExportedUser = {
  email: string;
  oauthId: string;
  clerkId: string;
  externalOauthIds: Array<{
    provider: string;
    oauthId: string;
  }>;
  name: string;
  createdAt: string | null;
};

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // No .env file loaded. The script can still use shell-provided env vars.
    }
  }
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getPrimaryEmail(user: ClerkUser) {
  const emails = user.email_addresses ?? [];
  const primaryEmail = emails.find(
    (email) => email.id === user.primary_email_address_id,
  );

  return primaryEmail?.email_address ?? emails[0]?.email_address ?? '';
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

function mapUser(user: ClerkUser): ExportedUser {
  const externalOauthIds = (user.external_accounts ?? [])
    .filter((account) => account.provider_user_id)
    .map((account) => ({
      provider: account.provider ?? 'unknown',
      oauthId: account.provider_user_id as string,
    }));

  return {
    email: getPrimaryEmail(user),
    oauthId: user.id,
    clerkId: user.id,
    externalOauthIds,
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    createdAt: user.created_at ? new Date(user.created_at).toISOString() : null,
  };
}

async function main() {
  loadEnv();

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'CLERK_SECRET_KEY is not set. Set it in ai_team_server/.env or in the shell before running this script.',
    );
  }

  const users = await fetchAllClerkUsers(secretKey);
  const exportedUsers = users.map(mapUser);

  console.table(
    exportedUsers.map((user) => ({
      email: user.email,
      oauthId: user.oauthId,
      externalOauthIds: user.externalOauthIds
        .map((account) => `${account.provider}:${account.oauthId}`)
        .join(', '),
    })),
  );

  const outputPath = path.join(
    process.cwd(),
    `clerk-oauth-emails-${getTimestamp()}.json`,
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalUsers: exportedUsers.length,
        users: exportedUsers,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`Exported ${exportedUsers.length} users to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
