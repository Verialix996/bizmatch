/**
 * Seed script — creates demo users + profiles for testing the swipe/match algo.
 * Run: node scripts/seed.js
 *
 * Creates:
 *   Investors  (3)
 *   Entrepreneurs (5)
 *
 * All passwords: Password123!
 * All accounts are pre-verified so they show up in the feed immediately.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/bizmatch.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const PASSWORD_HASH = bcrypt.hashSync('Password123!', 10);

// ─── Seed data ───────────────────────────────────────────────────────────────

const investors = [
  {
    email: 'sarah.invest@demo.com',
    name: 'Sarah Chen',
    role: 'investor',
    profile: {
      bio: 'Early-stage tech investor with 10 years experience. Passionate about B2B SaaS and deep tech.',
      investment_domain: 'SaaS',
      preferred_stage: 'mvp',
      max_investment: 500000,
      hobbies: JSON.stringify(['chess', 'hiking', 'reading']),
      skills: JSON.stringify(['due diligence', 'financial modeling', 'board advisory']),
    },
  },
  {
    email: 'mark.vc@demo.com',
    name: 'Mark Osei',
    role: 'investor',
    profile: {
      bio: 'Partner at a growth-stage fund. Focus on fintech and marketplace startups in emerging markets.',
      investment_domain: 'fintech',
      preferred_stage: 'growth',
      max_investment: 2000000,
      hobbies: JSON.stringify(['football', 'cooking', 'travel']),
      skills: JSON.stringify(['portfolio management', 'market expansion', 'fundraising']),
    },
  },
  {
    email: 'lena.angel@demo.com',
    name: 'Lena Müller',
    role: 'investor',
    profile: {
      bio: 'Angel investor & former founder. I back idea-stage founders with money and mentorship.',
      investment_domain: 'healthtech',
      preferred_stage: 'idea',
      max_investment: 100000,
      hobbies: JSON.stringify(['yoga', 'reading', 'cycling']),
      skills: JSON.stringify(['product strategy', 'go-to-market', 'mentorship']),
    },
  },
];

const entrepreneurs = [
  {
    email: 'alex.founder@demo.com',
    name: 'Alex Rivera',
    role: 'entrepreneur',
    profile: {
      bio: 'Building a B2B SaaS tool for remote team collaboration. Ex-Google engineer.',
      role_type: 'entrepreneur',
      venture_stage: 'mvp',
      funding_needs: 300000,
      investment_domain: 'SaaS',
      skills: JSON.stringify(['SaaS', 'engineering', 'product management']),
      hobbies: JSON.stringify(['chess', 'running', 'gaming']),
    },
  },
  {
    email: 'nina.startup@demo.com',
    name: 'Nina Patel',
    role: 'entrepreneur',
    profile: {
      bio: 'Founder of a fintech app targeting unbanked populations in Southeast Asia. Revenue positive.',
      role_type: 'entrepreneur',
      venture_stage: 'growth',
      funding_needs: 1500000,
      investment_domain: 'fintech',
      skills: JSON.stringify(['fintech', 'mobile', 'growth hacking']),
      hobbies: JSON.stringify(['cooking', 'travel', 'reading']),
    },
  },
  {
    email: 'james.ceo@demo.com',
    name: 'James Kim',
    role: 'entrepreneur',
    profile: {
      bio: 'Working on an AI-powered health monitoring wearable. Medical background + ML expertise.',
      role_type: 'entrepreneur',
      venture_stage: 'idea',
      funding_needs: 80000,
      investment_domain: 'healthtech',
      skills: JSON.stringify(['healthtech', 'machine learning', 'hardware']),
      hobbies: JSON.stringify(['cycling', 'yoga', 'podcasts']),
    },
  },
  {
    email: 'priya.build@demo.com',
    name: 'Priya Sharma',
    role: 'entrepreneur',
    profile: {
      bio: 'Serial entrepreneur on her 3rd venture — edtech platform with 10k active students.',
      role_type: 'entrepreneur',
      venture_stage: 'growth',
      funding_needs: 750000,
      investment_domain: 'edtech',
      skills: JSON.stringify(['edtech', 'content', 'community building']),
      hobbies: JSON.stringify(['chess', 'hiking', 'reading']),
    },
  },
  {
    email: 'tom.mvp@demo.com',
    name: 'Tom Adeyemi',
    role: 'entrepreneur',
    profile: {
      bio: 'Building a marketplace for African artisans to sell globally. MVP live, 200 sellers onboarded.',
      role_type: 'entrepreneur',
      venture_stage: 'mvp',
      funding_needs: 200000,
      investment_domain: 'marketplace',
      skills: JSON.stringify(['marketplace', 'logistics', 'community']),
      hobbies: JSON.stringify(['football', 'cooking', 'music']),
    },
  },
];

// ─── Insert helpers ───────────────────────────────────────────────────────────

function insertUser({ email, name, role }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    console.log(`  skip (exists): ${email}`);
    return existing.id;
  }
  const res = db.prepare(
    'INSERT INTO users (email, password_hash, role, name, is_verified) VALUES (?, ?, ?, ?, 1)'
  ).run(email, PASSWORD_HASH, role, name);
  return res.lastInsertRowid;
}

function insertProfile(userId, role, data) {
  const existing = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(userId);
  if (existing) return;

  db.prepare(
    `INSERT INTO profiles
       (user_id, bio, skills, hobbies, role_type,
        venture_stage, funding_needs,
        investment_domain, preferred_stage, max_investment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    data.bio || null,
    data.skills || null,
    data.hobbies || null,
    role,
    data.venture_stage || null,
    data.funding_needs || null,
    data.investment_domain || null,
    data.preferred_stage || null,
    data.max_investment || null,
  );
}

// ─── Demo projects ────────────────────────────────────────────────────────────

const demoProjects = [
  {
    ownerEmail: 'alex.founder@demo.com',
    projects: [
      {
        title: 'TeamSync',
        description: 'B2B SaaS platform for async remote collaboration — video updates, task threads, and AI meeting summaries in one workspace.',
        stage: 'mvp',
        funding_needed: 300000,
        industry: 'SaaS',
        deck_url: null,
        video_url: null,
      },
    ],
  },
  {
    ownerEmail: 'nina.startup@demo.com',
    projects: [
      {
        title: 'CashBridge',
        description: 'Mobile-first fintech app giving unbanked populations in Southeast Asia access to savings, credit, and cross-border transfers.',
        stage: 'growth',
        funding_needed: 1500000,
        industry: 'FinTech',
        deck_url: null,
        video_url: null,
      },
    ],
  },
  {
    ownerEmail: 'james.ceo@demo.com',
    projects: [
      {
        title: 'VitalBand',
        description: 'AI-powered health monitoring wearable that predicts anomalies 48 hours before symptoms appear using continuous biometric tracking.',
        stage: 'idea',
        funding_needed: 80000,
        industry: 'HealthTech',
        deck_url: null,
        video_url: null,
      },
    ],
  },
  {
    ownerEmail: 'priya.build@demo.com',
    projects: [
      {
        title: 'LearnArc',
        description: 'Adaptive edtech platform that personalises learning paths using spaced repetition and peer cohort matching. 10k active students.',
        stage: 'growth',
        funding_needed: 750000,
        industry: 'EdTech',
        deck_url: null,
        video_url: null,
      },
      {
        title: 'MentorLoop',
        description: 'Cohort-based mentorship marketplace connecting early-career professionals with vetted industry mentors for 12-week programmes.',
        stage: 'mvp',
        funding_needed: 200000,
        industry: 'EdTech',
        deck_url: null,
        video_url: null,
      },
    ],
  },
  {
    ownerEmail: 'tom.mvp@demo.com',
    projects: [
      {
        title: 'ArtisanRoute',
        description: 'Global marketplace connecting African artisans directly with buyers worldwide. 200+ sellers onboarded, shipping to 34 countries.',
        stage: 'mvp',
        funding_needed: 200000,
        industry: 'Marketplace',
        deck_url: null,
        video_url: null,
      },
    ],
  },
];

function insertProjects(userId, projectList) {
  for (const p of projectList) {
    const existing = db.prepare('SELECT id FROM projects WHERE user_id = ? AND title = ?')
      .get(userId, p.title);
    if (existing) {
      console.log(`    skip project (exists): ${p.title}`);
      continue;
    }
    db.prepare(
      `INSERT INTO projects (user_id, title, description, stage, funding_needed, industry, deck_url, video_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, p.title, p.description, p.stage, p.funding_needed, p.industry, p.deck_url, p.video_url);
    console.log(`    ✓ project: ${p.title}`);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('\nSeeding investors...');
for (const u of investors) {
  const id = insertUser(u);
  insertProfile(id, 'investor', u.profile);
  console.log(`  ✓ ${u.name} (${u.email})`);
}

console.log('\nSeeding entrepreneurs...');
const entrepreneurIds = {};
for (const u of entrepreneurs) {
  const id = insertUser(u);
  insertProfile(id, 'entrepreneur', u.profile);
  entrepreneurIds[u.email] = id;
  console.log(`  ✓ ${u.name} (${u.email})`);
}

console.log('\nSeeding demo projects...');
for (const { ownerEmail, projects } of demoProjects) {
  const ownerId = entrepreneurIds[ownerEmail];
  if (!ownerId) { console.log(`  skip (owner not found): ${ownerEmail}`); continue; }
  console.log(`  ${ownerEmail}:`);
  insertProjects(ownerId, projects);
}

console.log('\nDone! All demo accounts use password: Password123!\n');
db.close();
