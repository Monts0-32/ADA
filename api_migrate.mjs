// api_migrate.mjs

// --- CONFIGURATION ---
const API_TOKEN = "cfut_VPKEn7Rtem9e3BCniazHXKDr2yiv2iQZAcgEzQxs56291337";

const SRC_ACCOUNT_ID = "c72dbb4c9ddf9f4493628d1f61c41fc9";
const SRC_DB_ID = "c571d734-d769-4079-9b77-25ed94f79cf3";

const TRG_ACCOUNT_ID = "f244515501a7b6859b8bcf7343a012cb";
const TRG_DB_ID = "1975e238-a34e-4195-a3da-2a61bd32d67f";
// ---------------------

async function queryDB(accountId, dbId, sql) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql })
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Cloudflare API Error: ${JSON.stringify(data.errors)}`);
  }

  const resultBlock = Array.isArray(data.result) ? data.result[0] : data.result;
  
  if (!resultBlock.success) {
    throw new Error(`SQL Execution Failure: ${JSON.stringify(resultBlock.errors || 'Unknown error')}`);
  }

  return resultBlock.results || [];
}

async function startMigration() {
  try {
    console.log("⏳ Fetching user tables from source database...");
    
    // Get all custom tables (ignoring D1 internal tracking tables)
    const tables = await queryDB(
      SRC_ACCOUNT_ID, 
      SRC_DB_ID, 
      "SELECT name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%';"
    );

    console.log(`✅ Found ${tables.length} tables to migrate.\n`);

    for (const table of tables) {
      console.log(`--------------------------------------------------`);
      console.log(`📦 Table: ${table.name}`);
      
      // 1. Recreate table structure in the target database
      console.log(`   ↳ Creating table schema in target...`);
      await queryDB(TRG_ACCOUNT_ID, TRG_DB_ID, table.sql);

      // 2. Get total row count from source
      const countRes = await queryDB(SRC_ACCOUNT_ID, SRC_DB_ID, `SELECT COUNT(*) as count FROM "${table.name}"`);
      const totalRows = countRes[0].count;
      console.log(`   ↳ Total rows found: ${totalRows}`);

      if (totalRows === 0) {
        console.log(`   ↳ Table empty. Moving to next.`);
        continue;
      }

      // 3. Paginate, escape data, and copy over in safe chunks of 100 rows
      let offset = 0;
      const chunkSize = 100;

      while (offset < totalRows) {
        const rows = await queryDB(
          SRC_ACCOUNT_ID, 
          SRC_DB_ID, 
          `SELECT * FROM "${table.name}" LIMIT ${chunkSize} OFFSET ${offset}`
        );
        
        if (rows.length === 0) break;

        const columns = Object.keys(rows[0]).map(col => `"${col}"`).join(', ');
        const valueStrings = [];

        for (const row of rows) {
          const formattedValues = Object.values(row).map(val => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 1 : 0;
            if (typeof val === 'object') {
              // Convert JSON objects/arrays cleanly back to strings, escaping internal quotes
              return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            }
            // Standard string escaping for SQLite (single quote doubled up)
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          valueStrings.push(`(${formattedValues.join(', ')})`);
        }

        // We temporarily turn off foreign key enforcement inside the specific request transaction block
        const insertSql = `
          PRAGMA foreign_keys = OFF;
          INSERT INTO "${table.name}" (${columns}) VALUES ${valueStrings.join(', ')};
        `;

        await queryDB(TRG_ACCOUNT_ID, TRG_DB_ID, insertSql);
        
        offset += rows.length;
        console.log(`   ↳ Progress: ${offset}/${totalRows} rows copied...`);
      }
      console.log(`✅ Finished migrating table: ${table.name}`);
    }

    console.log(`\n🎉 Migration successfully completed!`);

  } catch (error) {
    console.error(`\n❌ Migration failed:`, error.message);
  }
}

startMigration();