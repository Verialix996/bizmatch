const { Pool } = require('pg');
const logger = require('../utils/logger');

// Service-role Postgres connection (Supabase connection-pooler URI). Bypasses
// RLS — the Express backend enforces access control at the app level, same as
// before; RLS policies in supabase/migrations exist as defense-in-depth.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
});

async function query(sql, params = []) {
  const sanitized = params.map(p => (p === undefined ? null : p));
  const { rows } = await pool.query(sql, sanitized);
  return rows;
}

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    logger.info('Postgres (Supabase) connected');
  } catch (err) {
    logger.error('Postgres connection failed: ' + err.message);
    process.exit(1);
  }
}

module.exports = { query, pool, testConnection };
