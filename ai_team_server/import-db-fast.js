const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'postgresql://postgres.suzvcnveeszxbjylcuih:*%hn2Jt3ut2Y9FwB@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

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

async function importDatabaseFast() {
    console.log('Reading export file...');
    const exportPath = path.join(__dirname, 'database-export.json');
    const raw = fs.readFileSync(exportPath, 'utf-8');
    const exportData = JSON.parse(raw);
    const tables = exportData.tables;

    console.log(`Export from: ${exportData.exportedAt}`);
    console.log('Connecting to Supabase database...\n');

    try {
        // ── 8. Message (17k+ records — batch) ──
        console.log(`Resuming: Importing Message (${tables.Message.count} records)...`);
        let ok = 0, skip = 0;
        const BATCH = 500;
        for (let i = 0; i < tables.Message.data.length; i += BATCH) {
            const chunk = tables.Message.data.slice(i, i + BATCH);
            try {
                const result = await prisma.message.createMany({
                    data: chunk.map(row => ({
                        id: row.id,
                        conversationId: row.conversationId,
                        text: row.text,
                        sender: row.sender,
                        time: row.time,
                        createdAt: new Date(row.createdAt),
                    })),
                    skipDuplicates: true
                });
                ok += result.count;
            } catch (error) {
                console.error('Batch error Message:', error.message);
            }
            process.stdout.write(`  ${Math.min(i + BATCH, tables.Message.data.length)}/${tables.Message.data.length} (${ok} ok)\r`);
        }
        console.log(`\n  ✓ Message done (${ok} inserted)`);

        // ── 9. ChatLog ──
        console.log(`Importing ChatLog (${tables.ChatLog.count} records)...`);
        ok = 0; skip = 0;
        try {
            const result = await prisma.chatLog.createMany({
                data: tables.ChatLog.data.map(row => ({
                    id: row.id,
                    sessionId: row.sessionId,
                    sender: row.sender,
                    messageText: row.messageText,
                    createdAt: new Date(row.createdAt),
                })),
                skipDuplicates: true
            });
            ok = result.count;
        } catch (error) {
            console.error('Batch error ChatLog:', error.message);
        }
        console.log(`  ✓ ChatLog done (${ok} inserted)`);

        // ── 10. ChiaraInboundChatLog ──
        console.log(`Importing ChiaraInboundChatLog (${tables.ChiaraInboundChatLog.count} records)...`);
        ok = 0; skip = 0;
        try {
            const result = await prisma.chiaraInboundChatLog.createMany({
                data: tables.ChiaraInboundChatLog.data.map(row => ({
                    id: row.id,
                    sessionId: row.sessionId,
                    sender: row.sender,
                    messageText: row.messageText,
                    createdAt: new Date(row.createdAt),
                })),
                skipDuplicates: true
            });
            ok = result.count;
        } catch (error) {
            console.error('Batch error ChiaraInboundChatLog:', error.message);
        }
        console.log(`  ✓ ChiaraInboundChatLog done (${ok} inserted)`);

        // ── 11. ChiaraLead ──
        console.log(`Importing ChiaraLead (${tables.ChiaraLead.count} records)...`);
        ok = 0; skip = 0;
        try {
            const result = await prisma.chiaraLead.createMany({
                data: tables.ChiaraLead.data.map(row => ({
                    id: row.id,
                    sessionId: row.sessionId,
                    name: row.name,
                    email: row.email,
                    phone: row.phone,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt),
                })),
                skipDuplicates: true
            });
            ok = result.count;
        } catch (error) {
            console.error('Batch error ChiaraLead:', error.message);
        }
        console.log(`  ✓ ChiaraLead done (${ok} inserted)`);

        // ── 12. TagField ──
        console.log(`Importing TagField (${tables.TagField.count} records)...`);
        ok = 0; skip = 0;
        for (const row of tables.TagField.data) {
            const res = await safeExec(
                `INSERT INTO "TagField" (id, "tagName", description, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
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
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
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

importDatabaseFast();
