import { PrismaClient, AgentName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'digitalcoachai@gmail.com';
    const groupName = 'ALL_AGENTS_ACCESS';

    console.log(`Finding user with email: ${email}`);
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error(`User with email ${email} not found.`);
        process.exit(1);
    }

    console.log(`Found user: ${user.id}`);

    console.log(`Upserting AgentGroup: ${groupName}`);
    const group = await prisma.agentGroup.upsert({
        where: { name: groupName },
        update: {},
        create: {
            name: groupName,
            description: 'Access to all agents',
            isActive: true,
        },
    });

    console.log(`Group ID: ${group.id}`);

    const agentNames = Object.values(AgentName);

    console.log(`Adding ${agentNames.length} agents to the group...`);

    for (const agentName of agentNames) {
        await prisma.agentGroupItem.upsert({
            where: {
                groupId_agentName: {
                    groupId: group.id,
                    agentName: agentName,
                },
            },
            update: {},
            create: {
                groupId: group.id,
                agentName: agentName,
            },
        });
    }

    console.log('All agents added to group.');

    console.log(`Assigning group to user...`);
    await prisma.assignedGroup.upsert({
        where: {
            userId_groupId_isActive: {
                userId: user.id,
                groupId: group.id,
                isActive: true,
            },
        },
        update: {},
        create: {
            userId: user.id,
            groupId: group.id,
            isActive: true,
        },
    });

    console.log('Group assigned to user successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
