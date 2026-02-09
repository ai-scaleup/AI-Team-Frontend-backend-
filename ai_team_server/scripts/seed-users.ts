import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding 10 users...');

    const users: { email: string; oauthId: string; username: string }[] = [];
    for (let i = 1; i <= 10; i++) {
        users.push({
            email: `testuser${i}_${Date.now()}@example.com`,
            oauthId: `oauth_${Date.now()}_${i}`,
            username: `TestUser${i}`,
        });
    }

    for (const userData of users) {
        const user = await prisma.user.create({
            data: userData,
        });
        console.log(`Created user with id: ${user.id}`);
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
