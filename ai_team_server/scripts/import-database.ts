import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importDatabase() {
    console.log('🚀 Starting database import...\n');

    const importPath = path.join(__dirname, '..', 'database-export.json');

    if (!fs.existsSync(importPath)) {
        console.error(`❌ Export file not found at: ${importPath}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(importPath, 'utf-8');
    const data = JSON.parse(fileContent);
    const { tables, metadata } = data;

    console.log(`📅 Export Date: ${data.exportedAt}`);
    console.log('📊 Export Metadata:', metadata);
    console.log('\n----------------------------------------\n');

    try {
        // Helper to strip nested relations (arrays or objects that are not fields)
        const stripRelations = (item: any, relationsToRemove: string[]) => {
            const newItem = { ...item };
            relationsToRemove.forEach(rel => delete newItem[rel]);
            return newItem;
        };

        // 1. Users
        // Remove: agents, groups, conversations
        if (tables.users && tables.users.length > 0) {
            console.log(`📦 Importing ${tables.users.length} Users...`);
            const usersData = tables.users.map((u: any) => stripRelations(u, ['agents', 'groups', 'conversations']));
            await prisma.user.createMany({
                data: usersData,
                skipDuplicates: true,
            });
            console.log('   ✅ Users imported');
        }

        // 2. AgentGroups
        // Remove: items, assignments
        if (tables.agentGroups && tables.agentGroups.length > 0) {
            console.log(`📦 Importing ${tables.agentGroups.length} AgentGroups...`);
            const groupsData = tables.agentGroups.map((g: any) => stripRelations(g, ['items', 'assignments']));
            await prisma.agentGroup.createMany({
                data: groupsData,
                skipDuplicates: true,
            });
            console.log('   ✅ AgentGroups imported');
        }

        // 3. AssignedAgents
        // No nested relations in export, but good to check. 
        // Export had: include needed for nested? No, AssignedAgent is leaf or linked to User.
        // Export query: `prisma.assignedAgent.findMany()` -> no includes. Safe to import directly if fields match.
        if (tables.assignedAgents && tables.assignedAgents.length > 0) {
            console.log(`📦 Importing ${tables.assignedAgents.length} AssignedAgents...`);
            // Ensure no extra props if schema changed, but assuming matching schema
            await prisma.assignedAgent.createMany({
                data: tables.assignedAgents,
                skipDuplicates: true,
            });
            console.log('   ✅ AssignedAgents imported');
        }

        // 4. AgentGroupItems
        // Export query: `prisma.agentGroupItem.findMany()` -> no includes.
        if (tables.agentGroupItems && tables.agentGroupItems.length > 0) {
            console.log(`📦 Importing ${tables.agentGroupItems.length} AgentGroupItems...`);
            await prisma.agentGroupItem.createMany({
                data: tables.agentGroupItems,
                skipDuplicates: true,
            });
            console.log('   ✅ AgentGroupItems imported');
        }

        // 5. AssignedGroups
        // Export query: `prisma.assignedGroup.findMany()` -> no includes.
        if (tables.assignedGroups && tables.assignedGroups.length > 0) {
            console.log(`📦 Importing ${tables.assignedGroups.length} AssignedGroups...`);
            await prisma.assignedGroup.createMany({
                data: tables.assignedGroups,
                skipDuplicates: true,
            });
            console.log('   ✅ AssignedGroups imported');
        }

        // 6. Conversations
        // Remove: messages
        if (tables.conversations && tables.conversations.length > 0) {
            console.log(`📦 Importing ${tables.conversations.length} Conversations...`);
            const conversationsData = tables.conversations.map((c: any) => stripRelations(c, ['messages']));
            await prisma.conversation.createMany({
                data: conversationsData,
                skipDuplicates: true,
            });
            console.log('   ✅ Conversations imported');
        }

        // 7. Messages
        // Export query: `prisma.message.findMany()` -> no includes.
        if (tables.messages && tables.messages.length > 0) {
            console.log(`📦 Importing ${tables.messages.length} Messages...`);
            await prisma.message.createMany({
                data: tables.messages,
                skipDuplicates: true,
            });
            console.log('   ✅ Messages imported');
        }

        console.log('\n🎉 Import sequence completed successfully!');

    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

importDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
