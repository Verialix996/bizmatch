// Seeds fixture data for the Founder Profile pivot's E2E tests: one
// evaluator/admin account plus four founder accounts (Sarah/Marcus/Alex/Mia
// — same names/password convention as the old swipe-app E2E seed accounts,
// per project memory), each with a founder_profiles row, capabilities,
// partner requirements, and a handful of evaluator_assessments/evidence so
// Insights/Evidence Timeline have real data to render against.
//
// Run: node backend/scripts/seed-founders.mjs
// Requires backend/.env: SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL.

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

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const EVALUATOR = { email: "evaluator@bizmatch.app", name: "Priya Shah" };

const FOUNDERS = [
  {
    email: "sarah.chen@bizmatch.app", name: "Sarah Chen",
    profile: { current_role: "Founder / CEO", venture_name: "Lumen Health", industry: "HealthTech", location: "Tel Aviv", current_stage: "mvp", commitment_hours: 55, commitment_type: "full_time", commitment_risk_appetite: "All-in — quit my job to do this." },
    provides: ["Product", "Fundraising", "Leadership"],
    needs: ["Engineering", "Architecture"],
    partner: { role_wanted: "Technical Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Dishonesty", "Part-time"],
  },
  {
    email: "marcus.webb@bizmatch.app", name: "Marcus Webb",
    profile: { current_role: "Founder / CTO", venture_name: "TeamSync", industry: "SaaS", location: "Berlin", current_stage: "idea", commitment_hours: 45, commitment_type: "full_time", commitment_risk_appetite: "Bootstrapping alongside part-time consulting." },
    provides: ["Engineering", "Architecture", "Product"],
    needs: ["Sales", "GTM", "Marketing"],
    partner: { role_wanted: "GTM Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Low accountability", "Major values mismatch"],
  },
  {
    email: "alex.rivera@bizmatch.app", name: "Alex Rivera",
    profile: { current_role: "Founder", venture_name: "Ledger Loop", industry: "FinTech", location: "New York", current_stage: "growth", commitment_hours: 60, commitment_type: "full_time", commitment_risk_appetite: "All-in, second startup." },
    provides: ["Sales", "GTM", "Fundraising", "Network / Introductions"],
    needs: ["Engineering", "Operations"],
    partner: { role_wanted: "Technical Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Dishonesty"],
  },
  {
    email: "mia.johnson@bizmatch.app", name: "Mia Johnson",
    profile: { current_role: "Founder / Designer", venture_name: "Kindred", industry: "Consumer / Social", location: "London", current_stage: "idea", commitment_hours: 20, commitment_type: "part_time", commitment_risk_appetite: "Testing the idea alongside a full-time job." },
    provides: ["UX/UI", "Product", "Community"],
    needs: ["Engineering", "Fundraising"],
    partner: { role_wanted: "Technical Co-Founder", commitment_required: "Part Time", ambition_required: "Lifestyle / Steady Growth" },
    dealBreakers: [],
  },
];

// A few evaluator_assessment answers per founder — deliberately varied
// (Sarah/Alex score well, Marcus is mixed, Mia has almost no evidence yet)
// so the seeded data exercises Insights' strengths/weaknesses/empty-state
// branches, not just one uniform case.
const ASSESSMENT_ITEMS = {
  "sarah.chen@bizmatch.app": [
    { questionText: "How would you rate their execution and follow-through?", answerType: "scale_1_5", answer: 5, criteriaTag: "execution" },
    { questionText: "Did they take ownership without being asked?", answerType: "yes_no", answer: true, criteriaTag: "execution" },
    { questionText: "How honest and consistent were they between words and actions?", answerType: "scale_1_5", answer: 5, criteriaTag: "integrity" },
    { questionText: "How committed and available did they seem?", answerType: "scale_1_5", answer: 5, criteriaTag: "commitment" },
    { questionText: "How direct and clear was their communication?", answerType: "scale_1_5", answer: 4, criteriaTag: "communication" },
  ],
  "marcus.webb@bizmatch.app": [
    { questionText: "How would you rate their execution and follow-through?", answerType: "scale_1_5", answer: 3, criteriaTag: "execution" },
    { questionText: "How honest and consistent were they between words and actions?", answerType: "scale_1_5", answer: 4, criteriaTag: "integrity" },
    { questionText: "How did they handle disagreement or critique?", answerType: "scale_1_5", answer: 2, criteriaTag: "conflict" },
    { questionText: "Were they coachable and open to feedback?", answerType: "yes_no", answer: false, criteriaTag: "ego" },
  ],
  "alex.rivera@bizmatch.app": [
    { questionText: "How would you rate their execution and follow-through?", answerType: "scale_1_5", answer: 4, criteriaTag: "execution" },
    { questionText: "How committed and available did they seem?", answerType: "scale_1_5", answer: 5, criteriaTag: "commitment" },
    { questionText: "How did they handle pressure or setbacks?", answerType: "scale_1_5", answer: 4, criteriaTag: "resilience" },
  ],
  // Mia: no evaluator assessment seeded — exercises the "not enough evidence yet" empty state.
};

async function upsertAuthUser(email, name, role) {
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing.users.find(u => u.email === email);
  if (found) return found.id;

  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { name, role },
  });
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

async function main() {
  console.log("Seeding evaluator/admin account...");
  const evaluatorId = await upsertAuthUser(EVALUATOR.email, EVALUATOR.name, "founder");
  await pool.query("update public.users set role = 'admin' where id = $1", [evaluatorId]);
  await pool.query("update public.user_activity set has_seen_onboarding = true where user_id = $1", [evaluatorId]);
  console.log(`  evaluator: ${EVALUATOR.email} (${evaluatorId}) -> admin`);

  console.log("Seeding founder accounts + profiles...");
  const founderIds = {};
  for (const f of FOUNDERS) {
    const id = await upsertAuthUser(f.email, f.name, "founder");
    founderIds[f.email] = id;

    // has_seen_onboarding (user_activity) is a separate flag from
    // founder_profiles.onboarding_completed_at — the frontend's nav gate
    // reads the former, so a fully-profiled seed account still gets routed
    // into the onboarding wizard unless this is also set.
    await pool.query(
      "update public.user_activity set has_seen_onboarding = true where user_id = $1",
      [id],
    );

    await pool.query(
      `insert into public.founder_profiles (user_id, role_title, venture_name, industry, location, current_stage, commitment_hours, commitment_type, commitment_risk_appetite, status, onboarding_completed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active', now())
       on conflict (user_id) do update set
         role_title = excluded.role_title, venture_name = excluded.venture_name, industry = excluded.industry,
         location = excluded.location, current_stage = excluded.current_stage, commitment_hours = excluded.commitment_hours,
         commitment_type = excluded.commitment_type, commitment_risk_appetite = excluded.commitment_risk_appetite,
         onboarding_completed_at = now()`,
      [id, f.profile.current_role, f.profile.venture_name, f.profile.industry, f.profile.location,
        f.profile.current_stage, f.profile.commitment_hours, f.profile.commitment_type, f.profile.commitment_risk_appetite],
    );

    await pool.query("delete from public.founder_capabilities where founder_id = $1", [id]);
    for (const c of f.provides) {
      await pool.query(
        "insert into public.founder_capabilities (founder_id, kind, capability, score) values ($1,'provide',$2,75)",
        [id, c],
      );
    }
    for (const c of f.needs) {
      await pool.query(
        "insert into public.founder_capabilities (founder_id, kind, capability, score) values ($1,'need',$2,75)",
        [id, c],
      );
    }

    await pool.query(
      `insert into public.partner_requirements (founder_id, role_wanted, must_provide, commitment_required, ambition_required, preferred_traits)
       values ($1,$2,$3,$4,$5,'[]'::jsonb)
       on conflict (founder_id) do update set
         role_wanted = excluded.role_wanted, must_provide = excluded.must_provide,
         commitment_required = excluded.commitment_required, ambition_required = excluded.ambition_required`,
      [id, f.partner.role_wanted, JSON.stringify(f.needs), f.partner.commitment_required, f.partner.ambition_required],
    );

    await pool.query("delete from public.deal_breakers where founder_id = $1", [id]);
    for (const label of f.dealBreakers) {
      await pool.query(
        "insert into public.deal_breakers (founder_id, label) values ($1,$2) on conflict do nothing",
        [id, label],
      );
    }
    console.log(`  founder: ${f.email} (${id})`);
  }

  console.log("Signing in as evaluator to submit real evaluations via the deployed API...");
  const evaluatorToken = await signIn(EVALUATOR.email);

  for (const [email, items] of Object.entries(ASSESSMENT_ITEMS)) {
    const founderId = founderIds[email];
    await callFn(evaluatorToken, "POST", "/assessments", {
      founderId, notes: "Seeded evaluation for E2E testing.", items,
    });
    console.log(`  submitted assessment for ${email}`);
  }

  console.log("Done. Seed accounts (password: Demo1234!):");
  console.log(`  admin:    ${EVALUATOR.email}`);
  for (const f of FOUNDERS) console.log(`  founder:  ${f.email}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
