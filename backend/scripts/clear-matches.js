/**
 * Clears all swipes and matches from the database.
 * Run: node scripts/clear-matches.js
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/bizmatch.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const results = db.transaction(() => {
  const pm = db.prepare('DELETE FROM project_matches').run();
  const ps = db.prepare('DELETE FROM project_swipes').run();
  const m  = db.prepare('DELETE FROM matches').run();
  const s  = db.prepare('DELETE FROM swipes').run();
  return { projectMatches: pm.changes, projectSwipes: ps.changes, matches: m.changes, swipes: s.changes };
})();

console.log('\nCleared:');
console.log(`  project_matches : ${results.projectMatches} rows`);
console.log(`  project_swipes  : ${results.projectSwipes} rows`);
console.log(`  matches         : ${results.matches} rows`);
console.log(`  swipes          : ${results.swipes} rows`);
console.log('\nDone.\n');

db.close();
