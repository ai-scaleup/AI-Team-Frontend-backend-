/**
 * Verify that oauthIds are synced between Clerk and Database
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const RENDER_DATABASE_URL = "postgresql://aiteam_om7d_user:jdaOURhyB6E51h5FbeMOY3CDn64AiYcH@dpg-d4a1rtvgi27c739q029g-a.frankfurt-postgres.render.com/aiteam_om7d";

const prisma = new PrismaClient({
    datasources: { db: { url: RENDER_DATABASE_URL } }
});

interface ClerkUser {
    clerkId: string;
    email: string;
}

async function verify() {
    const clerkUsers: ClerkUser[] = JSON.parse(fs.readFileSync('./clerk-users-export.json', 'utf-8'));
    const dbUsers = await prisma.user.findMany({ select: { email: true, oauthId: true } });

    const clerkMap = new Map(clerkUsers.map(u => [u.email.toLowerCase(), u.clerkId]));

    let matched = 0;
    let mismatched = 0;
    const mismatches: { email: string; dbOauth: string; clerkId: string }[] = [];

    for (const dbUser of dbUsers) {
        const clerkId = clerkMap.get(dbUser.email.toLowerCase());
        if (clerkId) {
            if (dbUser.oauthId === clerkId) {
                matched++;
            } else {
                mismatched++;
                mismatches.push({ email: dbUser.email, dbOauth: dbUser.oauthId, clerkId });
            }
        }
    }

    console.log('\n✅ VERIFICATION RESULT:');
    console.log('  Users in both Clerk & DB with MATCHING oauthId:', matched);
    console.log('  Users in both Clerk & DB with MISMATCHED oauthId:', mismatched);

    if (mismatches.length > 0) {
        console.log('\n⚠️ Mismatches found:');
        mismatches.forEach(m => {
            console.log(`  - ${m.email}`);
            console.log(`    DB: ${m.dbOauth}`);
            console.log(`    Clerk: ${m.clerkId}\n`);
        });
    } else {
        console.log('\n🎉 All users that exist in both Clerk and Database have matching oauthIds!');
    }

    await prisma.$disconnect();
}

verify();
