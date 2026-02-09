import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FAKE_EMAIL = 'luca.papa.digital+3MIGRATION@gmail.com';

async function main() {
    console.log(`Deleting fake user: ${FAKE_EMAIL}`);
    const deleteUser = await prisma.user.deleteMany({
        where: {
            email: FAKE_EMAIL,
            oauthId: { startsWith: 'migration_' } // Safety check
        },
    });
    console.log(`Deleted ${deleteUser.count} users.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
