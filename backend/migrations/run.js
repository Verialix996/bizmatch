require('dotenv').config();
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const DB_PATH = path.join(DATA_DIR, 'bizmatch.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
  console.log(`Running migration: ${file}`);
  db.exec(sql);
}

console.log('All migrations completed. DB file:', DB_PATH);
db.close();
