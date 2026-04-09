require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  // Create the database if it doesn't exist yet
  const urlObj = new URL(process.env.DATABASE_URL);
  const dbName = urlObj.pathname.slice(1);
  urlObj.pathname = '/';

  const setupPool = mysql.createPool({
    uri: urlObj.toString(),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  try {
    await setupPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  } catch (err) {
    // Managed MySQL (e.g. Railway) may not allow CREATE DATABASE — ignore and proceed
    console.warn(`Could not auto-create database "${dbName}": ${err.message}`);
  }
  await setupPool.end();

  // Now connect to the actual database
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    multipleStatements: true,
  });

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      run_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const [rows] = await pool.execute(
      'SELECT filename FROM schema_migrations WHERE filename = ?', [file]
    );
    if (rows.length > 0) {
      console.log(`Skipping (already run): ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(sql);
      await conn.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      await conn.commit();
      console.log(`Migrated: ${file}`);
    } catch (err) {
      await conn.rollback();
      throw new Error(`Migration failed for ${file}: ${err.message}`);
    } finally {
      conn.release();
    }
  }

  await pool.end();
  console.log('All migrations complete.');
}

if (require.main === module) {
  runMigrations().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { runMigrations };
