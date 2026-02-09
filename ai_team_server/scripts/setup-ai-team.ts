
import { PrismaClient, AgentName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetEmail = 'digitalcoachai@gmail.com';
    const groupName = 'AI_team';

    console.log(`🚀 Starting setup for group: ${groupName}`);

    // 1. Create or Update the Group
    console.log(`📦 Upserting AgentGroup...`);
    const group = await prisma.agentGroup.upsert({
        where: { name: groupName },
        update: {},
        create: {
            name: groupName,
            description: 'Group containing all agents, automatically created.',
            isActive: true,
        },
    });
    console.log(`   ✅ Group ID: ${group.id}`);

    // 2. Add ALL Agents to this Group
    console.log(`🔗 Adding all agents to group...`);
    const allAgents = Object.values(AgentName);

    const agentItemsRaw = allAgents.map(agent => ({
        groupId: group.id,
        agentName: agent,
    }));

    const { count } = await prisma.agentGroupItem.createMany({
        data: agentItemsRaw,
        skipDuplicates: true,
    });

    console.log(`   ✅ Added ${count} new agents to the group (skipped existing).`);

    // 3. Find the User
    console.log(`👤 Looking for user: ${targetEmail}`);
    const user = await prisma.user.findUnique({
        where: { email: targetEmail },
    });

    if (!user) {
        console.error(`   ❌ User ${targetEmail} not found! Please create the user first.`);
        process.exit(1);
    }
    console.log(`   ✅ User found: ${user.id}`);

    // 4. Assign Group to User
    console.log(`👉 Assigning group to user...`);

    const existingAssignment = await prisma.assignedGroup.findFirst({
        where: {
            userId: user.id,
            groupId: group.id,
            isActive: true,
        },
    });

    if (existingAssignment) {
        console.log(`   Assignment already exists (ID: ${existingAssignment.id}). Updating expiry...`);
        await prisma.assignedGroup.update({
            where: { id: existingAssignment.id },
            data: {
                expiresAt: new Date('2030-01-01'),
            },
        });
    } else {
        console.log(`   Creating new assignment...`);
        await prisma.assignedGroup.create({
            data: {
                userId: user.id,
                groupId: group.id,
                isActive: true,
                startsAt: new Date(),
                expiresAt: new Date('2030-01-01'),
            },
        });
    }
    console.log(`   ✅ Group assigned successfully!`);

    console.log('\n🎉 Setup complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
