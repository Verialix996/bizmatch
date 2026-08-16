// Adds three NEW founder accounts (unteamed, full evidence) to the new
// eu-west-3 project's existing dataset, purely additive — never touches or
// re-upserts any of the founders/teams already in seed-founders.mjs or
// created manually in the live app. Exists so Phase 3's scoring-trust fixes
// (MAT-01 teammate exclusion, MAT-03 risk-gated team creation, team-level
// provisional indicator, DNA-03 null-vs-zero radar) have fresh, non-empty
// compatibility data to test against — the original seed's unteamed
// founders (Daniel Katz, ido koperli) were the only ones left, which wasn't
// enough variety.
//
// Run: node backend/scripts/seed-founders-phase3.mjs
// Requires backend/.env pointed at the CURRENT (eu-west-3) project.
// Re-runnable (upserts by email, only ever touches the 3 emails below).

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("dotenv").config({ path: new URL("../.env", import.meta.url).pathname });

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
if (!SUPABASE_URL || !SERVICE_KEY || !DATABASE_URL) {
  throw new Error("backend/.env must define SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL");
}

const PASSWORD = "Demo1234!";
const API = `${SUPABASE_URL}/functions/v1`;
const EVALUATOR_EMAIL = "evaluator@bizmatch.app";
const PROGRAM_NAME = "BizMatch Pilot Cohort";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const CAP = {
  ENG: "Engineering", PRODUCT: "Product", UX: "UX/UI", SALES: "Sales", GTM: "GTM",
  MKT: "Marketing", OPS: "Operations", FIN: "Finance", FUND: "Fundraising",
  DOMAIN: "Domain Expertise", COMMUNITY: "Community", NETWORK: "Network / Introductions",
  LEAD: "Leadership",
};

const DIMENSIONS = ["execution", "integrity", "commitment", "communication", "conflict", "resilience", "ego", "values"];

// Three brand-new founders — none of these emails exist anywhere in the
// current dataset (verified against GET /founders before writing this).
const NEW_FOUNDERS = [
  {
    email: "priya.mehta@bizmatch.app", name: "Priya Mehta",
    profile: { role_title: "Founder / COO", venture_name: "Northstar Ops", industry: "Logistics", location: "Singapore", current_stage: "mvp", commitment_hours: 55, commitment_type: "full_time", commitment_risk_appetite: "Full-time, second venture after an exit." },
    provides: [CAP.OPS, CAP.FIN, CAP.LEAD],
    needs: [CAP.ENG, CAP.PRODUCT],
    partner: { role_wanted: "Technical Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Dishonesty / broken trust", "Repeated missed deadlines / low accountability"],
    dnaDims: DIMENSIONS, // fully answered — clean high-coverage case
  },
  {
    email: "omar.haddad@bizmatch.app", name: "Omar Haddad",
    profile: { role_title: "Founder / Head of Product", venture_name: "Fieldwise", industry: "AgTech", location: "Dubai", current_stage: "idea", commitment_hours: 40, commitment_type: "part_time", commitment_risk_appetite: "Part-time alongside a day job for now." },
    provides: [CAP.PRODUCT, CAP.UX, CAP.MKT],
    needs: [CAP.ENG, CAP.SALES],
    partner: { role_wanted: "Engineering Co-Founder", commitment_required: "Full Time", ambition_required: "Lifestyle / Steady Growth" },
    dealBreakers: ["Poor communication"],
    dnaDims: ["execution", "commitment", "communication"], // partial — DNA-03 null-vs-zero test case
  },
  {
    email: "leah.fischer@bizmatch.app", name: "Leah Fischer",
    profile: { role_title: "Founder / CEO", venture_name: "Wayline", industry: "Travel Tech", location: "Amsterdam", current_stage: "mvp", commitment_hours: 50, commitment_type: "full_time", commitment_risk_appetite: "All-in, first-time founder." },
    provides: [CAP.SALES, CAP.GTM, CAP.NETWORK],
    needs: [CAP.ENG, CAP.OPS, CAP.FIN],
    partner: { role_wanted: "Technical Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Ego / overclaiming / overselling", "Major values mismatch"],
    dnaDims: [], // no self-assessment at all — empty-state case
  },
];

const ASSESSMENT_ITEMS = {
  "priya.mehta@bizmatch.app": [
    { questionText: "How would you rate their execution and follow-through?", answerType: "scale_1_5", answer: 5, criteriaTag: "execution" },
    { questionText: "How committed and available did they seem?", answerType: "scale_1_5", answer: 5, criteriaTag: "commitment" },
    { questionText: "How direct and clear was their communication?", answerType: "scale_1_5", answer: 4, criteriaTag: "communication" },
  ],
  "omar.haddad@bizmatch.app": [
    { questionText: "How would you rate their execution and follow-through?", answerType: "scale_1_5", answer: 3, criteriaTag: "execution" },
    { questionText: "How did they handle disagreement or critique?", answerType: "scale_1_5", answer: 3, criteriaTag: "conflict" },
  ],
  // Leah: no evaluator assessment — keeps her a low-evidence case.
};

function dnaAnswers(dims) {
  // One string per dimension now (schema changed since the original
  // seed-founders.mjs was written for the up-to-5-answers version).
  const bank = {
    execution: "Shipped a working prototype in five weeks solo, cutting scope myself to hit a demo-day deadline. Landed 3 pilot customers this quarter by triaging customer-facing work first.",
    integrity: "Told a customer a delay honestly instead of overpromising, and flagged our own error in a metrics deck before anyone else caught it.",
    commitment: "Full-time, no other income — turned down consulting work and adjusted my schedule around a co-founder's timezone to stay focused.",
    communication: "Send a weekly update even in quiet weeks, and told a co-founder directly when a decision felt rushed instead of going along with it.",
    conflict: "Ran a small test instead of arguing over pricing with a co-founder, and let a disagreement sit a day before responding so it didn't turn into a fight.",
    resilience: "Found two new pilot customers within a quarter after losing our first one, and kept building when a funding round fell through late.",
    ego: "Dropped an early market thesis once the data contradicted it, and rebuilt a pitch deck from scratch after blunt advisor feedback.",
    values: "Turned down a bigger check over a terms mismatch with how we want to build, and dropped a growth hack that worked but felt manipulative.",
  };
  const out = {};
  for (const dim of DIMENSIONS) out[dim] = dims.includes(dim) ? bank[dim] : null;
  return out;
}

async function upsertAuthUser(email, name) {
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name, role: "founder" } });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user.id;
}

async function signIn(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`signIn(${email}): ${JSON.stringify(data)}`);
  return data.access_token;
}

async function callFn(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function seedFounderProfile(id, f, programId) {
  await pool.query("update public.user_activity set has_seen_onboarding = true where user_id = $1", [id]);
  await pool.query(
    `insert into public.founder_profiles (user_id, role_title, venture_name, industry, location, current_stage, commitment_hours, commitment_type, commitment_risk_appetite, program_id, status, onboarding_completed_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active', now())
     on conflict (user_id) do update set
       role_title = excluded.role_title, venture_name = excluded.venture_name, industry = excluded.industry,
       location = excluded.location, current_stage = excluded.current_stage, commitment_hours = excluded.commitment_hours,
       commitment_type = excluded.commitment_type, commitment_risk_appetite = excluded.commitment_risk_appetite,
       program_id = excluded.program_id, onboarding_completed_at = now()`,
    [id, f.profile.role_title, f.profile.venture_name, f.profile.industry, f.profile.location,
      f.profile.current_stage, f.profile.commitment_hours, f.profile.commitment_type, f.profile.commitment_risk_appetite, programId],
  );
  await pool.query("delete from public.founder_capabilities where founder_id = $1", [id]);
  for (const c of f.provides) await pool.query("insert into public.founder_capabilities (founder_id, kind, capability, score) values ($1,'provide',$2,75)", [id, c]);
  for (const c of f.needs) await pool.query("insert into public.founder_capabilities (founder_id, kind, capability, score) values ($1,'need',$2,75)", [id, c]);
  await pool.query(
    `insert into public.partner_requirements (founder_id, role_wanted, must_provide, commitment_required, ambition_required, preferred_traits)
     values ($1,$2,$3,$4,$5,'[]'::jsonb)
     on conflict (founder_id) do update set
       role_wanted = excluded.role_wanted, must_provide = excluded.must_provide,
       commitment_required = excluded.commitment_required, ambition_required = excluded.ambition_required`,
    [id, f.partner.role_wanted, JSON.stringify(f.needs), f.partner.commitment_required, f.partner.ambition_required],
  );
  await pool.query("delete from public.deal_breakers where founder_id = $1", [id]);
  for (const label of f.dealBreakers) await pool.query("insert into public.deal_breakers (founder_id, label) values ($1,$2) on conflict do nothing", [id, label]);
}

async function main() {
  const programRow = await pool.query("select id from public.programs where name = $1", [PROGRAM_NAME]);
  if (!programRow.rows[0]) throw new Error(`Program "${PROGRAM_NAME}" not found — run seed-founders.mjs first.`);
  const programId = programRow.rows[0].id;
  console.log(`Using existing program: ${PROGRAM_NAME} (${programId})`);

  const evaluatorToken = await signIn(EVALUATOR_EMAIL);

  console.log("Creating 3 new founder accounts + profiles (additive only)...");
  const founderIds = {};
  for (const f of NEW_FOUNDERS) {
    const id = await upsertAuthUser(f.email, f.name);
    founderIds[f.email] = id;
    await seedFounderProfile(id, f, programId);
    console.log(`  founder: ${f.email} (${id})`);
  }

  console.log("Submitting evaluator assessments (skip if already submitted this run)...");
  for (const [email, items] of Object.entries(ASSESSMENT_ITEMS)) {
    try {
      await callFn(evaluatorToken, "POST", "/assessments", { founderId: founderIds[email], notes: "Seeded for Phase 3 fix testing.", items });
      console.log(`  assessment: ${email}`);
    } catch (err) {
      console.log(`  assessment skipped (already submitted / rate-limited): ${email} — ${err.message}`);
    }
  }

  console.log("Submitting DNA self-assessments (Gemini-scored, live calls)...");
  for (const f of NEW_FOUNDERS) {
    if (f.dnaDims.length === 0) { console.log(`  dna self-assessment skipped (intentional): ${f.email}`); continue; }
    try {
      await callFn(evaluatorToken, "POST", `/dna-self-assessment/${founderIds[f.email]}`, { answers: dnaAnswers(f.dnaDims) });
      console.log(`  dna self-assessment: ${f.email} (${f.dnaDims.length}/8 dimensions)`);
    } catch (err) {
      console.log(`  dna self-assessment failed for ${f.email}: ${err.message}`);
    }
  }

  console.log("Recomputing match compatibility for the 3 new founders...");
  for (const f of NEW_FOUNDERS) {
    await callFn(evaluatorToken, "POST", "/matches/recompute", { founderId: founderIds[f.email] });
  }

  // Also refresh the existing Team Lumen members so their cached pairwise
  // compatibility picks up these new unteamed founders too — otherwise
  // MAT-01's teammate-exclusion fix has nothing non-teammate to prove it
  // against (their cache previously only had each other).
  console.log("Refreshing match compatibility for existing Team Lumen members (their profiles are untouched, only recomputing cached scores)...");
  for (const email of ["sarah.chen@bizmatch.app", "marcus.webb@bizmatch.app", "jordan.lee@bizmatch.app"]) {
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = existing.users.find((u) => u.email === email);
    if (!found) { console.log(`  skip (not found): ${email}`); continue; }
    await callFn(evaluatorToken, "POST", "/matches/recompute", { founderId: found.id });
    console.log(`  recomputed: ${email}`);
  }

  console.log("\nDone. New accounts (password: Demo1234!), all unteamed:");
  for (const f of NEW_FOUNDERS) console.log(`  founder: ${f.email}  (${f.profile.venture_name})`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
