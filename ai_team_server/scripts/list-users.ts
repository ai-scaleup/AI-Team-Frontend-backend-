import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: { email: true, username: true }
    });

    console.log('\n=== Test Users ===\n');
    users.forEach((u, i) => {
        console.log(`${i + 1}. Email: ${u.email}`);
        console.log(`   Username: ${u.username}`);
        console.log('');
    });
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
