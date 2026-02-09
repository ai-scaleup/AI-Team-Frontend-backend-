import { PrismaClient, AgentName } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAIL = 'luca.papa.digital+3migration@gmail.com';
const GROUP_NAME = 'Migration Full Access';

async function main() {
    console.log(`Checking for user: ${TARGET_EMAIL}`);
    let user = await prisma.user.findUnique({
        where: { email: TARGET_EMAIL },
    });

    if (!user) {
        console.log(`User not found. Creating user with email ${TARGET_EMAIL}...`);
        try {
            user = await prisma.user.create({
                data: {
                    email: TARGET_EMAIL,
                    oauthId: `migration_${Date.now()}`, // Placeholder OAuth ID
                    username: 'Migration User',
                },
            });
            console.log(`Created user: ${user.id}`);
        } catch (e) {
            console.error('Failed to create user:', e);
            process.exit(1);
        }
    } else {
        console.log(`User found: ${user.id} (${user.email})`);
    }

    // 1. Create or Find the Group
    console.log(`Ensuring AgentGroup: ${GROUP_NAME}`);
    let group = await prisma.agentGroup.findUnique({
        where: { name: GROUP_NAME },
    });

    if (!group) {
        try {
            group = await prisma.agentGroup.create({
                data: {
                    name: GROUP_NAME,
                    description: 'Auto-generated group with access to ALL agents.',
                    isActive: true,
                },
            });
            console.log(`Created new group: ${group.id}`);
        } catch (e) {
            console.error('Failed to create group:', e);
        }
    } else {
        console.log(`Group already exists: ${group.id}`);
    }

    if (!group) {
        console.error('Group could not be retrieved or created.');
        process.exit(1);
    }

    // 2. Add ALL Agents to the Group
    const allAgents = Object.values(AgentName);
    console.log(`Adding ${allAgents.length} agents to the group...`);

    const groupItemsData = allAgents.map((agentName) => ({
        groupId: group.id,
        agentName,
    }));

    try {
        const addedItems = await prisma.agentGroupItem.createMany({
            data: groupItemsData,
            skipDuplicates: true,
        });
        console.log(`Added ${addedItems.count} agents to group (skipping duplicates).`);
    } catch (e) {
        console.error('Failed to add agents to group:', e);
    }

    // 3. Assign Group to User
    console.log(`Assigning group to user...`);
    try {
        const existingGroupAssignment = await prisma.assignedGroup.findFirst({
            where: {
                userId: user.id,
                groupId: group.id,
                isActive: true
            }
        });

        if (!existingGroupAssignment) {
            await prisma.assignedGroup.create({
                data: {
                    userId: user.id,
                    groupId: group.id,
                    isActive: true,
                    startsAt: new Date(),
                }
            });
            console.log('Group assigned to user.');
        } else {
            console.log('User already has this group assigned.');
        }
    } catch (e) {
        console.error('Failed to assign group to user:', e);
    }

    // 4. Assign Agents Directly to User (AssignedAgent)
    console.log(`Assigning all agents directly to user...`);
    const assignedAgentsData = allAgents.map((agentName) => ({
        userId: user.id,
        agentName,
        isActive: true,
        startsAt: new Date(),
    }));

    try {
        const assignedAgentsCount = await prisma.assignedAgent.createMany({
            data: assignedAgentsData,
            skipDuplicates: true,
        });
        console.log(`Directly assigned ${assignedAgentsCount.count} agents to user.`);
    } catch (e) {
        console.error('Failed to assign agents directly:', e);
    }

    console.log('Done!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
