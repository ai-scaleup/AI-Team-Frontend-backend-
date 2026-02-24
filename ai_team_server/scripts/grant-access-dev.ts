import { PrismaClient, AgentName } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAIL = 'luca.papa.digital+dev@gmail.com';
const TARGET_OAUTH_ID = 'dev_luca_papa_digital'; // placeholder – update if you know the real oauthId

// All agents
const ALL_AGENTS: AgentName[] = [
    'JIM', 'ALEX', 'MIKE', 'TONY', 'LARA', 'VALENTINA',
    'DANIELE', 'SIMONE', 'NIKO', 'ALADINO', 'LAURA', 'DAN',
    'MAX', 'SOFIA', 'ROBERTA', 'SARA_AI',
    // Test agents
    'TEST_JIM', 'TEST_ALEX', 'TEST_MIKE', 'TEST_TONY', 'TEST_LARA',
    'TEST_VALENTINA', 'TEST_DANIELE', 'TEST_SIMONE', 'TEST_NIKO',
    'TEST_ALADINO', 'TEST_LAURA', 'TEST_DAN', 'TEST_MAX',
    'TEST_SOFIA', 'TEST_ROBERTA',
];

async function main() {
    console.log(`\n🔑 Granting access to: ${TARGET_EMAIL}\n`);

    // 1. Find existing user or create
    let user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: TARGET_EMAIL,
                oauthId: TARGET_OAUTH_ID,
                username: 'Luca Papa (Dev)',
            },
        });
        console.log(`✅ User CREATED  → id: ${user.id}`);
    } else {
        console.log(`✅ User EXISTS   → id: ${user.id}`);
    }

    // 2. Upsert an "All Agents" group
    let group = await prisma.agentGroup.findUnique({ where: { name: 'All Agents' } });
    if (!group) {
        group = await prisma.agentGroup.create({
            data: {
                name: 'All Agents',
                description: 'Group containing every agent',
                isActive: true,
            },
        });
        console.log(`✅ AgentGroup CREATED  → id: ${group.id}`);
    } else {
        console.log(`✅ AgentGroup EXISTS   → id: ${group.id}`);
    }

    // 3. Add every agent to the group (skip duplicates)
    let addedToGroup = 0;
    for (const agentName of ALL_AGENTS) {
        const existing = await prisma.agentGroupItem.findFirst({
            where: { groupId: group.id, agentName },
        });
        if (!existing) {
            await prisma.agentGroupItem.create({
                data: { groupId: group.id, agentName },
            });
            addedToGroup++;
        }
    }
    console.log(`✅ Agents in group: ${ALL_AGENTS.length} (${addedToGroup} newly added)`);

    // 4. Assign the group to the user (skip if already assigned)
    const existingGroupAssignment = await prisma.assignedGroup.findFirst({
        where: { userId: user.id, groupId: group.id, isActive: true },
    });
    if (!existingGroupAssignment) {
        await prisma.assignedGroup.create({
            data: {
                userId: user.id,
                groupId: group.id,
                isActive: true,
            },
        });
        console.log(`✅ Group "All Agents" ASSIGNED to user`);
    } else {
        console.log(`✅ Group "All Agents" already assigned to user`);
    }

    // 5. Assign every agent individually to the user (skip duplicates)
    let addedAgents = 0;
    for (const agentName of ALL_AGENTS) {
        const existing = await prisma.assignedAgent.findFirst({
            where: { userId: user.id, agentName, isActive: true },
        });
        if (!existing) {
            await prisma.assignedAgent.create({
                data: {
                    userId: user.id,
                    agentName,
                    isActive: true,
                },
            });
            addedAgents++;
        }
    }
    console.log(`✅ Individual agents assigned: ${ALL_AGENTS.length} (${addedAgents} newly added)`);

    console.log(`\n🎉 Done! ${TARGET_EMAIL} now has full access.\n`);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
