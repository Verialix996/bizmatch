#!/usr/bin/env node
// E2E API pass for the Founder Profile pivot (founders/evidence/assessments/
// founder-dna functions). Mirrors run-api.mjs's harness conventions
// (record/assert/test/call/signIn) so results are readable the same way,
// but targets the new bizmatch-pivot project and the new endpoint surface.
//
// Requires seed data from backend/scripts/seed-founders.mjs to already
// exist: evaluator@bizmatch.app (admin) + sarah/marcus/alex/mia (founders).
//
// Run: node backend/scripts/e2e/run-api-founders.mjs [--mutating]

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "../..");
dotenv.config({ path: path.join(backendDir, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const API_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !API_KEY) {
  throw new Error("backend/.env must define SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
}

const API = `${SUPABASE_URL}/functions/v1`;
const PASSWORD = "Demo1234!";
const flags = new Set(process.argv.slice(2));
const MUTATING = flags.has("--mutating");
const outputArg = process.argv.indexOf("--output");
const outputPath = outputArg >= 0
  ? path.resolve(process.argv[outputArg + 1])
  : path.join(here, "artifacts", "api-founders-results.json");

const accounts = {
  Evaluator: "evaluator@bizmatch.app",
  Sarah: "sarah.chen@bizmatch.app",
  Marcus: "marcus.webb@bizmatch.app",
  Alex: "alex.rivera@bizmatch.app",
  Mia: "mia.johnson@bizmatch.app",
};

const results = {};
let lastExchange = null;

function clean(value) {
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer <redacted>")
      .replace(/(\"password\"\s*:\s*)\"[^\"]+\"/gi, "$1\"<redacted>\"")
      .replace(API_KEY, "<publishable-key>");
  }
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [
      k, /token|authorization|apikey/i.test(k) ? "<redacted>" : clean(v),
    ]));
  }
  return value;
}

function record(id, status, summary, evidence = null) {
  results[id] = { id, status, summary, ...(evidence ? { evidence: clean(evidence) } : {}) };
  console.log(`${id.padEnd(5)} ${status.padEnd(7)} ${summary}`);
}

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.name = "AssertionError";
    throw error;
  }
}

async function test(id, summary, fn) {
  try {
    const evidence = await fn();
    record(id, "PASS", summary, evidence || lastExchange);
    return true;
  } catch (error) {
    record(id, "FAIL", `${summary}: ${error.message}`, {
      request: lastExchange?.request, response: lastExchange?.response, expected: error.message,
    });
    return false;
  }
}

function skipped(id, reason) { record(id, "SKIPPED", reason); }

async function fetchWithTimeout(url, init = {}, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("json")) return await response.json().catch(() => null);
  return null;
}

async function request(label, url, init = {}, timeoutMs = 45_000) {
  const started = performance.now();
  const response = await fetchWithTimeout(url, init, timeoutMs);
  const data = await parseResponse(response);
  lastExchange = {
    label,
    request: { method: init.method || "GET", url, headers: clean(init.headers || {}), body: clean(init.body || null) },
    response: { status: response.status, body: clean(data), elapsedMs: Math.round(performance.now() - started) },
  };
  return { status: response.status, headers: response.headers, data, elapsedMs: lastExchange.response.elapsedMs };
}

async function signIn(name, password = PASSWORD) {
  return request(`sign in ${name}`, `${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: accounts[name] || name, password }),
  });
}

async function call(session, method, route, body, options = {}) {
  const headers = { apikey: API_KEY, ...(options.headers || {}) };
  if (session?.access_token && !options.noAuth) headers.Authorization = `Bearer ${session.access_token}`;
  let requestBody = body;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }
  return request(`${method} ${route}`, `${API}${route}`, {
    method, headers, ...(requestBody !== undefined ? { body: requestBody } : {}),
  }, options.timeoutMs || 45_000);
}

async function authCall(method, route, body) {
  return request(`${method} auth ${route}`, `${SUPABASE_URL}/auth/v1${route}`, {
    method, headers: { apikey: API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

function sessionOf(response) {
  assert(response.status === 200 && response.data?.access_token, `expected 200 session, got ${response.status}`);
  return response.data;
}

async function main() {
  console.log(`BizMatch founder-pivot E2E pass: mutating=${MUTATING}, target=${SUPABASE_URL}`);

  // ── 1. Auth ──────────────────────────────────────────────────────────
  await test("1.1", "duplicate seeded email signup returns empty identities", async () => {
    const r = await authCall("POST", "/signup", { email: accounts.Sarah, password: PASSWORD, data: { name: "Duplicate Sarah", role: "founder" } });
    assert(r.status === 200 && Array.isArray(r.data?.identities) && r.data.identities.length === 0, `expected 200 empty identities, got ${r.status}`);
  });
  await test("1.2", "weak password is rejected", async () => {
    const r = await authCall("POST", "/signup", { email: `weak-${Date.now()}@example.com`, password: "a", data: { name: "Weak" } });
    assert(r.status >= 400, `expected 4xx, got ${r.status}`);
  });
  await test("1.3", "moderation rejects a flagged registration name", async () => {
    const r = await call(null, "POST", "/auth/precheck-name", { name: "fuckboy" });
    assert(r.status === 400 && /flagged/i.test(r.data?.error || ""), `expected 400 moderation error, got ${r.status}`);
  });
  await test("1.4", "empty registration name is rejected", async () => {
    const r = await call(null, "POST", "/auth/precheck-name", { name: " " });
    assert(r.status === 400 && r.data?.error === "Name is required", `expected 400, got ${r.status}`);
  });

  const authResponses = await Promise.all(Object.keys(accounts).map((name) => signIn(name)));
  const sessions = Object.fromEntries(Object.keys(accounts).map((name, i) => [name, sessionOf(authResponses[i])]));
  await test("1.5", "all seeded accounts (1 admin + 4 founders) log in", async () => {
    assert(authResponses.every((r) => r.status === 200), "at least one seeded login failed");
    return { accounts: Object.keys(accounts) };
  });
  await test("1.6", "wrong password creates no session", async () => {
    const r = await signIn("Sarah", "DefinitelyWrong123!");
    assert(r.status >= 400 && !r.data?.access_token, `expected rejection, got ${r.status}`);
  });
  await test("1.7", "nonexistent email creates no session", async () => {
    const r = await signIn(`missing-${Date.now()}@example.com`, PASSWORD);
    assert(r.status >= 400 && !r.data?.access_token, `expected rejection, got ${r.status}`);
  });

  const me = {};
  for (const name of Object.keys(accounts)) {
    const r = await call(sessions[name], "GET", "/users/me");
    assert(r.status === 200, `failed to fetch ${name}`);
    me[name] = r.data;
  }
  await test("1.8", "seed accounts have the expected roles", async () => {
    assert(me.Evaluator.role === "admin", `expected Evaluator admin, got ${me.Evaluator.role}`);
    assert(["Sarah", "Marcus", "Alex", "Mia"].every((n) => me[n].role === "founder"), "a founder seed account has the wrong role");
  });

  // ── 2. Founders — listing & read access ─────────────────────────────
  await test("2.1", "admin founders list includes all seeded founders", async () => {
    const r = await call(sessions.Evaluator, "GET", "/founders");
    assert(r.status === 200 && Array.isArray(r.data), `expected array, got ${r.status}`);
    const names = r.data.map((f) => f.name);
    assert(["Sarah Chen", "Marcus Webb", "Alex Rivera", "Mia Johnson"].every((n) => names.includes(n)), "seeded founder missing from list");
    return { count: r.data.length };
  });
  await test("2.2", "founders list search filters by name", async () => {
    const r = await call(sessions.Evaluator, "GET", "/founders?search=Sarah");
    assert(r.status === 200 && r.data.length === 1 && r.data[0].name === "Sarah Chen", `expected only Sarah, got ${JSON.stringify(r.data.map((f) => f.name))}`);
  });
  await test("2.3", "non-admin cannot list founders", async () => {
    const r = await call(sessions.Sarah, "GET", "/founders");
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });
  await test("2.4", "admin dashboard returns program/stat shape", async () => {
    const r = await call(sessions.Evaluator, "GET", "/founders/dashboard");
    assert(r.status === 200, `expected 200, got ${r.status}`);
    for (const key of ["activeFounderCount", "completedEvaluationsCount", "missingInfoCount", "teamsCreatedCount", "recentActivity", "needsAttention"]) {
      assert(key in r.data, `dashboard missing ${key}`);
    }
    assert(r.data.completedEvaluationsCount >= 3, `expected at least 3 seeded evaluations, got ${r.data.completedEvaluationsCount}`);
  });
  await test("2.5", "non-admin cannot view the dashboard", async () => {
    const r = await call(sessions.Marcus, "GET", "/founders/dashboard");
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });
  await test("2.6", "admin founder profile includes provides/needs/partnerRequirements/dealBreakers", async () => {
    const r = await call(sessions.Evaluator, "GET", `/founders/${me.Sarah.id}`);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(Array.isArray(r.data.provides) && r.data.provides.length > 0, "provides missing/empty");
    assert(Array.isArray(r.data.needs) && r.data.needs.length > 0, "needs missing/empty");
    assert(r.data.partnerRequirements?.roleWanted, "partnerRequirements.roleWanted missing");
    assert(Array.isArray(r.data.dealBreakers), "dealBreakers not an array");
    return { ventureName: r.data.ventureName, provides: r.data.provides.map((p) => p.capability) };
  });
  await test("2.7", "founder can view their own profile", async () => {
    const r = await call(sessions.Sarah, "GET", `/founders/${me.Sarah.id}`);
    assert(r.status === 200 && r.data.id === me.Sarah.id, `expected own profile, got ${r.status}`);
  });
  await test("2.8", "founder cannot view another founder's profile", async () => {
    const r = await call(sessions.Sarah, "GET", `/founders/${me.Marcus.id}`);
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });
  await test("2.9", "bogus founder id returns 404", async () => {
    const r = await call(sessions.Evaluator, "GET", "/founders/00000000-0000-4000-8000-000000000000");
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  // ── 3. Founders — writes ─────────────────────────────────────────────
  if (MUTATING) {
    await test("3.1", "admin profile update persists and can be restored", async () => {
      const before = (await call(sessions.Evaluator, "GET", `/founders/${me.Marcus.id}`)).data;
      const marker = `E2E Industry ${Date.now()}`;
      try {
        const update = await call(sessions.Evaluator, "PUT", `/founders/${me.Marcus.id}/profile`, {
          current_role: before.currentRole, venture_name: before.ventureName, industry: marker,
          location: before.location, current_stage: before.currentStage,
          commitment_hours: before.commitmentHours, commitment_type: before.commitmentType,
          commitment_risk_appetite: before.commitmentRiskAppetite,
        });
        assert(update.status === 200, `expected 200, got ${update.status}`);
        const after = (await call(sessions.Evaluator, "GET", `/founders/${me.Marcus.id}`)).data;
        assert(after.industry === marker, "industry update did not persist");
      } finally {
        await call(sessions.Evaluator, "PUT", `/founders/${me.Marcus.id}/profile`, {
          current_role: before.currentRole, venture_name: before.ventureName, industry: before.industry,
          location: before.location, current_stage: before.currentStage,
          commitment_hours: before.commitmentHours, commitment_type: before.commitmentType,
          commitment_risk_appetite: before.commitmentRiskAppetite,
        });
      }
    });
    await test("3.2", "founder can self-author their own profile (onboarding write path)", async () => {
      const before = (await call(sessions.Mia, "GET", `/founders/${me.Mia.id}`)).data;
      const marker = `E2E Location ${Date.now()}`;
      try {
        const update = await call(sessions.Mia, "PUT", `/founders/${me.Mia.id}/profile`, {
          current_role: before.currentRole, venture_name: before.ventureName, industry: before.industry,
          location: marker, current_stage: before.currentStage,
        });
        assert(update.status === 200, `expected 200, got ${update.status}`);
        const after = (await call(sessions.Mia, "GET", `/founders/${me.Mia.id}`)).data;
        assert(after.location === marker, "self-authored location did not persist");
      } finally {
        await call(sessions.Mia, "PUT", `/founders/${me.Mia.id}/profile`, {
          current_role: before.currentRole, venture_name: before.ventureName, industry: before.industry,
          location: before.location, current_stage: before.currentStage,
        });
      }
    });
    await test("3.3", "founder cannot edit another founder's profile", async () => {
      const r = await call(sessions.Sarah, "PUT", `/founders/${me.Marcus.id}/profile`, { current_role: "Hijacked" });
      assert(r.status === 403, `expected 403, got ${r.status}`);
    });
    await test("3.4", "admin capability replace persists and can be restored", async () => {
      const before = (await call(sessions.Evaluator, "GET", `/founders/${me.Alex.id}`)).data.provides;
      try {
        const r = await call(sessions.Evaluator, "PUT", `/founders/${me.Alex.id}/capabilities`, {
          kind: "provide", items: [{ capability: "Leadership", score: 90 }],
        });
        assert(r.status === 200, `expected 200, got ${r.status}`);
        const after = (await call(sessions.Evaluator, "GET", `/founders/${me.Alex.id}`)).data.provides;
        assert(after.length === 1 && after[0].capability === "Leadership" && after[0].score === 90, "capability replace did not apply");
      } finally {
        await call(sessions.Evaluator, "PUT", `/founders/${me.Alex.id}/capabilities`, {
          kind: "provide", items: before.map((p) => ({ capability: p.capability, score: p.score })),
        });
      }
    });
    await test("3.5", "admin status change persists and can be restored", async () => {
      const before = (await call(sessions.Evaluator, "GET", `/founders/${me.Marcus.id}`)).data.status;
      try {
        const r = await call(sessions.Evaluator, "PATCH", `/founders/${me.Marcus.id}/status`, { status: "inactive" });
        assert(r.status === 200, `expected 200, got ${r.status}`);
        const after = (await call(sessions.Evaluator, "GET", `/founders/${me.Marcus.id}`)).data.status;
        assert(after === "inactive", `expected inactive, got ${after}`);
      } finally {
        await call(sessions.Evaluator, "PATCH", `/founders/${me.Marcus.id}/status`, { status: before });
      }
    });
    await test("3.6", "non-admin cannot change founder status", async () => {
      const r = await call(sessions.Sarah, "PATCH", `/founders/${me.Sarah.id}/status`, { status: "inactive" });
      assert(r.status === 403, `expected 403, got ${r.status}`);
    });
  } else {
    for (const id of ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"]) skipped(id, "run with --mutating");
  }

  // ── 4. Evidence ──────────────────────────────────────────────────────
  if (MUTATING) {
    await test("4.1", "admin can write a raw evidence row", async () => {
      const r = await call(sessions.Evaluator, "POST", "/evidence", {
        founderId: me.Alex.id, sourceType: "reference", dimension: "integrity", score: 82, observation: "E2E reference check.",
      });
      assert(r.status === 201 && r.data?.id, `expected 201 with id, got ${r.status}`);
      return { evidenceId: r.data.id };
    });
  } else skipped("4.1", "run with --mutating");
  await test("4.2", "invalid sourceType is rejected", async () => {
    const r = await call(sessions.Evaluator, "POST", "/evidence", { founderId: me.Alex.id, sourceType: "bogus", dimension: "integrity", score: 50 });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  await test("4.3", "missing required evidence fields are rejected", async () => {
    const r = await call(sessions.Evaluator, "POST", "/evidence", { founderId: me.Alex.id });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  await test("4.4", "admin can list a founder's evidence filtered by dimension", async () => {
    const r = await call(sessions.Evaluator, "GET", `/evidence?founderId=${me.Sarah.id}&dimension=execution`);
    assert(r.status === 200 && Array.isArray(r.data), `expected array, got ${r.status}`);
    assert(r.data.every((e) => e.dimension === "execution"), "dimension filter leaked other dimensions");
    return { count: r.data.length };
  });
  await test("4.5", "founder can view their own evidence", async () => {
    const r = await call(sessions.Sarah, "GET", `/evidence?founderId=${me.Sarah.id}`);
    assert(r.status === 200 && Array.isArray(r.data), `expected array, got ${r.status}`);
  });
  await test("4.6", "founder cannot view another founder's evidence", async () => {
    const r = await call(sessions.Sarah, "GET", `/evidence?founderId=${me.Marcus.id}`);
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });
  await test("4.7", "non-admin cannot write evidence", async () => {
    const r = await call(sessions.Sarah, "POST", "/evidence", { founderId: me.Sarah.id, sourceType: "self", dimension: "execution", score: 90 });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  // ── 5. Assessments ───────────────────────────────────────────────────
  if (MUTATING) {
    await test("5.1", "admin can submit a mixed-answer-type evaluation", async () => {
      const r = await call(sessions.Evaluator, "POST", "/assessments", {
        founderId: me.Mia.id, notes: "E2E evaluation",
        items: [
          { questionText: "How would you rate their execution?", answerType: "scale_1_5", answer: 4, criteriaTag: "execution" },
          { questionText: "Were they coachable?", answerType: "yes_no", answer: true, criteriaTag: "ego" },
          { questionText: "Anything else?", answerType: "open_text", answer: "E2E open note" },
        ],
      });
      assert(r.status === 201 && r.data?.id, `expected 201 with id, got ${r.status}`);
      return { assessmentId: r.data.id };
    });
    await test("5.2", "admin can list a founder's assessments with items", async () => {
      const r = await call(sessions.Evaluator, "GET", `/assessments?founderId=${me.Mia.id}`);
      assert(r.status === 200 && Array.isArray(r.data) && r.data.length > 0, `expected non-empty array, got ${r.status}`);
      assert(Array.isArray(r.data[0].items) && r.data[0].items.length === 3, "assessment items not returned");
    });
  } else {
    skipped("5.1", "run with --mutating");
    skipped("5.2", "run with --mutating");
  }
  await test("5.3", "non-admin cannot submit an assessment", async () => {
    const r = await call(sessions.Sarah, "POST", "/assessments", { founderId: me.Sarah.id, items: [{ questionText: "x", answerType: "yes_no", answer: true }] });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });
  await test("5.4", "assessment missing founderId/items is rejected", async () => {
    const r = await call(sessions.Evaluator, "POST", "/assessments", { notes: "no founder" });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  // ── 6. Founder DNA / Insights ────────────────────────────────────────
  await test("6.1", "insights shape has profileConfidence 0-100 and all 8 dimensions", async () => {
    const r = await call(sessions.Evaluator, "GET", `/founder-dna/${me.Sarah.id}`);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(Number.isFinite(r.data.profileConfidence) && r.data.profileConfidence >= 0 && r.data.profileConfidence <= 100, "invalid profileConfidence");
    const dims = ["execution", "integrity", "commitment", "communication", "conflict", "resilience", "ego", "values"];
    assert(dims.every((d) => d in r.data.dimensions), "missing a DNA dimension");
    return { profileConfidence: r.data.profileConfidence, dimensions: r.data.dimensions };
  });
  await test("6.2", "founder with no evidence shows null scores and a populated empty state, never a fabricated 0", async () => {
    // Mia is deliberately kept evidence-free in the seed data (unless a
    // --mutating run has since evaluated her — 5.1 adds one execution/ego
    // evidence point in that case, so only assert the invariant for
    // dimensions that stay untouched).
    const r = await call(sessions.Evaluator, "GET", `/founder-dna/${me.Mia.id}`);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.data.dimensions.resilience.score === null, "untouched dimension should have a null score, not 0");
    assert(Array.isArray(r.data.emptyState?.stillNeeded) && r.data.emptyState.stillNeeded.length > 0, "emptyState.stillNeeded should be populated");
    return r.data;
  });
  await test("6.3", "founder cannot view another founder's insights", async () => {
    const r = await call(sessions.Sarah, "GET", `/founder-dna/${me.Marcus.id}`);
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });
  if (MUTATING) {
    await test("6.4", "admin can force a recompute", async () => {
      const r = await call(sessions.Evaluator, "POST", `/founder-dna/${me.Sarah.id}/recompute`);
      assert(r.status === 200 && Number.isFinite(r.data?.profileConfidence), `expected recomputed insights, got ${r.status}`);
    });
  } else skipped("6.4", "run with --mutating");

  // ── 8. Activities (Phase 2) ──────────────────────────────────────────
  let activityId;
  if (MUTATING) {
    await test("8.1", "admin can create an activity", async () => {
      const r = await call(sessions.Evaluator, "POST", "/activities", {
        type: "workshop", title: `E2E Workshop ${Date.now()}`, description: "E2E-created activity",
      });
      assert(r.status === 201 && r.data?.id, `expected 201 with id, got ${r.status}`);
      activityId = r.data.id;
      return { activityId };
    });
    await test("8.2", "admin can assign participants and evaluators", async () => {
      const r1 = await call(sessions.Evaluator, "PUT", `/activities/${activityId}/participants`, { founderIds: [me.Sarah.id, me.Marcus.id] });
      assert(r1.status === 200, `expected 200, got ${r1.status}`);
      const r2 = await call(sessions.Evaluator, "PUT", `/activities/${activityId}/evaluators`, { evaluatorIds: [me.Evaluator.id] });
      assert(r2.status === 200, `expected 200, got ${r2.status}`);
      const detail = await call(sessions.Evaluator, "GET", `/activities/${activityId}`);
      assert(detail.data.participants.length === 2, "participants not persisted");
      assert(detail.data.evaluators.length === 1, "evaluators not persisted");
    });
    await test("8.3", "admin can update activity status", async () => {
      const r = await call(sessions.Evaluator, "PATCH", `/activities/${activityId}`, { status: "active" });
      assert(r.status === 200, `expected 200, got ${r.status}`);
      const detail = await call(sessions.Evaluator, "GET", `/activities/${activityId}`);
      assert(detail.data.status === "active", `expected active, got ${detail.data.status}`);
    });
    await test("8.4", "non-admin cannot create an activity", async () => {
      const r = await call(sessions.Sarah, "POST", "/activities", { type: "workshop", title: "Hijacked" });
      assert(r.status === 403, `expected 403, got ${r.status}`);
    });
    await test("8.5", "invalid activity type is rejected", async () => {
      const r = await call(sessions.Evaluator, "POST", "/activities", { type: "bogus", title: "x" });
      assert(r.status === 400, `expected 400, got ${r.status}`);
    });
  } else {
    for (const id of ["8.1", "8.2", "8.3", "8.4", "8.5"]) skipped(id, "run with --mutating");
  }
  await test("8.6", "any authenticated founder can list activities", async () => {
    const r = await call(sessions.Sarah, "GET", "/activities");
    assert(r.status === 200 && Array.isArray(r.data), `expected array, got ${r.status}`);
  });

  // ── 9. Peer Feedback (Phase 2) ───────────────────────────────────────
  if (MUTATING) {
    await test("9.1", "a founder can submit peer feedback about another founder", async () => {
      const r = await call(sessions.Sarah, "POST", "/peer-feedback", {
        founderId: me.Marcus.id, activityId, dimension: "communication", score: 78, observation: "E2E peer feedback",
      });
      assert(r.status === 201 && r.data?.id, `expected 201 with id, got ${r.status}`);
      return { feedbackId: r.data.id };
    });
    await test("9.2", "peer feedback fans out into evidence at weight 0.8", async () => {
      const r = await call(sessions.Evaluator, "GET", `/evidence?founderId=${me.Marcus.id}&dimension=communication&source=peer`);
      assert(r.status === 200 && r.data.length > 0, `expected at least one peer evidence row, got ${r.status}`);
      assert(Number(r.data[0].weight) === 0.8, `expected weight 0.8, got ${r.data[0].weight}`);
    });
    await test("9.3", "a founder cannot give peer feedback about themselves", async () => {
      const r = await call(sessions.Sarah, "POST", "/peer-feedback", { founderId: me.Sarah.id, dimension: "execution", score: 80 });
      assert(r.status === 400, `expected 400, got ${r.status}`);
    });
  } else {
    for (const id of ["9.1", "9.2", "9.3"]) skipped(id, "run with --mutating");
  }
  await test("9.4", "founder cannot list another founder's peer feedback", async () => {
    const r = await call(sessions.Sarah, "GET", `/peer-feedback?founderId=${me.Marcus.id}`);
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  // ── 10. Matches (Phase 2) ────────────────────────────────────────────
  if (MUTATING) {
    await test("10.1", "admin can trigger a match recompute for a founder", async () => {
      const r = await call(sessions.Evaluator, "POST", "/matches/recompute", { founderId: me.Sarah.id });
      assert(r.status === 200, `expected 200, got ${r.status}`);
    });
    await test("10.2", "top matches returns a scored, sorted list", async () => {
      const r = await call(sessions.Evaluator, "GET", `/matches/top?founderId=${me.Sarah.id}`);
      assert(r.status === 200 && Array.isArray(r.data), `expected array, got ${r.status}`);
      const scores = r.data.map((m) => m.score);
      const sorted = [...scores].sort((a, b) => b - a);
      assert(JSON.stringify(scores) === JSON.stringify(sorted), "matches not sorted by score desc");
      return { count: r.data.length, scores };
    });
    await test("10.3", "compare returns a dimension breakdown and explanation for a computed pair", async () => {
      const r = await call(sessions.Evaluator, "GET", `/matches/compare?a=${me.Sarah.id}&b=${me.Marcus.id}`);
      assert(r.status === 200, `expected 200, got ${r.status}`);
      assert(r.data.dimension_breakdown && r.data.explanation, "compare response missing breakdown/explanation");
    });
    await test("10.4", "founder can recompute their own matches but not another founder's", async () => {
      const own = await call(sessions.Sarah, "POST", "/matches/recompute", { founderId: me.Sarah.id });
      assert(own.status === 200, `expected 200 for own recompute, got ${own.status}`);
      const other = await call(sessions.Sarah, "POST", "/matches/recompute", { founderId: me.Marcus.id });
      assert(other.status === 403, `expected 403, got ${other.status}`);
    });
  } else {
    for (const id of ["10.1", "10.2", "10.3", "10.4"]) skipped(id, "run with --mutating");
  }
  await test("10.5", "non-admin cannot compare two founders", async () => {
    const r = await call(sessions.Sarah, "GET", `/matches/compare?a=${me.Sarah.id}&b=${me.Marcus.id}`);
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  // ── 11. Teams (Phase 3) ──────────────────────────────────────────────
  let teamId;
  if (MUTATING) {
    await test("11.1", "admin can preview a team before creating it", async () => {
      const r = await call(sessions.Evaluator, "GET", `/teams/preview?founderIds=${me.Alex.id},${me.Mia.id}`);
      assert(r.status === 200 && r.data?.profile, `expected 200 with profile, got ${r.status}`);
      return { profile: r.data.profile };
    });
    await test("11.2", "admin can create a team", async () => {
      const r = await call(sessions.Evaluator, "POST", "/teams", {
        name: `E2E Team ${Date.now()}`, founderIds: [me.Alex.id, me.Mia.id],
      });
      assert(r.status === 201 && r.data?.id, `expected 201 with id, got ${r.status}`);
      teamId = r.data.id;
      return { teamId };
    });
    await test("11.3", "team detail includes members and a computed profile", async () => {
      const r = await call(sessions.Evaluator, "GET", `/teams/${teamId}`);
      assert(r.status === 200, `expected 200, got ${r.status}`);
      assert(r.data.members?.length === 2, `expected 2 members, got ${r.data.members?.length}`);
      assert(r.data.profile && "compatibility" in r.data.profile, "team profile missing");
      return r.data;
    });
    await test("11.4", "a team member can view their own team, a non-member founder cannot", async () => {
      const own = await call(sessions.Alex, "GET", `/teams/${teamId}`);
      assert(own.status === 200, `expected 200 for own team, got ${own.status}`);
      const other = await call(sessions.Sarah, "GET", `/teams/${teamId}`);
      assert(other.status === 403, `expected 403, got ${other.status}`);
    });
    await test("11.5", "admin can trigger a Team DNA recompute", async () => {
      const r = await call(sessions.Evaluator, "POST", `/teams/${teamId}/recompute`);
      assert(r.status === 200 && r.data?.profile, `expected 200 with profile, got ${r.status}`);
    });
    await test("11.6", "non-admin cannot create a team", async () => {
      const r = await call(sessions.Sarah, "POST", "/teams", { name: "Hijacked", founderIds: [me.Sarah.id, me.Marcus.id] });
      assert(r.status === 403, `expected 403, got ${r.status}`);
    });
    await test("11.7", "founders list reflects in_team status for a team member", async () => {
      const r = await call(sessions.Evaluator, "GET", "/founders?search=Alex");
      assert(r.status === 200 && r.data[0]?.teamStatus === "in_team", `expected in_team, got ${r.data[0]?.teamStatus}`);
    });
    await test("11.8", "cleanup: admin can delete the E2E team", async () => {
      const r = await call(sessions.Evaluator, "DELETE", `/teams/${teamId}`);
      assert(r.status === 200, `expected 200, got ${r.status}`);
      const after = await call(sessions.Evaluator, "GET", "/founders?search=Alex");
      assert(after.data[0]?.teamStatus === "looking_for_team", "team membership was not cleaned up");
    });
  } else {
    for (const id of ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8"]) skipped(id, "run with --mutating");
  }
  await test("11.9", "any authenticated founder can list teams", async () => {
    const r = await call(sessions.Sarah, "GET", "/teams");
    assert(r.status === 200 && Array.isArray(r.data), `expected array, got ${r.status}`);
  });

  // ── 7. Cross-cutting ─────────────────────────────────────────────────
  await test("7.1", "protected endpoint rejects missing Authorization", async () => {
    const r = await call(null, "GET", "/founders", undefined, { noAuth: true });
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });
  await test("7.2", "protected endpoint rejects malformed token", async () => {
    const r = await call(null, "GET", "/founders", undefined, { headers: { Authorization: "Bearer garbage" } });
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });
  await test("7.3", "all founder-pivot Edge Functions are reachable", async () => {
    const probes = [
      ["founders", "GET", "/founders/dashboard"], ["evidence", "GET", `/evidence?founderId=${me.Sarah.id}`],
      ["assessments", "GET", `/assessments?founderId=${me.Sarah.id}`], ["founder-dna", "GET", `/founder-dna/${me.Sarah.id}`],
      ["users", "GET", "/users/me"], ["notifications", "GET", "/notifications"],
      ["activities", "GET", "/activities"], ["peer-feedback", "GET", `/peer-feedback?founderId=${me.Sarah.id}`],
      ["matches", "GET", `/matches/top?founderId=${me.Sarah.id}`], ["teams", "GET", "/teams"],
    ];
    const observed = [];
    for (const [name, method, route] of probes) {
      const r = await call(sessions.Evaluator, method, route);
      observed.push({ name, status: r.status });
      assert(r.status !== 404, `${name} returned 404`);
    }
    return observed;
  });

  const ordered = Object.values(results).sort((a, b) => {
    const [as, ac] = a.id.split(".").map(Number); const [bs, bc] = b.id.split(".").map(Number);
    return as - bs || ac - bc;
  });
  const counts = ordered.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(), target: { supabaseProject: "jwwrbmgplahlggiyouel" },
    flags: { MUTATING }, counts, results: ordered,
  }, null, 2));
  console.log(`\nWrote ${outputPath}`);
  console.log(counts);
  if (counts.FAIL) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), fatal: String(error.stack || error), results: Object.values(results) }, null, 2));
  process.exitCode = 2;
});
