import { PrismaClient, AgentName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'mahshidkhorasani69@gmail.com';
    const groupName = 'ALL_AGENTS_ACCESS_GROUP';

    console.log(`Checking database connection...`);
    // Simple query to verify connection
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log(`Database connected successfully.`);
    } catch (e) {
        console.error(`Failed to connect to database: ${e}`);
        process.exit(1);
    }

    console.log(`\nLooking for user with email: ${email}...`);
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error(`User with email ${email} not found in this database.`);
        console.log(`Please ensure the user is registered in the target database.`);
        process.exit(1);
    }
    console.log(`Found user: ${user.id} (${user.email})`);

    // 1. Create or get the Agent Group
    console.log(`\nCreating or finding group: ${groupName}...`);
    const group = await prisma.agentGroup.upsert({
        where: { name: groupName },
        update: {},
        create: {
            name: groupName,
            description: 'Group containing all AI Team agents for full access',
            isActive: true,
        },
    });
    console.log(`Group ID: ${group.id}`);

    // 2. Add all agents to the group
    console.log('\nAdding all agents to the group...');
    const allAgents = Object.values(AgentName);

    for (const agentName of allAgents) {
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
    console.log(`Added ${allAgents.length} agents to group ${groupName}.`);

    // 3. Assign the group to the user
    console.log(`\nAssigning group to user...`);
    await prisma.assignedGroup.upsert({
        where: {
            userId_groupId_isActive: {
                userId: user.id,
                groupId: group.id,
                isActive: true
            }
        },
        update: {
            // ensure it's active if it already exists
            isActive: true
        },
        create: {
            userId: user.id,
            groupId: group.id,
            isActive: true,
            startsAt: new Date(),
        },
    });

    console.log(`\n✅ SUCCESSFULLY assigned group "${groupName}" to ${email}!`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
