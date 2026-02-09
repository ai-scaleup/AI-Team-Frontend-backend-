/**
 * Fetch all Clerk users with their emails and OAuth IDs
 * 
 * Usage: npx ts-node scripts/fetch-clerk-users.ts
 * 
 * Requires: CLERK_SECRET_KEY in .env (sk_live_... for production)
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

interface ClerkUser {
    id: string;
    email_addresses: Array<{
        id: string;
        email_address: string;
    }>;
    external_accounts: Array<{
        provider: string;
        provider_user_id: string;
    }>;
    first_name: string | null;
    last_name: string | null;
    created_at: number;
}

interface ClerkUsersResponse {
    data: ClerkUser[];
    total_count: number;
}

async function fetchAllClerkUsers() {
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
        console.error('❌ CLERK_SECRET_KEY is not set in .env');
        console.log('   Get it from: https://dashboard.clerk.com → Your App → API Keys');
        process.exit(1);
    }

    console.log('🔍 Fetching all Clerk users...\n');

    const allUsers: ClerkUser[] = [];
    let offset = 0;
    const limit = 100;

    try {
        while (true) {
            const response = await fetch(
                `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
                {
                    headers: {
                        Authorization: `Bearer ${secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Clerk API error: ${response.status} - ${error}`);
            }

            const users: ClerkUser[] = await response.json();

            if (users.length === 0) break;

            allUsers.push(...users);
            offset += limit;

            if (users.length < limit) break;
        }

        console.log(`✅ Found ${allUsers.length} users:\n`);
        console.log('─'.repeat(80));

        const userData = allUsers.map((user) => ({
            clerkId: user.id,
            email: user.email_addresses[0]?.email_address || 'No email',
            name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'No name',
            oauthProvider: user.external_accounts[0]?.provider || 'Email/Password',
            oauthId: user.external_accounts[0]?.provider_user_id || 'N/A',
            createdAt: new Date(user.created_at).toISOString(),
        }));

        // Print table
        console.table(userData);

        // Export to JSON
        const fs = await import('fs');
        const outputPath = './clerk-users-export.json';
        fs.writeFileSync(outputPath, JSON.stringify(userData, null, 2));
        console.log(`\n📁 Exported to: ${outputPath}`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fetchAllClerkUsers();
