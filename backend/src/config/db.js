const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const DB_PATH = path.join(__dirname, '../../data/bizmatch.db');
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    logger.info(`SQLite connected: ${DB_PATH}`);
  }
  return db;
}

function testConnection() {
  try {
    getDb();
    logger.info('SQLite ready');
  } catch (err) {
    logger.error('SQLite connection failed: ' + err.message);
    process.exit(1);
  }
}

module.exports = { getDb, testConnection };
