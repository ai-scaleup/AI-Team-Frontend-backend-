/**
 * Update oauthId for all users in the Render database
 * by matching email addresses with Clerk data
 * 
 * Usage: npx ts-node scripts/update-oauth-ids.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Connect directly to the Render database
const RENDER_DATABASE_URL = "postgresql://aiteam_om7d_user:jdaOURhyB6E51h5FbeMOY3CDn64AiYcH@dpg-d4a1rtvgi27c739q029g-a.frankfurt-postgres.render.com/aiteam_om7d";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: RENDER_DATABASE_URL,
        },
    },
});

interface ClerkUserExport {
    clerkId: string;
    email: string;
    name: string;
    oauthProvider: string;
    oauthId: string;
    createdAt: string;
}

async function updateOAuthIds() {
    console.log('🔄 Updating oauthId for users in Render database...\n');

    // Load Clerk user data
    const clerkDataPath = path.join(__dirname, '..', 'clerk-users-export.json');

    if (!fs.existsSync(clerkDataPath)) {
        console.error('❌ clerk-users-export.json not found. Run fetch-clerk-users.ts first.');
        process.exit(1);
    }

    const clerkUsers: ClerkUserExport[] = JSON.parse(fs.readFileSync(clerkDataPath, 'utf-8'));
    console.log(`📋 Loaded ${clerkUsers.length} users from Clerk export\n`);

    // Create email to oauthId mapping (using clerkId as the oauthId)
    const emailToOAuthId = new Map<string, string>();
    for (const user of clerkUsers) {
        emailToOAuthId.set(user.email.toLowerCase(), user.clerkId);
    }

    try {
        // Fetch all users from Render database
        const dbUsers = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                oauthId: true,
            },
        });

        console.log(`📊 Found ${dbUsers.length} users in Render database\n`);
        console.log('─'.repeat(80));

        let updated = 0;
        let skipped = 0;
        let notFound = 0;

        for (const dbUser of dbUsers) {
            const newOAuthId = emailToOAuthId.get(dbUser.email.toLowerCase());

            if (!newOAuthId) {
                console.log(`⚠️  No Clerk match for: ${dbUser.email}`);
                notFound++;
                continue;
            }

            if (dbUser.oauthId === newOAuthId) {
                console.log(`✓  Already correct: ${dbUser.email}`);
                skipped++;
                continue;
            }

            // Update the oauthId
            await prisma.user.update({
                where: { id: dbUser.id },
                data: { oauthId: newOAuthId },
            });

            console.log(`✅ Updated: ${dbUser.email}`);
            console.log(`   Old: ${dbUser.oauthId}`);
            console.log(`   New: ${newOAuthId}\n`);
            updated++;
        }

        console.log('─'.repeat(80));
        console.log('\n📈 Summary:');
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ✓  Skipped (already correct): ${skipped}`);
        console.log(`   ⚠️  Not found in Clerk: ${notFound}`);
        console.log(`   📊 Total processed: ${dbUsers.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

updateOAuthIds();
