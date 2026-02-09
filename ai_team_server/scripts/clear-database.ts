import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
    console.log('🔥 Starting database clearing sequence...\n');

    try {
        // Delete in order to respect any potential constraints, 
        // though Cascades handle most deeply nested dependencies.

        // 1. Delete Users (Cascades to AssignedAgents, AssignedGroups, Conversations -> Messages)
        console.log('🗑️  Deleting Users...');
        const { count: usersCount } = await prisma.user.deleteMany();
        console.log(`   Deleted ${usersCount} users.`);

        // 2. Delete AgentGroups (Cascades to AgentGroupItems, and any remaining AssignedGroups)
        console.log('🗑️  Deleting AgentGroups...');
        const { count: groupsCount } = await prisma.agentGroup.deleteMany();
        console.log(`   Deleted ${groupsCount} agent groups.`);

        console.log('\n✨ Database cleared successfully!');

    } catch (error) {
        console.error('❌ Error clearing database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

clearDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
