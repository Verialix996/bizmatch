const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  waitForConnections: true,
  connectionLimit: 10,
});

async function query(sql, params = []) {
  const sanitized = params.map(p => (p === undefined ? null : p));
  const [rows] = await pool.execute(sql, sanitized);
  return rows;
}

async function testConnection() {
  try {
    await pool.execute('SELECT 1');
    logger.info('MySQL connected');
  } catch (err) {
    logger.error('MySQL connection failed: ' + err.message);
    process.exit(1);
  }
}

module.exports = { query, pool, testConnection };
