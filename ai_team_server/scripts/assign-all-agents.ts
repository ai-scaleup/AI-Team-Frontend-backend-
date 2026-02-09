
import { PrismaClient, AgentName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'digitalcoachai@gmail.com';
    const groupName = 'AI_Team';

    console.log(`Looking for user with email: ${email}...`);
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error(`User with email ${email} not found.`);
        process.exit(1);
    }
    console.log(`Found user: ${user.id} (${user.email})`);

    // 1. Create or get the Agent Group
    console.log(`Creating or finding group: ${groupName}...`);
    const group = await prisma.agentGroup.upsert({
        where: { name: groupName },
        update: {},
        create: {
            name: groupName,
            description: 'Group containing all AI Team agents',
            isActive: true,
        },
    });
    console.log(`Group ID: ${group.id}`);

    // 2. Add all agents to the group
    console.log('Adding all agents to the group...');
    const allAgents = Object.values(AgentName);

    for (const agentName of allAgents) {
        // Skip test agents if you only want real ones, or include all.
        // For now including all as requested "every agent"

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
    console.log(`Assigning group to user...`);
    await prisma.assignedGroup.upsert({
        where: {
            userId_groupId_isActive: {
                userId: user.id,
                groupId: group.id,
                isActive: true
            }
        },
        update: {}, // Already assigned
        create: {
            userId: user.id,
            groupId: group.id,
            isActive: true,
            startsAt: new Date(),
            // No expiration
        },
    });

    console.log('Successfully assigned AI_Team group to user!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
