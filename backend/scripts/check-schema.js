/**
 * Live DB schema verification.
 *
 * Confirms the table-reduction migrations (004–006) actually landed on the
 * real database — not just in the .sql files. Reuses the app's own pool
 * (src/config/db.js), which reads DATABASE_URL from the environment.
 *
 * Usage:
 *   DATABASE_URL=<railway-url> node backend/scripts/check-schema.js
 *
 * Exits 0 if every assertion passes, 1 otherwise.
 */
require('dotenv').config();
const { query, pool } = require('../src/config/db');

const EXPECTED_TABLES = [
  'users', 'swipes', 'matches',
  'user_auth_security', 'user_profiles', 'investor_profiles', 'user_app_state',
  'projects', 'project_swipes', 'project_matches',
  'messages', 'meetings', 'notifications',
  'project_partners', 'partner_invitations', 'project_ndas',
  'ai_match_scores', 'ai_project_scores',
  'schema_migrations',
];

const DROPPED_TABLES = [
  'profiles', 'ai_compatibility_breakdowns', 'role_change_requests', 'api_usage',
];

const USERS_MUST_HAVE = [
  'email', 'name', 'role', 'is_verified', 'verification_status',
  'deleted_at', 'created_at', 'updated_at',
];
const USERS_MUST_NOT_HAVE = [
  'password_hash', 'otp_code', 'reset_token', 'oauth_provider',
  'two_factor_secret', 'photo_url', 'push_token', 'is_premium',
  'premium_expires_at', 'login_attempts', 'locked_until', 'last_active_at',
  'swipe_count', 'swipe_count_date', 'has_seen_onboarding', 'bio', 'skills',
  'hobbies', 'role_type', 'investment_domain', 'preferred_stage',
  'max_investment', 'portfolio_url', 'linkedin_url', 'experience', 'cv_url',
  'cv_data',
];
const USER_AUTH_MUST_HAVE = ['user_id', 'password_hash', 'otp_code', 'otp_expires_at', 'reset_token', 'reset_token_expires', 'oauth_provider', 'oauth_provider_id', 'two_factor_secret', 'two_factor_enabled', 'login_attempts', 'locked_until'];
const USER_PROFILES_MUST_HAVE = ['user_id', 'photo_url', 'bio', 'skills', 'hobbies', 'role_type', 'portfolio_url', 'linkedin_url', 'experience', 'cv_url'];
const INVESTOR_PROFILES_MUST_HAVE = ['user_id', 'investment_domain', 'preferred_stage', 'max_investment'];
const USER_APP_STATE_MUST_HAVE = ['user_id', 'push_token', 'is_premium', 'premium_expires_at', 'last_active_at', 'swipe_count', 'swipe_count_date', 'has_seen_onboarding'];
const PROJECTS_MUST_HAVE = ['deck_url', 'video_url'];
const PROJECTS_MUST_NOT_HAVE = ['deck_data', 'deck_mime'];

const EXPECTED_MIGRATIONS = [
  '001_create_users.sql',
  '002_create_swipes.sql',
  '003_create_matches.sql',
  '004_create_messages.sql',
  '005_create_projects.sql',
  '006_create_project_swipes.sql',
  '007_create_project_matches.sql',
  '008_create_project_partners.sql',
  '009_create_project_ndas.sql',
  '010_create_partner_invitations.sql',
  '011_create_meetings.sql',
  '012_create_ai_match_scores.sql',
  '013_create_notifications.sql',
  '014_create_ai_project_scores.sql',
  '015_create_user_auth_security.sql',
  '016_create_user_profiles.sql',
  '017_create_investor_profiles.sql',
  '019_create_user_app_state.sql',
];

const results = [];
function check(label, pass, detail = '') {
  results.push({ label, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function listTables() {
  const rows = await query('SHOW TABLES');
  // SHOW TABLES returns one column whose name varies (Tables_in_<db>).
  return rows.map(r => Object.values(r)[0]);
}

async function listColumns(table) {
  const rows = await query(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map(r => r.Field);
}

async function main() {
  console.log('--- BizMatch live schema check ---\n');

  const tables = await listTables();

  // 1. Required tables present.
  for (const t of EXPECTED_TABLES) {
    check(`table present: ${t}`, tables.includes(t));
  }

  // 2. Dropped tables absent.
  for (const t of DROPPED_TABLES) {
    check(`table dropped: ${t}`, !tables.includes(t),
      tables.includes(t) ? 'still exists!' : 'gone');
  }

  // 3. users column expectations (normalized user tables).
  if (tables.includes('users')) {
    const cols = await listColumns('users');
    for (const c of USERS_MUST_HAVE) {
      check(`users.${c} exists`, cols.includes(c));
    }
    for (const c of USERS_MUST_NOT_HAVE) {
      check(`users.${c} moved out of users`, !cols.includes(c));
    }
  }

  const normalizedChecks = [
    ['user_auth_security', USER_AUTH_MUST_HAVE],
    ['user_profiles', USER_PROFILES_MUST_HAVE],
    ['investor_profiles', INVESTOR_PROFILES_MUST_HAVE],
    ['user_app_state', USER_APP_STATE_MUST_HAVE],
  ];
  for (const [table, expectedCols] of normalizedChecks) {
    if (tables.includes(table)) {
      const cols = await listColumns(table);
      for (const c of expectedCols) {
        check(`${table}.${c} exists`, cols.includes(c));
      }
    }
  }

  // 4. projects column expectations (blob removal, Cloudinary urls).
  if (tables.includes('projects')) {
    const cols = await listColumns('projects');
    for (const c of PROJECTS_MUST_HAVE) {
      check(`projects.${c} exists`, cols.includes(c));
    }
    for (const c of PROJECTS_MUST_NOT_HAVE) {
      check(`projects.${c} removed (blob)`, !cols.includes(c));
    }
  }

  // 5. All migrations recorded.
  if (tables.includes('schema_migrations')) {
    const rows = await query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map(r => r.filename));
    for (const m of EXPECTED_MIGRATIONS) {
      check(`migration recorded: ${m}`, applied.has(m));
    }
  }

  const failed = results.filter(r => !r.pass);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length) {
    console.log('FAILURES:');
    failed.forEach(f => console.log(`  ❌ ${f.label}${f.detail ? ` — ${f.detail}` : ''}`));
  }
  await pool.end();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Schema check crashed:', err.message);
  try { await pool.end(); } catch {}
  process.exit(1);
});
