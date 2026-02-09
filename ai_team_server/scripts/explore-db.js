const { Client } = require('pg');

const connectionString = "postgresql://metis_whatsapp_user:TJ88Bm5c1insEC3CVFk9XA9FRi575SEy@dpg-d5kd75e3jp1c73elv6l0-a.frankfurt-postgres.render.com/metis_whatsapp";

async function exploreDatabase() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully!\n');

        // Get all tables
        const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

        const tablesResult = await client.query(tablesQuery);

        console.log('========================================');
        console.log('DATABASE SCHEMA REPORT');
        console.log('========================================\n');

        const schema = {};

        for (const row of tablesResult.rows) {
            const tableName = row.table_name;

            // Get columns for each table
            const columnsQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `;

            const columnsResult = await client.query(columnsQuery, [tableName]);

            // Get row count
            const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
            const rowCount = countResult.rows[0].count;

            schema[tableName] = {
                rowCount,
                columns: columnsResult.rows
            };
        }

        // Print schema
        for (const [tableName, tableInfo] of Object.entries(schema)) {
            console.log(`TABLE: ${tableName}`);
            console.log(`  Row Count: ${tableInfo.rowCount}`);
            console.log('  Columns:');
            for (const col of tableInfo.columns) {
                const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                const defaultVal = col.column_default ? ` DEFAULT: ${col.column_default}` : '';
                console.log(`    - ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`);
            }
            console.log('');
        }

        // Get foreign key relationships
        console.log('========================================');
        console.log('FOREIGN KEY RELATIONSHIPS');
        console.log('========================================\n');

        const fkQuery = `
      SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name;
    `;

        const fkResult = await client.query(fkQuery);

        if (fkResult.rows.length === 0) {
            console.log('No foreign key relationships found.');
        } else {
            for (const fk of fkResult.rows) {
                console.log(`${fk.source_table}.${fk.source_column} --> ${fk.target_table}.${fk.target_column}`);
            }
        }

        // Get indexes
        console.log('\n========================================');
        console.log('INDEXES');
        console.log('========================================\n');

        const indexQuery = `
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;

        const indexResult = await client.query(indexQuery);

        for (const idx of indexResult.rows) {
            console.log(`${idx.tablename}: ${idx.indexname}`);
        }

        // Sample data from each table
        console.log('\n========================================');
        console.log('SAMPLE DATA (first 3 rows per table)');
        console.log('========================================\n');

        for (const [tableName, tableInfo] of Object.entries(schema)) {
            console.log(`TABLE: ${tableName}`);
            try {
                const sampleResult = await client.query(`SELECT * FROM "${tableName}" LIMIT 3`);
                if (sampleResult.rows.length > 0) {
                    console.log(JSON.stringify(sampleResult.rows, null, 2));
                } else {
                    console.log('  (empty table)');
                }
            } catch (e) {
                console.log(`  Error: ${e.message}`);
            }
            console.log('');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
        console.log('\nConnection closed.');
    }
}

exploreDatabase();
