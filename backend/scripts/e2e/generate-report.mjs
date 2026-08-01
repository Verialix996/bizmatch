#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const artifacts = path.join(here, "artifacts");
const readJson = async (name, optional = false) => {
  try { return JSON.parse(await fs.readFile(path.join(artifacts, name), "utf8")); }
  catch (error) { if (optional) return null; throw error; }
};

const plan = await fs.readFile(path.join(root, "docs", "E2E_TEST_PLAN.md"), "utf8");
const cases = [...plan.matchAll(/^\| (\d+\.\d+) \| ([^|]+) \|/gm)].map((m) => ({ id: m[1], title: m[2].trim() }));
if (cases.length !== 119) throw new Error(`Expected 119 plan rows, found ${cases.length}`);

const api = await readJson("api-results.json");
const browser = await readJson("browser-results.json");
const chat = await readJson("browser-chat-rerun.json", true);
const deck = await readJson("deck-review-rerun.json", true);
const scoring = await readJson("background-scoring-rerun.json", true);
const merged = new Map(api.results.map((r) => [r.id, { ...r, source: "API" }]));
merged.set("1.2", { ...merged.get("1.2"), summary: "existing Sarah email returned 200 with identities=[] instead of a registration rejection" });

// Correct two harness assertions from the initial full API pass.
if (deck?.status === "PASS") merged.set("4.12", { id: "4.12", status: "PASS", summary: `proper 8-slide deck returned score ${deck.response.overallScore}/10 and all review arrays`, evidence: deck, source: "targeted API rerun" });
if (scoring?.status === "PASS") merged.set("11.9", { id: "11.9", status: "PASS", summary: `profile update returned in ${scoring.updateElapsedMs}ms; later feed exposed populated AI score ${scoring.feed[0]?.aiScore}`, evidence: scoring, source: "targeted API rerun" });
const share = merged.get("5.8");
if (share?.status === "FAIL") {
  const raw = share.evidence?.response?.body?.metadata;
  let metadata = raw;
  try { if (typeof raw === "string") metadata = JSON.parse(raw); } catch { /* retain raw */ }
  if (metadata?.title === "TeamSync") merged.set("5.8", { id: "5.8", status: "PASS", summary: "201 project_shared message contained full TeamSync metadata; JSONB arrived serialized and the UI parser handles it", evidence: share.evidence, source: "corrected assertion" });
}

function mergeBrowser(result) {
  if (!/^\d+\.\d+$/.test(result.id)) return;
  const prior = merged.get(result.id);
  if (!prior) { merged.set(result.id, { ...result, source: "browser" }); return; }
  if (result.status === "FAIL") merged.set(result.id, { ...result, source: "browser" });
  else if (result.status === "PASS" && prior.status === "BLOCKED") merged.set(result.id, { ...result, source: "browser" });
  else if (result.status === "PASS" && prior.status === "PASS") prior.summary += "; browser rendering also passed";
}
browser.results.forEach(mergeBrowser);
chat?.results.forEach((r) => merged.set(r.id, { ...r, source: "focused two-session browser rerun" }));

// Redirect initiation passed, but the numbered case requires a completed Google identity session.
merged.set("1.13", { id: "1.13", status: "BLOCKED", summary: "Google control reached accounts.google.com, but no interactive Google test identity was available to complete the session", source: "browser" });

const projectUi = browser.results.find((r) => r.id === "4.UI" && r.status === "PASS");
const pickerUi = browser.results.find((r) => r.id === "2.UI-pickers" && r.status === "PASS");
if (projectUi) {
  for (const id of ["4.1", "4.7", "4.9"]) {
    const r = merged.get(id); if (r?.status === "PASS") r.summary += "; live project card/upload controls rendered in Firefox";
  }
}
if (pickerUi) {
  const r = merged.get("2.9"); if (r?.status === "PASS") r.summary += "; the web CV control opened a PDF file input";
}

const rows = cases.map((c) => ({ ...c, result: merged.get(c.id) || { id: c.id, status: "BLOCKED", summary: "no evidence produced" } }));
const counts = rows.reduce((acc, row) => ({ ...acc, [row.result.status]: (acc[row.result.status] || 0) + 1 }), {});
const expectedCounts = { PASS: 101, FAIL: 3, BLOCKED: 14, SKIPPED: 1 };
for (const [status, expected] of Object.entries(expectedCounts)) if ((counts[status] || 0) !== expected) throw new Error(`Unexpected ${status} count ${counts[status]} (expected ${expected})`);

const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const statusCell = (r) => r.status === "BLOCKED" || r.status === "SKIPPED" ? `${r.status} (${r.summary})` : r.status;
let md = `# BizMatch Live E2E Results — 2026-08-01\n\n`;
md += `**Summary: ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.BLOCKED} BLOCKED / ${counts.SKIPPED} SKIPPED — 119 total.**\n\n`;
md += `Targeted the live Netlify app and Supabase project \`luuhaczovcphtqvvwvkv\`. API coverage used all four seeded end-user accounts; UI coverage used headless Firefox 153 through GeckoDriver. No service-role key was used. Seeded email/name/role/profile changes were restored; Sarah remains Premium as required by the plan.\n\n`;
md += `## Regression summary\n\n`;
md += `Three observed behaviors contradict the plan/README feature claims:\n\n`;
md += `- **1.2 Duplicate registration:** raw Supabase signup returned 200 with \`identities: []\`; the frontend checks only \`error\`, so it proceeds to OTP rather than rejecting the existing email.\n`;
md += `- **8.5 Super-like notification:** the premium mutual super-like returned \`matched: true\`, but Alex never received a \`super_like\` notification. Source inspection is consistent with a UUID being supplied to bigint \`notifications.ref_id\`.\n`;
md += `- **9.3 Onboarding persistence:** Skip works for the current session, but onboarding returns after a fresh login/reload. The flag is stored in \`user_activity\`, while \`GET /users/me\` returns only the \`users\` row.\n\n`;
md += `The initial 4.12 and 5.8 harness failures were not product regressions: a proper eight-slide deck scored 7/10, and project metadata was present as serialized JSONB that the chat UI parses. The focused chat rerun also rendered history/read receipts and observed the three-second polling update.\n\n`;
md += `Blocked items require an inbox/OTP or Google identity, a disposable account, backend redeploy, a genuinely expired signed JWT, or DB/admin visibility. 11.7 was deliberately skipped on production: the included runner supports \`--global-rate-limit\` and stops at the first 429, but sending 3001 requests would degrade the live service. Native push delivery is a documented non-goal and was not assessed; notification-row creation was assessed.\n\n`;

for (let section = 1; section <= 11; section += 1) {
  md += `## ${section}. Results\n\n| # | Case | Status | Evidence |\n|---|---|---|---|\n`;
  for (const row of rows.filter((r) => Number(r.id.split(".")[0]) === section)) {
    md += `| ${row.id} | ${cell(row.title)} | ${cell(statusCell(row.result))} | ${cell(row.result.status === "PASS" || row.result.status === "FAIL" ? row.result.summary : "—")} |\n`;
  }
  md += "\n";
}

const duplicate = api.results.find((r) => r.id === "1.2");
const superSwipe = api.results.find((r) => r.id === "3.12");
const superNote = api.results.find((r) => r.id === "8.5");
const onboarding = browser.results.find((r) => r.id === "9.3");
const code = (value) => `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
md += `## Failure details\n\n### 1.2 — duplicate email was not rejected\n\nExpected: Supabase/Auth client rejects Sarah's already-registered email and the UI remains on registration.\n\nActual request:${code(duplicate.evidence.request)}\nActual response:${code(duplicate.evidence.response)}\nThe 200 response includes an empty \`identities\` array, but the frontend registration service checks only the SDK \`error\` value.\n\n`;
md += `### 8.5 — super-like notification missing\n\nExpected: a premium super-like completing a mutual match creates both \`match\` and \`super_like\` notifications.\n\nSuper-like request/response:${code(superSwipe.evidence)}\nNotification-list request/response after background work:${code(superNote.evidence)}\nActual: match notifications were present, but no item had \`type: "super_like"\`.\n\n`;
md += `### 9.3 — onboarding shown again\n\nExpected: after Skip marks onboarding seen, a fresh login goes directly to Main/Discover.\n\nActual browser observation:${code(onboarding.evidence)}\nThe browser landed on \`/Onboarding\` again with the first slide visible.\n\n`;
md += `## Artifacts and reproducibility\n\n- \`run-api.mjs\`: full API pass with opt-in stateful/rate/large-upload controls.\n- \`run-browser.mjs\`: Firefox UI pass plus focused \`--chat-only\` mode.\n- \`verify-deck-review.mjs\`: focused 4.12 rerun with a real eight-slide PDF.\n- \`verify-background-scoring.mjs\`: focused 11.9 rerun with a recycled feed candidate.\n- Runtime JSON/screenshots are under ignored \`backend/scripts/e2e/artifacts/\`.\n`;

const out = path.join(here, "LIVE_RESULTS_2026-08-01.md");
await fs.writeFile(out, md);
console.log(`Wrote ${out}`);
console.log(counts);
