import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://aiteam_om7d_user:jdaOURhyB6E51h5FbeMOY3CDn64AiYcH@dpg-d4a1rtvgi27c739q029g-a.frankfurt-postgres.render.com/aiteam_om7d',
        },
    },
});

async function check() {
    const users = await prisma.user.findMany({
        where: { email: { contains: 'luca' } },
        select: { email: true, oauthId: true },
    });
    console.log(JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}

check();
