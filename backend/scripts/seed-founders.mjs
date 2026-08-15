// Seeds a full fixture dataset for the Founder Profile pivot, covering every
// MVP flow end-to-end: an evaluator/admin account, an active program, six
// founders in varied states (fully profiled, minimal-evidence, incomplete,
// prospect/unregistered), evaluator assessments, founder interviews (both
// completed and in-progress), DNA self-assessments, activities (upcoming/
// active/completed, with pending + approved registrations and peer
// feedback), a CV upload, a team, and a final match recompute pass — so a
// human can click through every screen against real data.
//
// Run: node backend/scripts/seed-founders.mjs
// Requires backend/.env: SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL.
// Re-runnable (upserts), but intended to be run right after a fresh
// `supabase db reset --linked` so ids/state are predictable.

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

const PROGRAM = { name: "BizMatch Pilot Cohort", cohortLabel: "Cohort 1 · 2026" };
const EVALUATOR = { email: "evaluator@bizmatch.app", name: "Priya Shah" };

// The official 13-item capability list (frontend/src/services/founders.service.js's
// CAPABILITIES) — keep any capability string used below inside this set.
const CAP = {
  ENG: "Engineering", PRODUCT: "Product", UX: "UX/UI", SALES: "Sales", GTM: "GTM",
  MKT: "Marketing", OPS: "Operations", FIN: "Finance", FUND: "Fundraising",
  DOMAIN: "Domain Expertise", COMMUNITY: "Community", NETWORK: "Network / Introductions",
  LEAD: "Leadership",
};

// ── Founders ────────────────────────────────────────────────────────────
// Sarah/Marcus/Alex/Mia keep the original E2E naming convention. Jordan and
// Daniel are new: Jordan exercises the "everything filled in" path (DNA
// self-assessment, CV, completed interview, on a team); Daniel is
// deliberately left incomplete to exercise the dashboard's "Needs
// Attention"/"Missing Info" flow.
const FOUNDERS = [
  {
    email: "sarah.chen@bizmatch.app", name: "Sarah Chen",
    profile: { role_title: "Founder / CEO", venture_name: "Lumen Health", industry: "HealthTech", location: "Tel Aviv", current_stage: "mvp", commitment_hours: 55, commitment_type: "full_time", commitment_risk_appetite: "All-in — quit my job to do this." },
    provides: [CAP.PRODUCT, CAP.FUND, CAP.LEAD],
    needs: [CAP.ENG, CAP.DOMAIN],
    partner: { role_wanted: "Technical Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Dishonesty", "Part-time"],
  },
  {
    email: "marcus.webb@bizmatch.app", name: "Marcus Webb",
    profile: { role_title: "Founder / CTO", venture_name: "TeamSync", industry: "SaaS", location: "Berlin", current_stage: "idea", commitment_hours: 45, commitment_type: "full_time", commitment_risk_appetite: "Bootstrapping alongside part-time consulting." },
    provides: [CAP.ENG, CAP.PRODUCT, CAP.OPS],
    needs: [CAP.SALES, CAP.GTM, CAP.MKT],
    partner: { role_wanted: "GTM Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Low accountability", "Major values mismatch"],
  },
  {
    email: "alex.rivera@bizmatch.app", name: "Alex Rivera",
    profile: { role_title: "Founder", venture_name: "Ledger Loop", industry: "FinTech", location: "New York", current_stage: "growth", commitment_hours: 60, commitment_type: "full_time", commitment_risk_appetite: "All-in, second startup." },
    provides: [CAP.SALES, CAP.GTM, CAP.FUND, CAP.NETWORK],
    needs: [CAP.ENG, CAP.OPS],
    partner: { role_wanted: "Technical Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Dishonesty"],
  },
  {
    email: "mia.johnson@bizmatch.app", name: "Mia Johnson",
    profile: { role_title: "Founder / Designer", venture_name: "Kindred", industry: "Consumer / Social", location: "London", current_stage: "idea", commitment_hours: 20, commitment_type: "part_time", commitment_risk_appetite: "Testing the idea alongside a full-time job." },
    provides: [CAP.UX, CAP.PRODUCT, CAP.COMMUNITY],
    needs: [CAP.ENG, CAP.FUND],
    partner: { role_wanted: "Technical Co-Founder", commitment_required: "Part Time", ambition_required: "Lifestyle / Steady Growth" },
    dealBreakers: [],
  },
  {
    email: "jordan.lee@bizmatch.app", name: "Jordan Lee",
    profile: { role_title: "Founder / Growth", venture_name: "Lumen Health", industry: "HealthTech", location: "Tel Aviv", current_stage: "mvp", commitment_hours: 50, commitment_type: "full_time", commitment_risk_appetite: "All-in, joined as a third co-founder." },
    provides: [CAP.SALES, CAP.GTM, CAP.MKT, CAP.FUND],
    needs: [CAP.PRODUCT, CAP.UX],
    partner: { role_wanted: "Design-minded Co-Founder", commitment_required: "Full Time", ambition_required: "Venture Scale" },
    dealBreakers: ["Dishonesty", "Low accountability"],
  },
];

// Daniel Katz: only an auth account + a bare founder_profiles row (no
// onboarding_completed_at) — mirrors a founder who signed up and stalled,
// so the dashboard's Missing Info / Needs Attention cards have real data.
const INCOMPLETE_FOUNDER = { email: "daniel.katz@bizmatch.app", name: "Daniel Katz" };

// Taylor Reed: never signs up — created via the evaluator's "add an
// unregistered founder" flow (POST /founders/prospect) so an interview can
// be attached before they exist as a real user.
const PROSPECT = { email: "taylor.reed@bizmatch.app", name: "Taylor Reed", roleTitle: "Aspiring Founder", industry: "EdTech", location: "Austin" };

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
  "jordan.lee@bizmatch.app": [
    { questionText: "How would you rate their execution and follow-through?", answerType: "scale_1_5", answer: 4, criteriaTag: "execution" },
    { questionText: "How direct and clear was their communication?", answerType: "scale_1_5", answer: 5, criteriaTag: "communication" },
    { questionText: "How well did their stated priorities match how they described making decisions?", answerType: "scale_1_5", answer: 4, criteriaTag: "values" },
  ],
  // Mia: no evaluator assessment seeded — exercises the "not enough evidence yet" empty state.
};

// ── DNA self-assessment (40 open-ended answers max, 5/dimension) ─────────
// One generic-but-plausible answer text per dimension, reused across
// founders who get a self-assessment — content quality doesn't matter for
// seeding, only that Gemini has enough to score against. `null` = skipped
// question (tests the "blank = skipped" partial-completion path).
const DIMENSIONS = ["execution", "integrity", "commitment", "communication", "conflict", "resilience", "ego", "values"];

function dnaAnswers(persona, dims) {
  const bank = {
    execution: [
      `Shipped ${persona}'s MVP end-to-end in six weeks, owning scope cuts myself.`,
      "Cut a nice-to-have integration to hit a launch deadline, and it was the right call.",
      "Set a goal to land 10 pilot customers this quarter — landed 8, still chasing the last two.",
      "I triage by customer-facing impact first, internal tooling second.",
      "A launch plan slipped when a vendor API changed — replanned around it within a day.",
    ],
    integrity: [
      "Told a customer their contract renewal would slip a week rather than overpromise.",
      "Flagged a bug in our own numbers to an investor before they found it themselves.",
      "Once cut a corner on a compliance checklist under deadline pressure — went back and fixed it properly after.",
      "Had to tell a teammate their feature wasn't shipping this cycle — did it directly, same day.",
      "Promised a feature by a date I later missed — told the customer as soon as I knew, not at the deadline.",
    ],
    commitment: [
      "Working full-time on this, no other income right now.",
      "Turned down a well-paid consulting gig to keep focus on the venture.",
      "Reworked my schedule around a co-founder's timezone rather than asking them to adjust.",
      "This is the thing I think about first when I wake up.",
      "Kept working through a slow month instead of looking for a fallback job.",
    ],
    communication: [
      "Write a weekly update to the team even when there's not much progress to report.",
      "Told a co-founder directly that a decision felt rushed, instead of going along with it.",
      "Rewrote a customer email three times to cut the jargon before sending.",
      "Default to over-communicating status rather than assuming people are tracking it.",
      "Asked a blunt question in a board meeting instead of nodding along confused.",
    ],
    conflict: [
      "Disagreed with a co-founder on pricing — we ran a small test instead of arguing it out.",
      "Pushed back on an investor's suggestion I thought was wrong, with data.",
      "Let a disagreement sit a day before responding so it didn't turn into a fight.",
      "Two teammates clashed on scope — pulled them into a joint call instead of routing around it.",
      "Was told my plan had a flaw in front of the team — said so, then fixed it.",
    ],
    resilience: [
      "Lost our first big pilot customer a month before renewal — regrouped and found two more within a quarter.",
      "A funding round fell through late — kept building on the existing runway instead of stalling.",
      "Burned out for a stretch last year, took a real week off, came back and reprioritized.",
      "Had a launch go sideways publicly — posted a plain postmortem instead of going quiet.",
      "Kept a difficult hire decision from dragging on for months once it was clearly not working.",
    ],
    ego: [
      "Was wrong about our target market early on — dropped the thesis once the data was clear.",
      "Took blunt feedback on my pitch deck from an advisor and rebuilt it from scratch.",
      "Asked a junior teammate to review my own code and took the notes seriously.",
      "Changed my mind in a meeting when someone made a better argument than mine.",
      "Still ask 'what am I missing' before big calls rather than assuming I've got it.",
    ],
    values: [
      "Turned down a larger check from an investor whose terms didn't match how we want to build this.",
      "We say customer trust comes first — dropped a growth hack that felt manipulative even though it worked.",
      "Told a friend I couldn't hire them because it wasn't the right fit, even though it was awkward.",
      "Prioritized fixing a data privacy gap over a feature we'd promised, and told the customer why.",
      "Walked away from a partnership that would've grown revenue but conflicted with our mission.",
    ],
  };
  const out = {};
  for (const dim of DIMENSIONS) {
    out[dim] = dims.includes(dim) ? bank[dim] : bank[dim].map(() => "");
  }
  return out;
}

// ── Founder interview answers (dimension-mapping tree) ────────────────────
const SCALE_OPTIONS = ["1", "2", "3", "4", "5"];
const info = () => ({ value: { type: "info", acknowledged: true } });
const shortText = (text) => ({ value: { type: "short_text", text } });
const longText = (text) => ({ value: { type: "long_text", text } });
const singleChoice = (optionId) => ({ value: { type: "single_choice", optionId } });
const number = (value) => ({ value: { type: "number", value } });
const yesNo = (value) => ({ value: { type: "yes_no", value } });

function context({ role, stage, teamSize }) {
  return {
    context_intro: info(),
    context_role: shortText(role),
    context_venture_stage: singleChoice(stage),
    context_team_size: number(teamSize),
  };
}

function dimensionAnswers(dim, { q1, q2, scale, ownershipYes, egoYes }) {
  const out = {
    [`${dim}_q1`]: longText(q1),
    [`${dim}_q2`]: longText(q2),
    [`${dim}_scale`]: singleChoice(SCALE_OPTIONS[scale - 1]),
  };
  if (dim === "execution") out.execution_ownership = yesNo(ownershipYes);
  if (dim === "ego") out.ego_yesno = yesNo(egoYes);
  return out;
}

function closing({ vouch, notes }) {
  return { vouch_yesno: yesNo(vouch), closing_notes: longText(notes) };
}

// A fully-completed, high-scoring interview (used for Sarah/Jordan).
function completedInterview({ role, stage, teamSize, notes }) {
  return {
    ...context({ role, stage, teamSize }),
    ...dimensionAnswers("execution", { q1: "Shipped the MVP end-to-end, cutting scope themselves to hit the date.", q2: "Delegated onboarding copy, it came back off-brand — they rewrote it same day rather than let it slide.", scale: 5, ownershipYes: true }),
    ...dimensionAnswers("integrity", { q1: "Told a customer a deadline would slip rather than promise and miss it.", q2: "Flagged their own mistake in a metrics deck before an investor caught it.", scale: 5 }),
    ...dimensionAnswers("commitment", { q1: "Full-time, no other income, timezone reshuffled around the team.", q2: "Kept building through a slow month instead of looking at fallback options.", scale: 5 }),
    ...dimensionAnswers("communication", { q1: "Sends a weekly update even in quiet weeks.", q2: "Asked a blunt clarifying question in a board meeting instead of nodding along.", scale: 4 }),
    ...dimensionAnswers("conflict", { q1: "Disagreed with a co-founder on pricing, ran a small test instead of arguing.", q2: "Let a heated thread sit overnight before replying.", scale: 4 }),
    ...dimensionAnswers("resilience", { q1: "Lost a pilot customer a month before renewal, found two more within the quarter.", q2: "Posted a plain postmortem after a public launch stumble.", scale: 5 }),
    ...dimensionAnswers("ego", { q1: "Dropped an early market thesis once the data contradicted it.", q2: "Rebuilt a pitch deck from scratch after blunt advisor feedback.", scale: 4, egoYes: true }),
    ...dimensionAnswers("values", { q1: "Turned down a bigger check over term mismatch with how they want to build.", q2: "Dropped a growth hack that worked but felt manipulative.", scale: 5 }),
    ...closing({ vouch: true, notes }),
  };
}

// A mixed-scoring completed interview (used for nobody by default, kept for
// re-use if a mixed completed case is ever wanted alongside the in-progress one).
function mixedInterview({ role, stage, teamSize, notes }) {
  return {
    ...context({ role, stage, teamSize }),
    ...dimensionAnswers("execution", { q1: "Shipped a first version late, scope crept without a clear cutline.", q2: "Delegated a task that stalled for two weeks before they noticed.", scale: 3, ownershipYes: true }),
    ...dimensionAnswers("integrity", { q1: "Generally straight, but softened bad news more than once.", q2: "Corrected a number in a deck after a teammate flagged it.", scale: 4 }),
    ...dimensionAnswers("conflict", { q1: "Avoided a pricing disagreement for weeks instead of raising it.", q2: "Got defensive when challenged on a roadmap call.", scale: 2 }),
    ...dimensionAnswers("ego", { q1: "Pushed back hard on feedback before eventually taking some of it.", q2: "Slow to admit a wrong call on the target market.", scale: 2, egoYes: false }),
    ...closing({ vouch: false, notes }),
  };
}

// Only context + the first dimension answered — an interview left mid-way
// (tests the delete-in-progress-interview action).
function inProgressInterview({ role, stage, teamSize }) {
  return {
    ...context({ role, stage, teamSize }),
    ...dimensionAnswers("execution", { q1: "Still gathering examples — first pass sounded promising but vague.", q2: "Delegation story was thin, following up next session.", scale: 3, ownershipYes: true }),
  };
}

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

async function uploadCv(token, founderId, filename) {
  const bytes = new TextEncoder().encode(`%PDF-1.4\n% Seeded placeholder CV for ${filename}\n%%EOF`);
  const form = new FormData();
  form.append("cv", new Blob([bytes], { type: "application/pdf" }), filename);
  const res = await fetch(`${API}/founders/${founderId}/cv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`uploadCv(${founderId}): ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function ensureProgram() {
  const existing = await pool.query("select id from public.programs where name = $1", [PROGRAM.name]);
  if (existing.rows[0]) {
    await pool.query("update public.programs set is_active = true, cohort_label = $2 where id = $1", [existing.rows[0].id, PROGRAM.cohortLabel]);
    return existing.rows[0].id;
  }
  const inserted = await pool.query(
    "insert into public.programs (name, cohort_label, is_active) values ($1,$2,true) returning id",
    [PROGRAM.name, PROGRAM.cohortLabel],
  );
  return inserted.rows[0].id;
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
  for (const c of f.provides) {
    await pool.query("insert into public.founder_capabilities (founder_id, kind, capability, score) values ($1,'provide',$2,75)", [id, c]);
  }
  for (const c of f.needs) {
    await pool.query("insert into public.founder_capabilities (founder_id, kind, capability, score) values ($1,'need',$2,75)", [id, c]);
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
    await pool.query("insert into public.deal_breakers (founder_id, label) values ($1,$2) on conflict do nothing", [id, label]);
  }
}

async function main() {
  console.log("Ensuring active program...");
  const programId = await ensureProgram();
  console.log(`  program: ${PROGRAM.name} (${programId})`);

  console.log("Seeding evaluator/admin account...");
  const evaluatorId = await upsertAuthUser(EVALUATOR.email, EVALUATOR.name, "founder");
  await pool.query("update public.users set role = 'admin' where id = $1", [evaluatorId]);
  await pool.query("update public.user_activity set has_seen_onboarding = true where user_id = $1", [evaluatorId]);
  console.log(`  evaluator: ${EVALUATOR.email} (${evaluatorId}) -> admin`);
  const evaluatorToken = await signIn(EVALUATOR.email);

  console.log("Seeding founder accounts + profiles...");
  const founderIds = {};
  for (const f of FOUNDERS) {
    const id = await upsertAuthUser(f.email, f.name, "founder");
    founderIds[f.email] = id;
    await seedFounderProfile(id, f, programId);
    console.log(`  founder: ${f.email} (${id})`);
  }

  console.log("Seeding Daniel Katz (deliberately incomplete profile)...");
  const danielId = await upsertAuthUser(INCOMPLETE_FOUNDER.email, INCOMPLETE_FOUNDER.name, "founder");
  await pool.query(
    `insert into public.founder_profiles (user_id, program_id)
     values ($1,$2)
     on conflict (user_id) do update set program_id = excluded.program_id`,
    [danielId, programId],
  );
  console.log(`  founder (incomplete): ${INCOMPLETE_FOUNDER.email} (${danielId})`);

  console.log("Seeding Taylor Reed as an unregistered prospect via POST /founders/prospect...");
  let prospect;
  try {
    prospect = await callFn(evaluatorToken, "POST", "/founders/prospect", {
      email: PROSPECT.email, name: PROSPECT.name, roleTitle: PROSPECT.roleTitle, industry: PROSPECT.industry, location: PROSPECT.location,
    });
    console.log(`  prospect: ${PROSPECT.email} (${prospect.id})`);
  } catch (err) {
    // Re-running the script: the prospect auth user already exists (createUser
    // isn't idempotent like upsertAuthUser). Look it up instead of failing.
    console.log(`  prospect already exists, looking up: ${err.message}`);
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = existing.users.find(u => u.email === PROSPECT.email);
    if (!found) throw err;
    prospect = { id: found.id };
  }
  await pool.query("update public.founder_profiles set program_id = $2 where user_id = $1", [prospect.id, programId]);

  console.log("Signing in founders...");
  const tokens = {};
  for (const f of FOUNDERS) tokens[f.email] = await signIn(f.email);

  console.log("Submitting evaluator assessments...");
  for (const [email, items] of Object.entries(ASSESSMENT_ITEMS)) {
    await callFn(evaluatorToken, "POST", "/assessments", {
      founderId: founderIds[email], notes: "Seeded evaluation for E2E testing.", items,
    });
    console.log(`  assessment: ${email}`);
  }

  console.log("Submitting DNA self-assessments (Gemini-scored, live calls)...");
  // Sarah + Jordan: fully answered. Marcus: partial (3 of 8 dimensions —
  // tests the skip-blank-questions path). Alex/Mia/Daniel: left undone, so
  // the "Fill in your Founder DNA assessment" banner still has a case to show.
  const dnaPlan = [
    { email: "sarah.chen@bizmatch.app", dims: DIMENSIONS },
    { email: "jordan.lee@bizmatch.app", dims: DIMENSIONS },
    { email: "marcus.webb@bizmatch.app", dims: ["execution", "integrity", "conflict"] },
  ];
  for (const { email, dims } of dnaPlan) {
    try {
      await callFn(evaluatorToken, "POST", `/dna-self-assessment/${founderIds[email]}`, { answers: dnaAnswers(email, dims) });
      console.log(`  dna self-assessment: ${email} (${dims.length}/8 dimensions)`);
    } catch (err) {
      console.log(`  dna self-assessment skipped for ${email}: ${err.message}`);
    }
  }

  console.log("Uploading CVs...");
  for (const email of ["sarah.chen@bizmatch.app", "jordan.lee@bizmatch.app"]) {
    await uploadCv(evaluatorToken, founderIds[email], `${email.split("@")[0]}-resume.pdf`);
    console.log(`  cv uploaded: ${email}`);
  }

  console.log("Running founder interviews...");
  const sarahInterview = await callFn(evaluatorToken, "POST", "/founder-interviews", { founderId: founderIds["sarah.chen@bizmatch.app"] });
  await callFn(evaluatorToken, "PUT", `/founder-interviews/${sarahInterview.id}`, {
    answers: completedInterview({ role: "Founder / CEO", stage: "mvp", teamSize: 3, notes: "Strong, consistent execution story. Would vouch." }),
  });
  await callFn(evaluatorToken, "POST", `/founder-interviews/${sarahInterview.id}/complete`);
  console.log(`  interview completed: sarah.chen@bizmatch.app (${sarahInterview.id})`);

  const jordanInterview = await callFn(evaluatorToken, "POST", "/founder-interviews", { founderId: founderIds["jordan.lee@bizmatch.app"] });
  await callFn(evaluatorToken, "PUT", `/founder-interviews/${jordanInterview.id}`, {
    answers: completedInterview({ role: "Founder / Growth", stage: "mvp", teamSize: 3, notes: "Clear communicator, good values alignment with the rest of the team." }),
  });
  await callFn(evaluatorToken, "POST", `/founder-interviews/${jordanInterview.id}/complete`);
  console.log(`  interview completed: jordan.lee@bizmatch.app (${jordanInterview.id})`);

  const marcusInterview = await callFn(evaluatorToken, "POST", "/founder-interviews", { founderId: founderIds["marcus.webb@bizmatch.app"] });
  await callFn(evaluatorToken, "PUT", `/founder-interviews/${marcusInterview.id}`, {
    answers: inProgressInterview({ role: "Founder / CTO", stage: "idea", teamSize: 2 }),
  });
  console.log(`  interview left in-progress: marcus.webb@bizmatch.app (${marcusInterview.id})`);

  const prospectInterview = await callFn(evaluatorToken, "POST", "/founder-interviews", { founderId: prospect.id });
  await callFn(evaluatorToken, "PUT", `/founder-interviews/${prospectInterview.id}`, {
    answers: inProgressInterview({ role: "Aspiring Founder", stage: "idea", teamSize: 1 }),
  });
  console.log(`  interview left in-progress: ${PROSPECT.email} (prospect, ${prospectInterview.id})`);

  console.log("Creating activities...");
  const now = Date.now();
  const days = (n) => new Date(now + n * 86400000).toISOString();

  const pastActivity = await callFn(evaluatorToken, "POST", "/activities", {
    type: "workshop", title: "Founder Sprint Workshop",
    description: "A completed workshop with peer feedback exchanged between participants.",
    startsAt: days(-14), endsAt: days(-13),
  });
  const activeActivity = await callFn(evaluatorToken, "POST", "/activities", {
    type: "hackathon", title: "Pitch Practice Hackathon",
    description: "Currently running — has an approved participant and one still pending admin approval.",
    startsAt: days(-1), endsAt: days(2),
  });
  const upcomingActivity = await callFn(evaluatorToken, "POST", "/activities", {
    type: "team_challenge", title: "Cohort Kickoff Mixer",
    description: "Open for signup — has one approved and one still-pending registration.",
    startsAt: days(5), endsAt: days(5),
  });
  console.log(`  activities: past=${pastActivity.id} active=${activeActivity.id} upcoming=${upcomingActivity.id}`);

  // Registration (POST /:id/register) only works while an activity's derived
  // status is 'upcoming' — the past/active ones need their roster set
  // directly, the way a pre-registration-era admin-curated roster works.
  console.log("Setting rosters on the past + active activities...");
  await callFn(evaluatorToken, "PUT", `/activities/${pastActivity.id}/participants`, {
    founderIds: ["sarah.chen@bizmatch.app", "marcus.webb@bizmatch.app", "mia.johnson@bizmatch.app"].map(e => founderIds[e]),
  });
  await callFn(evaluatorToken, "PUT", `/activities/${activeActivity.id}/participants`, {
    founderIds: [founderIds["jordan.lee@bizmatch.app"]],
  });

  console.log("Registering for the upcoming activity (real founder self-service flow)...");
  await callFn(tokens["alex.rivera@bizmatch.app"], "POST", `/activities/${upcomingActivity.id}/register`);
  await callFn(evaluatorToken, "PATCH", `/activities/${upcomingActivity.id}/participants/${founderIds["alex.rivera@bizmatch.app"]}`, { status: "approved" });
  await callFn(tokens["mia.johnson@bizmatch.app"], "POST", `/activities/${upcomingActivity.id}/register`);
  // Mia is left "pending" deliberately — tests the admin approve/reject action.
  console.log("  Alex Rivera approved, Mia Johnson left pending on the upcoming activity");

  console.log("Submitting peer feedback for the completed workshop...");
  const peerFeedback = [
    { author: "sarah.chen@bizmatch.app", about: "marcus.webb@bizmatch.app", dimension: "execution", score: 70, observation: "Solid technical execution, a bit slow to loop in the rest of the team." },
    { author: "marcus.webb@bizmatch.app", about: "sarah.chen@bizmatch.app", dimension: "communication", score: 90, observation: "Extremely clear about priorities in the workshop." },
    { author: "sarah.chen@bizmatch.app", about: "mia.johnson@bizmatch.app", dimension: "commitment", score: 55, observation: "Engaged but clearly time-constrained by her other job." },
  ];
  for (const pf of peerFeedback) {
    await callFn(tokens[pf.author], "POST", "/peer-feedback", {
      founderId: founderIds[pf.about], activityId: pastActivity.id, dimension: pf.dimension, score: pf.score, observation: pf.observation,
    });
  }
  console.log(`  peer feedback rows: ${peerFeedback.length}`);

  console.log("Creating a team (Sarah + Marcus + Jordan — Lumen Health)...");
  const team = await callFn(evaluatorToken, "POST", "/teams", {
    name: "Team Lumen",
    programId,
    founderIds: [founderIds["sarah.chen@bizmatch.app"], founderIds["marcus.webb@bizmatch.app"], founderIds["jordan.lee@bizmatch.app"]],
  });
  console.log(`  team: Team Lumen (${team.id})`);

  console.log("Recomputing match compatibility for every founder...");
  for (const f of FOUNDERS) {
    await callFn(evaluatorToken, "POST", "/matches/recompute", { founderId: founderIds[f.email] });
  }
  console.log("  match compatibility recomputed");

  console.log("\nDone. Seed accounts (password: Demo1234!):");
  console.log(`  admin:     ${EVALUATOR.email}`);
  for (const f of FOUNDERS) console.log(`  founder:   ${f.email}`);
  console.log(`  founder:   ${INCOMPLETE_FOUNDER.email}  (incomplete profile)`);
  console.log(`  prospect:  ${PROSPECT.email}  (unregistered — no login)`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
