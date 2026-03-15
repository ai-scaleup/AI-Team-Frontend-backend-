const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres.gcblmuqxhuitzhrldgrx:r7DS4*7EXhAo2jTc@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const prisma = new PrismaClient({
    datasources: { db: { url: SUPABASE_URL } },
});

async function safeExec(sql, params) {
    try {
        await prisma.$executeRawUnsafe(sql, ...params);
        return true;
    } catch (e) {
        return false;
    }
}

async function importDatabase() {
    console.log('Reading export file...');
    const exportPath = path.join(__dirname, 'database-export.json');
    const raw = fs.readFileSync(exportPath, 'utf-8');
    const exportData = JSON.parse(raw);
    const tables = exportData.tables;

    console.log(`Export from: ${exportData.exportedAt}`);
    console.log('Connecting to Supabase database...\n');

    try {
        // ── CLEAN existing data (delete in reverse FK order) ──
        console.log('Cleaning existing partial data...');
        await prisma.$executeRawUnsafe(`DELETE FROM "Tag"`);
        await prisma.$executeRawUnsafe(`DELETE FROM "TagField"`);
        await prisma.$executeRawUnsafe(`DELETE FROM chiara_leads`);
        await prisma.$executeRawUnsafe(`DELETE FROM chiara_inbound_chat_logs`);
        await prisma.$executeRawUnsafe(`DELETE FROM chat_logs`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Message"`);
        await prisma.$executeRawUnsafe(`DELETE FROM "Conversation"`);
        await prisma.$executeRawUnsafe(`DELETE FROM "AssignedGroup"`);
        await prisma.$executeRawUnsafe(`DELETE FROM "AgentGroupItem"`);
        await prisma.$executeRawUnsafe(`DELETE FROM "AgentGroup"`);
        await prisma.$executeRawUnsafe(`DELETE FROM "AssignedAgent"`);
        await prisma.$executeRawUnsafe(`DELETE FROM "UserPreference"`);
        await prisma.$executeRawUnsafe(`DELETE FROM "User"`);
        console.log('  ✓ Clean done\n');

        // ── 1. Users ──
        console.log(`Importing User (${tables.User.count} records)...`);
        let ok = 0, skip = 0;
        for (const row of tables.User.data) {
            const res = await safeExec(
                `INSERT INTO "User" (id, email, "oauthId", username, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [row.id, row.email, row.oauthId, row.username, new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ User done (${ok} inserted, ${skip} skipped)`);

        // ── 2. UserPreference ──
        console.log(`Importing UserPreference (${tables.UserPreference.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.UserPreference.data) {
            const res = await safeExec(
                `INSERT INTO "UserPreference" (
          id, "oauthId", "agentName", "displayName", "businessName",
          "contentLanguage", "responseLanguage", "toneOfVoice", "marketingKnowledge",
          "responseLength", "emojiUsage", "proactivityLevel", "questionStyle",
          "decisionHelpStyle", "learningPreference", "marketComparison",
          "onboardingCompleted", "onboardingStep", "createdAt", "updatedAt"
        ) VALUES ($1,$2,$3::\"AgentName\",$4,$5,$6::\"ContentLanguage\",$7::\"ContentLanguage\",$8::\"ToneOfVoice\",$9::\"MarketingKnowledge\",$10::\"ResponseLength\",$11::\"EmojiUsage\",$12::\"ProactivityLevel\",$13::\"QuestionStyle\",$14::\"DecisionHelpStyle\",$15::\"LearningPreference\",$16::\"MarketComparison\",$17,$18,$19,$20)`,
                [row.id, row.oauthId, row.agentName, row.displayName, row.businessName,
                row.contentLanguage, row.responseLanguage, row.toneOfVoice, row.marketingKnowledge,
                row.responseLength, row.emojiUsage, row.proactivityLevel, row.questionStyle,
                row.decisionHelpStyle, row.learningPreference, row.marketComparison,
                row.onboardingCompleted, row.onboardingStep, new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ UserPreference done (${ok} inserted, ${skip} skipped)`);

        // ── 3. AssignedAgent ──
        console.log(`Importing AssignedAgent (${tables.AssignedAgent.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.AssignedAgent.data) {
            const res = await safeExec(
                `INSERT INTO "AssignedAgent" (id, "userId", "agentName", "startsAt", "expiresAt", "durationDays", "isActive", "createdAt", "updatedAt")
         VALUES ($1,$2,$3::\"AgentName\",$4,$5,$6,$7,$8,$9)`,
                [row.id, row.userId, row.agentName, new Date(row.startsAt),
                row.expiresAt ? new Date(row.expiresAt) : null, row.durationDays, row.isActive,
                new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ AssignedAgent done (${ok} inserted, ${skip} skipped)`);

        // ── 4. AgentGroup ──
        console.log(`Importing AgentGroup (${tables.AgentGroup.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.AgentGroup.data) {
            const res = await safeExec(
                `INSERT INTO "AgentGroup" (id, name, description, "isActive", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6)`,
                [row.id, row.name, row.description, row.isActive, new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ AgentGroup done (${ok} inserted, ${skip} skipped)`);

        // ── 5. AgentGroupItem ──
        console.log(`Importing AgentGroupItem (${tables.AgentGroupItem.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.AgentGroupItem.data) {
            const res = await safeExec(
                `INSERT INTO "AgentGroupItem" (id, "groupId", "agentName", "createdAt", "updatedAt")
         VALUES ($1,$2,$3::\"AgentName\",$4,$5)`,
                [row.id, row.groupId, row.agentName, new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ AgentGroupItem done (${ok} inserted, ${skip} skipped)`);

        // ── 6. AssignedGroup ──
        console.log(`Importing AssignedGroup (${tables.AssignedGroup.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.AssignedGroup.data) {
            const res = await safeExec(
                `INSERT INTO "AssignedGroup" (id, "userId", "groupId", "startsAt", "expiresAt", "durationDays", "isActive", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [row.id, row.userId, row.groupId, new Date(row.startsAt),
                row.expiresAt ? new Date(row.expiresAt) : null, row.durationDays, row.isActive,
                new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ AssignedGroup done (${ok} inserted, ${skip} skipped)`);

        // ── 7. Conversation ──
        console.log(`Importing Conversation (${tables.Conversation.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.Conversation.data) {
            const res = await safeExec(
                `INSERT INTO "Conversation" (id, "userId", title, "agentId", "sessionId", "folderId", archived, "lastUpdated", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [row.id, row.userId, row.title, row.agentId, row.sessionId, row.folderId,
                row.archived, new Date(row.lastUpdated), new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ Conversation done (${ok} inserted, ${skip} skipped)`);

        // ── 8. Message (17k+ records — batch) ──
        console.log(`Importing Message (${tables.Message.count} records)...`);
        ok = 0; skip = 0;
        const BATCH = 50;
        for (let i = 0; i < tables.Message.data.length; i += BATCH) {
            const chunk = tables.Message.data.slice(i, i + BATCH);
            const results = await Promise.all(
                chunk.map((row) =>
                    safeExec(
                        `INSERT INTO "Message" (id, "conversationId", text, sender, time, "createdAt")
             VALUES ($1,$2,$3,$4,$5,$6)`,
                        [row.id, row.conversationId, row.text, row.sender, row.time, new Date(row.createdAt)]
                    )
                )
            );
            results.forEach(r => r ? ok++ : skip++);
            process.stdout.write(`  ${Math.min(i + BATCH, tables.Message.data.length)}/${tables.Message.data.length} (${ok} ok, ${skip} skip)\r`);
        }
        console.log(`\n  ✓ Message done (${ok} inserted, ${skip} skipped)`);

        // ── 9. ChatLog ──
        console.log(`Importing ChatLog (${tables.ChatLog.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.ChatLog.data) {
            const res = await safeExec(
                `INSERT INTO chat_logs (id, session_id, sender, message_text, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
                [row.id, row.sessionId, row.sender, row.messageText, new Date(row.createdAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ ChatLog done (${ok} inserted, ${skip} skipped)`);

        // ── 10. ChiaraInboundChatLog ──
        console.log(`Importing ChiaraInboundChatLog (${tables.ChiaraInboundChatLog.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.ChiaraInboundChatLog.data) {
            const res = await safeExec(
                `INSERT INTO chiara_inbound_chat_logs (id, session_id, sender, message_text, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
                [row.id, row.sessionId, row.sender, row.messageText, new Date(row.createdAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ ChiaraInboundChatLog done (${ok} inserted, ${skip} skipped)`);

        // ── 11. ChiaraLead ──
        console.log(`Importing ChiaraLead (${tables.ChiaraLead.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.ChiaraLead.data) {
            const res = await safeExec(
                `INSERT INTO chiara_leads (id, session_id, name, email, phone, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [row.id, row.sessionId, row.name, row.email, row.phone, new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ ChiaraLead done (${ok} inserted, ${skip} skipped)`);

        // ── 12. TagField ──
        console.log(`Importing TagField (${tables.TagField.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.TagField.data) {
            const res = await safeExec(
                `INSERT INTO "TagField" (id, "tagName", description, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5)`,
                [row.id, row.tagName, row.description, new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ TagField done (${ok} inserted, ${skip} skipped)`);

        // ── 13. Tag ──
        console.log(`Importing Tag (${tables.Tag.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.Tag.data) {
            const res = await safeExec(
                `INSERT INTO "Tag" (id, "sessionId", tags, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5)`,
                [row.id, row.sessionId, row.tags, new Date(row.createdAt), new Date(row.updatedAt)]
            );
            res ? ok++ : skip++;
        }
        console.log(`  ✓ Tag done (${ok} inserted, ${skip} skipped)`);

        // Reset auto-increment sequences
        console.log('\nResetting auto-increment sequences...');
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('chat_logs', 'id'), COALESCE((SELECT MAX(id) FROM chat_logs), 0) + 1, false)`);
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('chiara_inbound_chat_logs', 'id'), COALESCE((SELECT MAX(id) FROM chiara_inbound_chat_logs), 0) + 1, false)`);
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('chiara_leads', 'id'), COALESCE((SELECT MAX(id) FROM chiara_leads), 0) + 1, false)`);
        console.log('  ✓ Sequences reset');

        console.log('\n✅ All data imported successfully to Supabase!');
    } catch (error) {
        console.error('\n❌ Import failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

importDatabase();
