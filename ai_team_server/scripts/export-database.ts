// Script to export all database data to JSON for Supabase migration
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportDatabase() {
    console.log('🚀 Starting database export...\n');

    try {
        // Export all tables
        console.log('📦 Fetching Users...');
        const users = await prisma.user.findMany({
            include: {
                agents: true,
                groups: true,
                conversations: {
                    include: {
                        messages: true,
                    },
                },
            },
        });
        console.log(`   Found ${users.length} users`);

        console.log('📦 Fetching AssignedAgents...');
        const assignedAgents = await prisma.assignedAgent.findMany();
        console.log(`   Found ${assignedAgents.length} assigned agents`);

        console.log('📦 Fetching AgentGroups...');
        const agentGroups = await prisma.agentGroup.findMany({
            include: {
                items: true,
                assignments: true,
            },
        });
        console.log(`   Found ${agentGroups.length} agent groups`);

        console.log('📦 Fetching AgentGroupItems...');
        const agentGroupItems = await prisma.agentGroupItem.findMany();
        console.log(`   Found ${agentGroupItems.length} agent group items`);

        console.log('📦 Fetching AssignedGroups...');
        const assignedGroups = await prisma.assignedGroup.findMany();
        console.log(`   Found ${assignedGroups.length} assigned groups`);

        console.log('📦 Fetching Conversations...');
        const conversations = await prisma.conversation.findMany({
            include: {
                messages: true,
            },
        });
        console.log(`   Found ${conversations.length} conversations`);

        console.log('📦 Fetching Messages...');
        const messages = await prisma.message.findMany();
        console.log(`   Found ${messages.length} messages`);

        // Compile all data
        const exportData = {
            exportedAt: new Date().toISOString(),
            metadata: {
                totalUsers: users.length,
                totalAssignedAgents: assignedAgents.length,
                totalAgentGroups: agentGroups.length,
                totalAgentGroupItems: agentGroupItems.length,
                totalAssignedGroups: assignedGroups.length,
                totalConversations: conversations.length,
                totalMessages: messages.length,
            },
            tables: {
                users,
                assignedAgents,
                agentGroups,
                agentGroupItems,
                assignedGroups,
                conversations,
                messages,
            },
        };

        // Write to JSON file
        const outputPath = path.join(__dirname, '..', 'database-export.json');
        fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

        console.log('\n✅ Export complete!');
        console.log(`📁 Data saved to: ${outputPath}`);
        console.log('\n📊 Summary:');
        console.log(`   - Users: ${users.length}`);
        console.log(`   - Assigned Agents: ${assignedAgents.length}`);
        console.log(`   - Agent Groups: ${agentGroups.length}`);
        console.log(`   - Agent Group Items: ${agentGroupItems.length}`);
        console.log(`   - Assigned Groups: ${assignedGroups.length}`);
        console.log(`   - Conversations: ${conversations.length}`);
        console.log(`   - Messages: ${messages.length}`);

    } catch (error) {
        console.error('❌ Export failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

exportDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
