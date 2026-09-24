import { getDbPool } from '../linkedin/src/db/connection.js';

async function main() {
  try {
    const pool = getDbPool();
    const [tables] = await pool.query('SHOW TABLES');
    console.log('Tables:', tables);

    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [columns] = await pool.query(`DESCRIBE ${tableName}`);
      console.log(`\nTable ${tableName}:`);
      console.log(columns.map(c => `${c.Field} (${c.Type})`));
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
