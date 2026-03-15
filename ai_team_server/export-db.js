const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Use the production database URL directly
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://aiteam_om7d_user:jdaOURhyB6E51h5FbeMOY3CDn64AiYcH@dpg-d4a1rtvgi27c739q029g-a.frankfurt-postgres.render.com/aiteam_om7d',
    },
  },
});

async function exportDatabase() {
  console.log('Connecting to production database...');

  try {
    // Export all tables
    console.log('Exporting User...');
    const users = await prisma.user.findMany();
    console.log(`  Found ${users.length} users`);

    console.log('Exporting UserPreference...');
    const userPreferences = await prisma.userPreference.findMany();
    console.log(`  Found ${userPreferences.length} user preferences`);

    console.log('Exporting AssignedAgent...');
    const assignedAgents = await prisma.assignedAgent.findMany();
    console.log(`  Found ${assignedAgents.length} assigned agents`);

    console.log('Exporting AgentGroup...');
    const agentGroups = await prisma.agentGroup.findMany();
    console.log(`  Found ${agentGroups.length} agent groups`);

    console.log('Exporting AgentGroupItem...');
    const agentGroupItems = await prisma.agentGroupItem.findMany();
    console.log(`  Found ${agentGroupItems.length} agent group items`);

    console.log('Exporting AssignedGroup...');
    const assignedGroups = await prisma.assignedGroup.findMany();
    console.log(`  Found ${assignedGroups.length} assigned groups`);

    console.log('Exporting Conversation...');
    const conversations = await prisma.conversation.findMany();
    console.log(`  Found ${conversations.length} conversations`);

    console.log('Exporting Message...');
    const messages = await prisma.message.findMany();
    console.log(`  Found ${messages.length} messages`);

    console.log('Exporting ChatLog...');
    const chatLogs = await prisma.chatLog.findMany();
    console.log(`  Found ${chatLogs.length} chat logs`);

    console.log('Exporting ChiaraInboundChatLog...');
    const chiaraInboundChatLogs = await prisma.chiaraInboundChatLog.findMany();
    console.log(`  Found ${chiaraInboundChatLogs.length} chiara inbound chat logs`);

    console.log('Exporting ChiaraLead...');
    const chiaraLeads = await prisma.chiaraLead.findMany();
    console.log(`  Found ${chiaraLeads.length} chiara leads`);

    console.log('Exporting TagField...');
    const tagFields = await prisma.tagField.findMany();
    console.log(`  Found ${tagFields.length} tag fields`);

    console.log('Exporting Tag...');
    const tags = await prisma.tag.findMany();
    console.log(`  Found ${tags.length} tags`);

    // Build the export object
    const exportData = {
      exportedAt: new Date().toISOString(),
      tables: {
        User: { count: users.length, data: users },
        UserPreference: { count: userPreferences.length, data: userPreferences },
        AssignedAgent: { count: assignedAgents.length, data: assignedAgents },
        AgentGroup: { count: agentGroups.length, data: agentGroups },
        AgentGroupItem: { count: agentGroupItems.length, data: agentGroupItems },
        AssignedGroup: { count: assignedGroups.length, data: assignedGroups },
        Conversation: { count: conversations.length, data: conversations },
        Message: { count: messages.length, data: messages },
        ChatLog: { count: chatLogs.length, data: chatLogs },
        ChiaraInboundChatLog: { count: chiaraInboundChatLogs.length, data: chiaraInboundChatLogs },
        ChiaraLead: { count: chiaraLeads.length, data: chiaraLeads },
        TagField: { count: tagFields.length, data: tagFields },
        Tag: { count: tags.length, data: tags },
      },
    };

    // Write to file
    const outputPath = path.join(__dirname, 'database-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`\nExport complete! Saved to: ${outputPath}`);
    console.log('\nSummary:');
    for (const [table, info] of Object.entries(exportData.tables)) {
      console.log(`  ${table}: ${info.count} records`);
    }
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportDatabase();
