/**
 * BizMatch — Railway MySQL seed script
 *
 * Wipes the DB and rebuilds with:
 *   5 investors  (sarah.chen@bizmatch.app, etc.)
 *   5 entrepreneurs (alex.rivera@bizmatch.app, etc.)
 *   5 pre-made mutual matches with chat histories
 *
 * All passwords: Demo1234!
 *
 * Usage:
 *   DATABASE_URL="mysql://user:pass@host:port/db" node backend/scripts/seed.js
 *   — or —
 *   Set DATABASE_URL in backend/.env, then: node backend/scripts/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

const DROP_ORDER = [
  'notifications',
  'messages', 'meetings', 'project_ndas', 'partner_invitations',
  'project_partners', 'project_matches', 'project_swipes',
  'ai_project_scores', 'ai_match_scores',
  'swipes', 'matches', 'projects',
  'user_auth_security', 'user_profiles', 'investor_profiles', 'user_app_state',
  'users', 'schema_migrations',
];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var is not set.');
  process.exit(1);
}

const PASSWORD_HASH = bcrypt.hashSync('Demo1234!', 10);

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

// randomuser.me portraits — explicit /women/ and /men/ paths guarantee correct gender
const INVESTORS = [
  { name: 'Sarah Chen',   email: 'sarah.chen@bizmatch.app',   avatar: 'https://randomuser.me/api/portraits/women/44.jpg', domain: 'SaaS,B2B Software',    stage: 'mvp',    max: 500000,  skills: ['SaaS Strategy', 'Product-Led Growth', 'Board Advisory'],       bio: 'Early-stage SaaS investor with 12 years backing B2B software companies. Former product lead at Salesforce. I write the first check and sit on the board.' },
  { name: 'Marcus Webb',  email: 'marcus.webb@bizmatch.app',  avatar: 'https://randomuser.me/api/portraits/men/32.jpg',   domain: 'FinTech,Payments',      stage: 'growth', max: 2000000, skills: ['FinTech Regulation', 'Payments Infrastructure', 'Series A'],   bio: 'Partner at Meridian Ventures. Focused on fintech infrastructure and payments. Previously built and sold a payment processing startup.' },
  { name: 'Lena Fischer', email: 'lena.fischer@bizmatch.app', avatar: 'https://randomuser.me/api/portraits/women/25.jpg', domain: 'HealthTech,MedTech',    stage: 'idea',   max: 150000,  skills: ['FDA Pathways', 'Clinical Research', 'MedTech Due Diligence'], bio: 'Angel investor and former ER physician. Backing founders who are fixing healthcare with technology. Love capital-efficient teams.' },
  { name: 'David Okafor', email: 'david.okafor@bizmatch.app', avatar: 'https://randomuser.me/api/portraits/men/76.jpg',   domain: 'Marketplace,eCommerce', stage: 'mvp',    max: 750000,  skills: ['Marketplace Dynamics', 'Supply Chain', 'Unit Economics'],      bio: 'Operator-turned-investor. I built two marketplace startups and now back the next generation. Strong network in logistics and supply chain.' },
  { name: 'Priya Nair',   email: 'priya.nair@bizmatch.app',   avatar: 'https://randomuser.me/api/portraits/women/68.jpg', domain: 'EdTech,Future of Work', stage: 'mvp',    max: 300000,  skills: ['EdTech Partnerships', 'Curriculum Design', 'Global Scaling'], bio: 'EdTech-focused investor and ex-Coursera. Passionate about upskilling and workforce development in emerging markets.' },
];

const ENTREPRENEURS = [
  { name: 'Alex Rivera', email: 'alex.rivera@bizmatch.app', avatar: 'https://randomuser.me/api/portraits/men/22.jpg',   icon: 'https://img.icons8.com/fluency/96/cloud-sync.png',      title: 'TeamSync',     industry: 'SaaS',        stage: 'mvp',    needs: 400000,  skills: ['SaaS','Product Management','Engineering'],   hobbies: ['chess','running','gaming'],   bio: 'Ex-Google engineer building the async collaboration tool remote teams actually love. TeamSync combines video updates, task threads and AI meeting summaries. 800 paying teams after 6 months.' },
  { name: 'Mia Johnson', email: 'mia.johnson@bizmatch.app', avatar: 'https://randomuser.me/api/portraits/women/33.jpg', icon: 'https://img.icons8.com/fluency/96/money-transfer.png',   title: 'CashBridge',   industry: 'FinTech',     stage: 'growth', needs: 2000000, skills: ['FinTech','Mobile','Growth Hacking'],         hobbies: ['cooking','travel','reading'], bio: 'CEO of CashBridge, bringing banking to 1.4B unbanked adults in Southeast Asia. Revenue positive, processing $3M monthly. Looking for a Series A partner who believes financial inclusion is a real market.' },
  { name: 'Jordan Lee',  email: 'jordan.lee@bizmatch.app',  avatar: 'https://randomuser.me/api/portraits/men/45.jpg',   icon: 'https://img.icons8.com/fluency/96/smartwatch.png',       title: 'VitalBand',    industry: 'HealthTech',  stage: 'idea',   needs: 120000,  skills: ['Hardware','Machine Learning','BioSignals'],  hobbies: ['cycling','yoga','podcasts'],  bio: 'MD and ML engineer building a wearable that predicts health events 48 hours before symptoms appear. First prototype detects atrial fibrillation with 94% accuracy. Raising pre-seed to finish FDA validation.' },
  { name: 'Zara Ahmed',  email: 'zara.ahmed@bizmatch.app',  avatar: 'https://randomuser.me/api/portraits/women/52.jpg', icon: 'https://img.icons8.com/fluency/96/graduation-cap.png',   title: 'LearnArc',     industry: 'EdTech',      stage: 'growth', needs: 1500000, skills: ['EdTech','Content','Community Building'],     hobbies: ['chess','hiking','teaching'], bio: 'Serial entrepreneur on my third venture. LearnArc is an adaptive learning platform with 28k active students across 40 countries. Raised $400k, now scaling. Strong education policy network in MENA and South Asia.' },
  { name: 'Ethan Park',  email: 'ethan.park@bizmatch.app',  avatar: 'https://randomuser.me/api/portraits/men/62.jpg',   icon: 'https://img.icons8.com/fluency/96/online-store.png',     title: 'ArtisanRoute', industry: 'Marketplace', stage: 'mvp',    needs: 500000,  skills: ['Marketplace','Logistics','Community'],       hobbies: ['football','cooking','music'], bio: 'Connecting African artisans to global buyers. 340 sellers across 12 countries, shipping to 40 destinations. Average seller earns 3x their local market rate. Profitable unit economics, seeking seed to expand to Latin America.' },
];

const MATCH_PAIRS = [
  { inv: 'sarah.chen@bizmatch.app',   ent: 'alex.rivera@bizmatch.app', meetingTitle: 'Seed Round Discussion — TeamSync', chat: [
    { from: 'inv', msg: "Hi Alex! TeamSync caught my eye — B2B SaaS at $50/team/month with 800 paying customers is impressive traction. Tell me more about retention." },
    { from: 'ent', msg: "Thanks Sarah! Monthly churn is 2.1% which we're actively working to improve. Annual contracts are stickier — 96% renewal rate there. The big unlock was adding AI meeting summaries which teams now say is their favourite feature." },
    { from: 'inv', msg: "That annual renewal number is strong. What does your expansion revenue look like? Are teams adding seats over time?" },
    { from: 'ent', msg: "Net revenue retention is 118% — teams start with 5-10 seats and grow to 20-30 as they onboard more departments. Sales is entirely inbound right now which is why I'm excited to bring on capital to build an outbound motion." },
  ]},
  { inv: 'marcus.webb@bizmatch.app',  ent: 'mia.johnson@bizmatch.app', meetingTitle: 'Series A Intro Call — CashBridge', chat: [
    { from: 'inv', msg: "Mia, $3M monthly processing and revenue positive in fintech — that's rare. How are you thinking about the regulatory moat as you expand countries?" },
    { from: 'ent', msg: "We partner with local licensed banks in each market rather than getting direct licenses, which is 10x faster to launch. We hold no customer funds ourselves. The moat is our local bank network and the trust we've built with communities that other apps haven't touched." },
    { from: 'inv', msg: "Smart structure. What's your take rate and how does it compare to incumbents?" },
    { from: 'ent', msg: "We charge 1.8% on transfers vs the 5-8% that Western Union and local agents charge. Even at our rate we're dramatically cheaper and the convenience is incomparable. Gross margin is 62% once you strip out payment processing costs." },
  ]},
  { inv: 'lena.fischer@bizmatch.app', ent: 'jordan.lee@bizmatch.app',  meetingTitle: 'Pre-Seed Check-in — VitalBand', chat: [
    { from: 'inv', msg: "Jordan — as a physician investor this is exactly what I look for. 94% AFib detection accuracy is publishable. Where are you in the FDA pathway?" },
    { from: 'ent', msg: "We're pursuing De Novo classification which is typically 12-18 months. We have a regulatory consultant who worked at FDA for 8 years guiding us. The pre-submission meeting went well — no major red flags. We're building the clinical evidence package now." },
    { from: 'inv', msg: "The pre-sub meeting result is the key signal I needed. What does the $120k pre-seed cover specifically?" },
    { from: 'ent', msg: "It covers the 510k-equivalent clinical study (40 patients, 3 sites), miniaturisation of the prototype, and 6 months runway for myself and my co-founder who is handling the ML side. We close pre-seed by end of Q2 and expect to have FDA clearance within 18 months of that." },
  ]},
  { inv: 'david.okafor@bizmatch.app', ent: 'ethan.park@bizmatch.app',  meetingTitle: 'Marketplace Deep Dive — ArtisanRoute', chat: [
    { from: 'inv', msg: "Ethan, marketplace unit economics are my speciality. Walk me through your take rate and seller payback period." },
    { from: 'ent', msg: "We take 12% on each transaction. Sellers pay nothing to list. Average seller does $800/month in sales on the platform, earning $704 net after our fee. A seller who earns $30/month locally now earns $700+ — that's transformational income. Seller acquisition cost is $45 and payback is under 2 months." },
    { from: 'inv', msg: "CAC payback under 2 months is excellent. What's your buyer-side retention looking like? That's usually the harder side of the marketplace." },
    { from: 'ent', msg: "Buyer 6-month retention is 61%, which we know needs work. We're building a subscription 'curated box' product to create a recurring relationship. Buyers who subscribe retain at 89%. That's what the seed round is primarily funding — the subscription product and buyer acquisition." },
  ]},
  { inv: 'priya.nair@bizmatch.app',   ent: 'zara.ahmed@bizmatch.app',  meetingTitle: 'Growth Strategy Call — LearnArc', chat: [
    { from: 'inv', msg: "Zara, your traction in EdTech is outstanding. 28k students across 40 countries without raising a Series A is impressive. What's your business model?" },
    { from: 'ent', msg: "We charge institutions (universities and corporate training departments) a per-seat SaaS fee of $12/month. 40% of revenue comes from direct B2C subscriptions at $8/month. The institutional channel is where we see the best LTV — average contract is 3 years." },
    { from: 'inv', msg: "The institutional channel resonates with me. How are you thinking about content? Is it your own or user-generated?" },
    { from: 'ent', msg: "We're a platform, not a content company. Instructors and institutions publish their own content and we provide the adaptive delivery engine. This means we scale content without scaling headcount. We take 30% revenue share on paid courses sold through our marketplace." },
  ]},
];

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function wipeDatabase(conn) {
  console.log('\nDropping all tables...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of DROP_ORDER) {
    await conn.query(`DROP TABLE IF EXISTS ${t}`);
    console.log(`  dropped ${t}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function runMigrations(conn) {
  console.log('\nRunning migrations...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      run_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await conn.query(sql);
    await conn.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
    console.log(`  ✓ ${file}`);
  }
}

async function createInvestor(conn, inv, photoUrl) {
  const [rows] = await conn.query(
    `INSERT INTO users
       (name, email, role, is_verified)
     VALUES (?, ?, 'investor', 1)`,
    [inv.name, inv.email]
  );
  const userId = rows.insertId;
  await conn.query(
    `INSERT INTO user_auth_security (user_id, password_hash)
     VALUES (?, ?)`,
    [userId, PASSWORD_HASH]
  );
  await conn.query(
    `INSERT INTO user_profiles (user_id, role_type, bio, skills, photo_url)
     VALUES (?, 'investor', ?, ?, ?)`,
    [userId, inv.bio, JSON.stringify(inv.skills), photoUrl]
  );
  await conn.query(
    `INSERT INTO investor_profiles (user_id, investment_domain, preferred_stage, max_investment)
     VALUES (?, ?, ?, ?)`,
    [userId, inv.domain, inv.stage, inv.max]
  );
  await conn.query(
    `INSERT INTO user_app_state (user_id, has_seen_onboarding)
     VALUES (?, 1)`,
    [userId]
  );
  return userId;
}

async function createEntrepreneur(conn, ent, photoUrl) {
  const [rows] = await conn.query(
    `INSERT INTO users
       (name, email, role, is_verified)
     VALUES (?, ?, 'entrepreneur', 1)`,
    [ent.name, ent.email]
  );
  const userId = rows.insertId;
  await conn.query(
    `INSERT INTO user_auth_security (user_id, password_hash)
     VALUES (?, ?)`,
    [userId, PASSWORD_HASH]
  );
  await conn.query(
    `INSERT INTO user_profiles (user_id, role_type, bio, skills, hobbies, photo_url)
     VALUES (?, 'entrepreneur', ?, ?, ?, ?)`,
    [userId, ent.bio, JSON.stringify(ent.skills), JSON.stringify(ent.hobbies), photoUrl]
  );
  await conn.query(
    `INSERT INTO user_app_state (user_id, has_seen_onboarding)
     VALUES (?, 1)`,
    [userId]
  );
  return userId;
}

async function createProject(conn, userId, ent) {
  await conn.query(
    `INSERT INTO projects (user_id, title, description, industry, stage, funding_needed, visibility, icon_url)
     VALUES (?, ?, ?, ?, ?, ?, 'public', ?)`,
    [userId, ent.title, ent.bio, ent.industry, ent.stage, ent.needs, ent.icon || null]
  );
}

async function createMatch(conn, invId, entId) {
  const [u1, u2] = invId < entId ? [invId, entId] : [entId, invId];
  await conn.query('INSERT IGNORE INTO swipes (swiper_id, swiped_id, direction) VALUES (?, ?, ?)', [invId, entId, 'like']);
  await conn.query('INSERT IGNORE INTO swipes (swiper_id, swiped_id, direction) VALUES (?, ?, ?)', [entId, invId, 'like']);
  await conn.query('INSERT IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)', [u1, u2]);
  const [rows] = await conn.query('SELECT id FROM matches WHERE user1_id = ? AND user2_id = ?', [u1, u2]);
  if (!rows[0]) throw new Error(`Match insert failed for users ${u1} and ${u2}`);
  return rows[0].id;
}

async function createMeeting(conn, matchId, proposerId, receiverId, title, scheduledAt) {
  await conn.query(
    `INSERT INTO meetings (match_id, proposer_id, receiver_id, title, scheduled_at, location_type, video_link, status)
     VALUES (?, ?, ?, ?, ?, 'virtual', 'https://meet.google.com/bizmatch-demo', 'confirmed')`,
    [matchId, proposerId, receiverId, title, scheduledAt]
  );
}

async function createNotification(conn, userId, type, refId, payload) {
  await conn.query(
    `INSERT INTO notifications (user_id, type, ref_id, payload) VALUES (?, ?, ?, ?)`,
    [userId, type, refId, JSON.stringify(payload)]
  );
}

async function seedChat(conn, matchId, invId, entId, messages) {
  for (const m of messages) {
    const senderId = m.from === 'inv' ? invId : entId;
    await conn.query(
      'INSERT INTO messages (match_id, sender_id, body) VALUES (?, ?, ?)',
      [matchId, senderId, m.msg]
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const conn = await mysql.createConnection({ uri: DATABASE_URL, multipleStatements: true });
  console.log('Connected to Railway MySQL.');

  await wipeDatabase(conn);

  console.log('\nAll tables dropped.');
  const answer = await confirm('Rebuild schema and seed data? Type "yes" to continue: ');
  if (answer !== 'yes') {
    console.log('Aborted. Tables have been dropped but not rebuilt.');
    await conn.end();
    process.exit(0);
  }

  await runMigrations(conn);

  // --- Investors ---
  console.log('\nCreating 5 investors...');
  const invMap = {};
  for (const inv of INVESTORS) {
    const id = await createInvestor(conn, inv, inv.avatar);
    invMap[inv.email] = id;
    console.log(`  ✓ ${inv.name}`);
  }

  // --- Entrepreneurs ---
  console.log('\nCreating 5 entrepreneurs + projects...');
  const entMap = {};
  for (const ent of ENTREPRENEURS) {
    const id = await createEntrepreneur(conn, ent, ent.avatar);
    await createProject(conn, id, ent);
    entMap[ent.email] = id;
    console.log(`  ✓ ${ent.name} — project: ${ent.title}`);
  }

  // --- Pre-made matches + chats + meetings + notifications ---
  console.log('\nCreating 5 pre-made matches with chat histories, meetings and notifications...');
  const baseDate = new Date();
  baseDate.setHours(14, 0, 0, 0);
  for (let i = 0; i < MATCH_PAIRS.length; i++) {
    const pair = MATCH_PAIRS[i];
    const invId = invMap[pair.inv];
    const entId = entMap[pair.ent];
    if (!invId || !entId) { console.log(`  skip (user not found): ${pair.inv} / ${pair.ent}`); continue; }

    const matchId = await createMatch(conn, invId, entId);
    await seedChat(conn, matchId, invId, entId, pair.chat);

    const meetingDate = new Date(baseDate);
    meetingDate.setDate(baseDate.getDate() + 7 + i);
    await createMeeting(conn, matchId, invId, entId, pair.meetingTitle, meetingDate);

    await createNotification(conn, invId, 'match', matchId, { matchId });
    await createNotification(conn, entId, 'match', matchId, { matchId });

    console.log(`  ✓ match: ${pair.inv.split('@')[0]} ↔ ${pair.ent.split('@')[0]} (${pair.chat.length} msgs · meeting ${meetingDate.toDateString()})`);
  }

  await conn.end();

  console.log('\n========================================');
  console.log('  Database rebuilt successfully!');
  console.log('  All accounts: password = Demo1234!');
  console.log('');
  console.log('  Investors:');
  console.log('    sarah.chen@bizmatch.app    (SaaS)');
  console.log('    marcus.webb@bizmatch.app   (FinTech)');
  console.log('    lena.fischer@bizmatch.app  (HealthTech)');
  console.log('    david.okafor@bizmatch.app  (Marketplace)');
  console.log('    priya.nair@bizmatch.app    (EdTech)');
  console.log('');
  console.log('  Entrepreneurs:');
  console.log('    alex.rivera@bizmatch.app   (TeamSync — SaaS)');
  console.log('    mia.johnson@bizmatch.app   (CashBridge — FinTech)');
  console.log('    jordan.lee@bizmatch.app    (VitalBand — HealthTech)');
  console.log('    zara.ahmed@bizmatch.app    (LearnArc — EdTech)');
  console.log('    ethan.park@bizmatch.app    (ArtisanRoute — Marketplace)');
  console.log('========================================\n');
}

async function confirm(question) {
  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => readline.question(question, ans => { readline.close(); resolve(ans.trim()); }));
}

async function main() {
  console.log('\n⚠️  WARNING: This will DROP all tables. All existing data will be permanently deleted.\n');
  const answer = await confirm('Type "yes" to drop all tables: ');
  if (answer !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }
  await run();
}

main().catch(err => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
