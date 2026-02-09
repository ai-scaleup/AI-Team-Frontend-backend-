// scripts/setup-agent-team.ts
// Creates an agent team with all agents and assigns it to john.smith@example.com

import { PrismaClient, AgentName } from '@prisma/client';

const prisma = new PrismaClient();

// All production agents (excluding TEST_ prefixed agents)
const ALL_PRODUCTION_AGENTS: AgentName[] = [
    'JIM',
    'ALEX',
    'MIKE',
    'TONY',
    'LARA',
    'VALENTINA',
    'DANIELE',
    'SIMONE',
    'NIKO',
    'ALADINO',
    'LAURA',
    'DAN',
    'MAX',
    'SOFIA',
    'ROBERTA',
];

async function main() {
    const email = 'john.smith@example.com';
    const groupName = 'ALL_AGENTS_TEAM';

    console.log(`\n🔍 Checking if user "${email}" exists...`);

    // Check if the user exists
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        console.log(`\n❌ User with email "${email}" NOT FOUND in the database.`);
        console.log(`\nPlease ensure the user exists before running this script.`);
        return;
    }

    console.log(`✅ User found: ${user.id}`);
    console.log(`   Username: ${user.username || 'N/A'}`);
    console.log(`   Created: ${user.createdAt}`);

    // Check if the group already exists
    console.log(`\n🔍 Checking if group "${groupName}" exists...`);
    let group = await prisma.agentGroup.findUnique({ where: { name: groupName } });

    if (group) {
        console.log(`✅ Group "${groupName}" already exists (ID: ${group.id}). Will reuse it.`);
    } else {
        console.log(`📦 Creating new agent group "${groupName}"...`);
        group = await prisma.agentGroup.create({
            data: {
                name: groupName,
                description: 'Team with access to all production agents',
                isActive: true,
            },
        });
        console.log(`✅ Group created with ID: ${group.id}`);
    }

    // Add all agents to the group
    console.log(`\n📦 Adding all ${ALL_PRODUCTION_AGENTS.length} agents to the group...`);
    const addResult = await prisma.agentGroupItem.createMany({
        data: ALL_PRODUCTION_AGENTS.map((agentName) => ({
            groupId: group.id,
            agentName,
        })),
        skipDuplicates: true,
    });
    console.log(`✅ Added ${addResult.count} new agents to the group (skipped duplicates)`);

    // Assign the group to the user
    console.log(`\n📦 Assigning group "${groupName}" to user "${email}"...`);

    // Check if assignment already exists
    const existingAssignment = await prisma.assignedGroup.findFirst({
        where: { userId: user.id, groupId: group.id, isActive: true },
    });

    if (existingAssignment) {
        console.log(`✅ Group assignment already exists (ID: ${existingAssignment.id})`);
    } else {
        const groupAssignment = await prisma.assignedGroup.create({
            data: {
                userId: user.id,
                groupId: group.id,
                isActive: true,
            },
        });
        console.log(`✅ Group assigned to user (Assignment ID: ${groupAssignment.id})`);
    }

    // Assign each agent individually to the user
    console.log(`\n📦 Assigning all ${ALL_PRODUCTION_AGENTS.length} agents individually to user...`);
    let assignedCount = 0;
    let skippedCount = 0;

    for (const agentName of ALL_PRODUCTION_AGENTS) {
        const existingAgentAssignment = await prisma.assignedAgent.findFirst({
            where: { userId: user.id, agentName, isActive: true },
        });

        if (existingAgentAssignment) {
            skippedCount++;
        } else {
            await prisma.assignedAgent.create({
                data: {
                    userId: user.id,
                    agentName,
                    isActive: true,
                },
            });
            assignedCount++;
        }
    }

    console.log(`\n✅ Agent assignments complete:`);
    console.log(`   - Newly assigned: ${assignedCount}`);
    console.log(`   - Already assigned (skipped): ${skippedCount}`);

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ SETUP COMPLETE for ${email}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Group: ${groupName} (ID: ${group.id})`);
    console.log(`Agents in group: ${ALL_PRODUCTION_AGENTS.length}`);
    console.log(`Agent names: ${ALL_PRODUCTION_AGENTS.join(', ')}`);
    console.log(`${'='.repeat(60)}\n`);
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
