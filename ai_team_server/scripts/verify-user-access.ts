import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAIL = 'luca.papa.digital+3MIGRATION@gmail.com';

async function main() {
    console.log(`Verifying access for users matching substring: luca.papa.digital+3`);
    const users = await prisma.user.findMany({
        where: {
            email: {
                contains: 'luca.papa.digital+3',
                mode: 'insensitive'
            }
        },
        include: {
            groups: {
                include: {
                    group: true
                }
            },
            agents: true
        }
    });

    if (users.length === 0) {
        console.log('No matching users found.');
        return;
    }

    console.log(`Found ${users.length} matching users.`);
    for (const user of users) {
        console.log('------------------------------------------------');
        console.log(`User ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`OAuth ID: ${user.oauthId}`);
        console.log(`Username: ${user.username}`);

        console.log('\n--- Assigned Groups ---');
        if (user.groups.length === 0) {
            console.log('No groups assigned.');
        } else {
            user.groups.forEach(ag => {
                console.log(`- Group: "${ag.group.name}" (Active: ${ag.isActive})`);
            });
        }

        console.log('\n--- Assigned Agents ---');
        console.log(`Total directly assigned agents: ${user.agents.length}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
