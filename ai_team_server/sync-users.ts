import { PrismaClient } from '@prisma/client';
import clerk from '@clerk/clerk-sdk-node';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching users from Clerk...");
  const users = await clerk.users.getUserList();
  console.log(`Found ${users.length} users in Clerk.`);

  for (const user of users) {
    const email = user.emailAddresses[0]?.emailAddress;
    const oauthId = user.id;
    const username = user.username || email?.split('@')[0] || "User";

    if (!email) {
        console.log(`Skipping user ${oauthId} because no email was found.`);
        continue;
    }

    try {
      await prisma.user.upsert({
        where: { oauthId },
        update: { email, username },
        create: { oauthId, email, username }
      });
      console.log(`Upserted user by oauthId: ${email} (${oauthId})`);
    } catch (e: any) {
      if (e.code === 'P2002' && e.meta?.target?.includes('email')) {
        // Email exists but with a different oauthId. Let's update the oauthId.
        await prisma.user.update({
          where: { email },
          data: { oauthId, username }
        });
        console.log(`Updated oauthId for existing email: ${email} (${oauthId})`);
      } else {
        throw e;
      }
    }
  }
  
  console.log("Finished syncing users to test database.");
}

main().catch(e => {
  console.error("Error syncing users:", e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
