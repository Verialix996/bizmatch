/**
 * One-time script: copies all data from bizmatch.db (SQLite) into MySQL.
 * Run AFTER the MySQL schema migrations have completed.
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-mysql.js
 *
 * Requires better-sqlite3 to be available in node_modules.
 * Set DATABASE_URL in .env to point to the target MySQL instance.
 */

require('dotenv').config();
const path = require('path');
const mysql = require('mysql2/promise');

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.error('better-sqlite3 not found. Run: npm install better-sqlite3');
  process.exit(1);
}

const SQLITE_PATH = path.join(__dirname, '../data/bizmatch.db');

// Tables in dependency order (parents before children)
const TABLE_ORDER = [
  'users',
  'profiles',
  'projects',
  'swipes',
  'matches',
  'messages',
  'project_swipes',
  'project_matches',
  'project_partners',
  'project_ndas',
  'partner_invitations',
];

async function migrate() {
  console.log('Opening SQLite:', SQLITE_PATH);
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  console.log('Connecting to MySQL:', process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@'));
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Disable FK checks so we can insert in any order without constraint errors
  await pool.query('SET FOREIGN_KEY_CHECKS=0');

  for (const table of TABLE_ORDER) {
    // Check table exists in SQLite
    const tableExists = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(table);

    if (!tableExists) {
      console.log(`  ${table}: not found in SQLite, skipping`);
      continue;
    }

    const rows = sqlite.prepare(`SELECT * FROM \`${table}\``).all();

    if (!rows.length) {
      console.log(`  ${table}: empty, skipping`);
      continue;
    }

    // Build INSERT from column names of first row
    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => `\`${c}\``).join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`;

    let inserted = 0;
    for (const row of rows) {
      const values = cols.map(c => {
        const v = row[c];
        if (v === undefined || v === null) return null;
        // Convert ISO 8601 timestamps (e.g. "2026-04-08T12:21:27.366Z") to MySQL DATETIME format
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
          return v.replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '');
        }
        return v;
      });
      await pool.execute(sql, values);
      inserted++;
    }

    // Reset AUTO_INCREMENT so future inserts don't collide with migrated IDs
    const maxRow = sqlite.prepare(`SELECT MAX(id) as maxId FROM \`${table}\``).get();
    const maxId = maxRow && maxRow.maxId ? maxRow.maxId : 0;
    await pool.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${maxId + 1}`);

    console.log(`  ${table}: ${inserted} rows migrated (AUTO_INCREMENT reset to ${maxId + 1})`);
  }

  await pool.query('SET FOREIGN_KEY_CHECKS=1');
  sqlite.close();
  await pool.end();

  console.log('\nMigration complete. Verify row counts in MySQL Workbench.');
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
