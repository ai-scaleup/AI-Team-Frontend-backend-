/**
 * migrate-chatlogs.js
 * Copies ALL rows from chat_logs (Render) → chat_logs (Supabase)
 * Only touches the chat_logs table.
 */

const { Client } = require('pg');

const SOURCE_URL =
  'postgresql://aiteam_om7d_user:jdaOURhyB6E51h5FbeMOY3CDn64AiYcH@dpg-d4a1rtvgi27c739q029g-a.frankfurt-postgres.render.com/aiteam_om7d';

const TARGET_URL =
  'postgresql://postgres.gcblmuqxhuitzhrldgrx:r7DS4*7EXhAo2jTc@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1';

async function migrate() {
  const source = new Client({ connectionString: SOURCE_URL, ssl: { rejectUnauthorized: false } });
  const target = new Client({ connectionString: TARGET_URL, ssl: { rejectUnauthorized: false } });

  try {
    console.log('Connecting to source (Render)...');
    await source.connect();

    console.log('Connecting to target (Supabase)...');
    await target.connect();

    // Read all rows from source
    console.log('Reading chat_logs from source...');
    const { rows, rowCount } = await source.query(
      'SELECT id, session_id, sender, message_text, created_at FROM chat_logs ORDER BY id ASC'
    );
    console.log(`Found ${rowCount} rows to migrate.`);

    if (rowCount === 0) {
      console.log('Nothing to migrate. Exiting.');
      return;
    }

    // Ensure target table exists (mirrors Prisma schema)
    console.log('Ensuring target table exists...');
    await target.query(`
      CREATE TABLE IF NOT EXISTS chat_logs (
        id           SERIAL PRIMARY KEY,
        session_id   VARCHAR(255) NOT NULL,
        sender       VARCHAR(50)  NOT NULL,
        message_text TEXT         NOT NULL,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      // Build multi-row INSERT with ON CONFLICT DO NOTHING to avoid duplicates on re-run
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const row of batch) {
        values.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
        );
        params.push(row.id, row.session_id, row.sender, row.message_text, row.created_at);
      }

      const sql = `
        INSERT INTO chat_logs (id, session_id, sender, message_text, created_at)
        VALUES ${values.join(', ')}
        ON CONFLICT (id) DO NOTHING
      `;

      await target.query(sql, params);
      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${rowCount} rows...`);
    }

    // Sync the serial sequence so future inserts don't collide
    await target.query(`
      SELECT setval(
        pg_get_serial_sequence('chat_logs', 'id'),
        COALESCE((SELECT MAX(id) FROM chat_logs), 1)
      );
    `);

    console.log(`\nDone! ${inserted} rows migrated to Supabase chat_logs.`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  }
}

migrate();
