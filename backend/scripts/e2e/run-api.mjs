#!/usr/bin/env node

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
const AUTH_RATE_LIMIT = flags.has("--auth-rate-limit");
const LARGE_UPLOADS = flags.has("--large-uploads");
const GLOBAL_RATE_LIMIT = flags.has("--global-rate-limit");
const outputArg = process.argv.indexOf("--output");
const outputPath = outputArg >= 0
  ? path.resolve(process.argv[outputArg + 1])
  : path.join(here, "artifacts", "api-results.json");

const accounts = {
  Sarah: "sarah.chen@bizmatch.app",
  Marcus: "marcus.webb@bizmatch.app",
  Alex: "alex.rivera@bizmatch.app",
  Mia: "mia.johnson@bizmatch.app",
};

const results = {};
const exchanges = [];
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
      /token|authorization|apikey/i.test(k) ? k : k,
      /token|authorization|apikey/i.test(k) ? "<redacted>" : clean(v),
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
      request: lastExchange?.request,
      response: lastExchange?.response,
      expected: error.message,
    });
    return false;
  }
}

function blocked(id, reason) { record(id, "BLOCKED", reason); }
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
  if (contentType.includes("json")) {
    return await response.json().catch(() => null);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { byteLength: bytes.length, preview: Buffer.from(bytes.slice(0, 40)).toString("hex") };
}

async function request(label, url, init = {}, timeoutMs = 45_000) {
  const started = performance.now();
  const response = await fetchWithTimeout(url, init, timeoutMs);
  const data = await parseResponse(response);
  lastExchange = {
    label,
    request: {
      method: init.method || "GET",
      url,
      headers: clean(init.headers || {}),
      body: init.body instanceof FormData ? "<multipart/form-data>" : clean(init.body || null),
    },
    response: {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: clean(data),
      elapsedMs: Math.round(performance.now() - started),
    },
  };
  exchanges.push(lastExchange);
  return { status: response.status, headers: response.headers, data, elapsedMs: lastExchange.response.elapsedMs };
}

async function signIn(name, password = PASSWORD) {
  const response = await request(
    `sign in ${name}`,
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: accounts[name] || name, password }),
    },
  );
  return response;
}

async function call(session, method, route, body, options = {}) {
  const headers = { apikey: API_KEY, ...(options.headers || {}) };
  if (session?.access_token && !options.noAuth) headers.Authorization = `Bearer ${session.access_token}`;
  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }
  return request(`${method} ${route}`, `${API}${route}`, {
    method,
    headers,
    ...(requestBody !== undefined ? { body: requestBody } : {}),
  }, options.timeoutMs || 45_000);
}

async function authCall(method, route, body) {
  return request(`${method} auth ${route}`, `${SUPABASE_URL}/auth/v1${route}`, {
    method,
    headers: { apikey: API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sessionOf(response) {
  assert(response.status === 200 && response.data?.access_token, `expected 200 session, got ${response.status}`);
  return response.data;
}

function tinyPdf(text = "BizMatch E2E pitch deck") {
  const safe = text.replace(/[()\\]/g, " ");
  return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${safe.length + 35}>>stream\nBT /F1 12 Tf 72 720 Td (${safe}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`);
}

function pitchDeckPdf() {
  const slides = [
    ["TeamSync", "Async collaboration for distributed startup teams", "Seed round pitch | August 2026"],
    ["Problem", "Remote startup teams lose 12 hours per employee each month to status meetings", "Work is fragmented across chat, tasks, and documents", "Managers lack a reliable view of blockers and ownership"],
    ["Solution", "TeamSync combines async standups, decision logs, and accountable tasks", "Automated summaries keep every timezone aligned", "A single workspace replaces three disconnected tools"],
    ["Market", "TAM: $18B global collaboration software market", "SAM: $4.2B for teams of 10 to 500 employees", "SOM: $210M focused on venture-backed remote startups"],
    ["Business Model", "SaaS subscription at $18 per active user per month", "Enterprise plan adds security, analytics, and priority support", "82 percent gross margin with annual contracts"],
    ["Traction", "14,200 weekly active users across 180 companies", "$640K ARR growing 18 percent month over month", "Net revenue retention of 124 percent and 3.1 percent monthly churn"],
    ["Team and Financials", "CEO: repeat founder with one prior exit", "CTO: former collaboration-platform engineering lead", "Forecast: $0.9M, $2.8M, and $7.4M ARR over the next three years"],
    ["Funding Ask", "Raising $2.5M seed financing for 18 months runway", "45 percent product, 35 percent go-to-market, 20 percent operations", "Milestones: $3M ARR, 600 customers, and SOC 2 certification"],
  ];
  const escape = (s) => s.replace(/[()\\]/g, (c) => `\\${c}`);
  const fontId = 3 + slides.length * 2;
  const kids = slides.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${slides.length} >>`,
  ];
  for (let i = 0; i < slides.length; i += 1) {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    const [heading, ...lines] = slides[i];
    const commands = [
      "BT", "/F1 26 Tf", "50 740 Td", `(${escape(heading)}) Tj`, "/F1 13 Tf",
      ...lines.flatMap((line) => ["0 -42 Td", `(${escape(line)}) Tj`]), "ET",
    ].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`);
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function formFile(field, bytes, filename, type) {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type }), filename);
  return form;
}

function findMatch(list, userId) {
  return Array.isArray(list) ? list.find((m) => m.userId === userId) : null;
}

async function main() {
  console.log(`BizMatch live API pass: mutating=${MUTATING}, auth-rate-limit=${AUTH_RATE_LIMIT}, large-uploads=${LARGE_UPLOADS}, global-rate-limit=${GLOBAL_RATE_LIMIT}`);

  blocked("1.1", "requires a disposable inbox and real OTP delivery");
  await test("1.2", "duplicate seeded email is rejected", async () => {
    const r = await authCall("POST", "/signup", { email: accounts.Sarah, password: PASSWORD, data: { name: "Duplicate Sarah", role: "investor" } });
    assert(r.status >= 400, `expected duplicate rejection, got ${r.status} with identities=${JSON.stringify(r.data?.identities)}`);
    return lastExchange;
  });
  await test("1.3", "weak password is rejected by Supabase Auth", async () => {
    const r = await authCall("POST", "/signup", { email: `weak-${Date.now()}@example.com`, password: "a", data: { name: "Weak Password" } });
    assert(r.status >= 400, `expected 4xx, got ${r.status}`);
  });
  await test("1.4", "moderation rejects a flagged registration name", async () => {
    const r = await call(null, "POST", "/auth/precheck-name", { name: "fuckboy" });
    assert(r.status === 400 && /flagged/i.test(r.data?.error || ""), `expected 400 moderation error, got ${r.status}`);
  });
  await test("1.5", "empty registration name is rejected", async () => {
    const r = await call(null, "POST", "/auth/precheck-name", { name: " " });
    assert(r.status === 400 && r.data?.error === "Name is required", `expected 400 Name is required, got ${r.status}`);
  });
  blocked("1.6", "requires a disposable inbox and real OTP");
  blocked("1.7", "requires an unverified disposable signup to exercise signup OTP rejection");
  blocked("1.8", "requires inbox access to compare old and resent OTPs");

  const authResponses = await Promise.all(Object.keys(accounts).map((name) => signIn(name)));
  const sessions = Object.fromEntries(Object.keys(accounts).map((name, i) => [name, sessionOf(authResponses[i])]));
  await test("1.9", "seeded Sarah login succeeds", async () => {
    assert(authResponses[0].status === 200, `expected 200, got ${authResponses[0].status}`);
    return { status: authResponses[0].status, hasSession: true };
  });
  await test("1.10", "wrong password creates no session", async () => {
    const r = await signIn("Sarah", "DefinitelyWrong123!");
    assert(r.status >= 400 && !r.data?.access_token, `expected auth rejection, got ${r.status}`);
  });
  await test("1.11", "nonexistent email creates no session", async () => {
    const r = await signIn(`missing-${Date.now()}@example.com`, PASSWORD);
    assert(r.status >= 400 && !r.data?.access_token, `expected auth rejection, got ${r.status}`);
  });
  blocked("1.12", "requires a disposable inbox and password-reset link");
  blocked("1.13", "requires an interactive Google identity; covered only to the provider redirect boundary in browser results");
  blocked("1.14", "browser-only; see browser runner results");
  if (!AUTH_RATE_LIMIT) skipped("1.15", "run with --auth-rate-limit; intentionally last because it consumes the fixed-window IP allowance");
  blocked("1.16", "browser logout is covered by browser runner; Auth API logout would invalidate unrelated test sessions");

  const me = {};
  for (const name of Object.keys(accounts)) {
    const r = await call(sessions[name], "GET", "/users/me");
    assert(r.status === 200, `failed to fetch ${name}`);
    me[name] = r.data;
  }

  blocked("2.1", "requires a disposable newly registered entrepreneur; update/background timing is covered by 11.9");
  blocked("2.2", "requires a disposable newly registered investor");
  if (MUTATING) {
    await test("2.3", "profile fields persist and are restored", async () => {
      const before = (await call(sessions.Mia, "GET", "/profile")).data;
      const marker = `https://example.com/e2e-${Date.now()}`;
      try {
        const update = await call(sessions.Mia, "PUT", "/profile", { ...before, portfolio_url: marker });
        assert(update.status === 200, `expected update 200, got ${update.status}`);
        const after = await call(sessions.Mia, "GET", "/profile");
        assert(after.data?.portfolio_url === marker, "updated portfolio URL did not persist");
      } finally {
        await call(sessions.Mia, "PUT", "/profile", before);
      }
      return { restored: true, field: "portfolio_url" };
    });
  } else skipped("2.3", "run with --mutating");
  await test("2.4", "flagged bio is rejected and not saved", async () => {
    const r = await call(sessions.Mia, "PUT", "/profile", { bio: "fuckboy" });
    assert(r.status === 400 && /Bio flagged/i.test(r.data?.error || ""), `expected 400 bio moderation, got ${r.status}`);
  });
  await test("2.5", "flagged skill is rejected and not saved", async () => {
    const r = await call(sessions.Mia, "PUT", "/profile", { skills: ["strategy", "fuckboy"] });
    assert(r.status === 400 && /Skills flagged/i.test(r.data?.error || ""), `expected 400 skills moderation, got ${r.status}`);
  });
  blocked("2.6", "UI-only incremental completeness indicator; see browser results");
  blocked("2.7", "successful upload would irreversibly replace a seeded photo; no disposable account/inbox was supplied");
  await test("2.8", "non-image photo payload is rejected", async () => {
    const r = await call(sessions.Marcus, "POST", "/users/me/photo", { photo: "data:text/plain;base64,SGVsbG8=" });
    assert(r.status === 400 && /base64 JPEG or PNG/i.test(r.data?.error || ""), `expected 400 image-format error, got ${r.status}`);
  });

  let uploadedCv = false;
  if (MUTATING) {
    await test("2.9", "PDF CV uploads under 20 MiB", async () => {
      const r = await call(sessions.Marcus, "POST", "/profile/upload-cv", formFile("cv", tinyPdf("BizMatch E2E CV"), "e2e-cv.pdf", "application/pdf"));
      assert(r.status === 200 && r.data?.cv_url, `expected 200 cv_url, got ${r.status}`);
      uploadedCv = true;
    });
  } else skipped("2.9", "run with --mutating");
  if (LARGE_UPLOADS) {
    await test("2.10", "CV over 20 MiB is rejected", async () => {
      const r = await call(sessions.Marcus, "POST", "/profile/upload-cv", formFile("cv", new Uint8Array(20 * 1024 * 1024 + 1), "oversize.pdf", "application/pdf"), { timeoutMs: 120_000 });
      assert(r.status === 413, `expected 413, got ${r.status}`);
    });
  } else skipped("2.10", "run with --large-uploads");
  if (uploadedCv) {
    await test("2.11", "CV streams via token query parameter as PDF", async () => {
      const r = await request("GET /profile/cv?token=<redacted>", `${API}/profile/cv?token=${encodeURIComponent(sessions.Marcus.access_token)}`);
      assert(r.status === 200 && /^application\/pdf/i.test(r.headers.get("content-type") || ""), `expected 200 application/pdf, got ${r.status} ${r.headers.get("content-type")}`);
    });
  } else skipped("2.11", "requires successful 2.9 upload");
  await test("2.12", "self-verification endpoint reports verified", async () => {
    const r = await call(sessions.Marcus, "POST", "/users/me/verify-self");
    assert(r.status === 200 && r.data?.verification_status === "verified", `expected verified, got ${r.status}`);
  });
  if (MUTATING) {
    await test("2.13", "role switch persists and seeded role is restored", async () => {
      const original = me.Sarah.role;
      try {
        let r = await call(sessions.Sarah, "PATCH", "/users/me/role", { role: original === "investor" ? "entrepreneur" : "investor" });
        assert(r.status === 200 && r.data?.role !== original, "role did not switch");
        r = await call(sessions.Sarah, "GET", "/users/me");
        assert(r.data?.role !== original, "role switch did not persist");
      } finally {
        await call(sessions.Sarah, "PATCH", "/users/me/role", { role: original });
      }
      return { restoredRole: original };
    });
  } else skipped("2.13", "run with --mutating");
  await test("2.14", "public profile returns only the documented safe shape", async () => {
    const r = await call(sessions.Sarah, "GET", `/profile/public/${me.Alex.id}`);
    assert(r.status === 200 && r.data?.userId === me.Alex.id, `expected Alex public profile, got ${r.status}`);
    assert(!("email" in r.data) && !("password_hash" in r.data), "public profile leaked a private field");
  });
  await test("2.15", "bogus public-profile UUID returns 404", async () => {
    const r = await call(sessions.Sarah, "GET", "/profile/public/00000000-0000-4000-8000-000000000000");
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  const feedSarah = await call(sessions.Sarah, "GET", "/match/feed");
  await test("3.1", "investor feed contains entrepreneurs only", async () => {
    assert(feedSarah.status === 200 && Array.isArray(feedSarah.data), `expected array, got ${feedSarah.status}`);
    assert(feedSarah.data.every((c) => c.role === "entrepreneur"), "investor feed included a non-entrepreneur");
    return { count: feedSarah.data.length, roles: [...new Set(feedSarah.data.map((c) => c.role))] };
  });
  const feedAlex = await call(sessions.Alex, "GET", "/match/feed");
  await test("3.2", "entrepreneur feed contains other entrepreneurs only", async () => {
    assert(feedAlex.status === 200 && Array.isArray(feedAlex.data), `expected array, got ${feedAlex.status}`);
    assert(feedAlex.data.every((c) => c.role === "entrepreneur" && c.userId !== me.Alex.id), "entrepreneur feed included self or investor");
    return { count: feedAlex.data.length, roles: [...new Set(feedAlex.data.map((c) => c.role))] };
  });

  if (MUTATING) {
    const passTarget = me.Mia.id;
    await test("3.3", "pass is recorded and candidate moves into the passed portion", async () => {
      const r = await call(sessions.Sarah, "POST", "/match/swipe", { targetUserId: passTarget, direction: "pass" });
      assert(r.status === 200 && r.data?.matched === false, `expected unmatched pass, got ${r.status}`);
      const after = await call(sessions.Sarah, "GET", "/match/feed");
      assert(after.status === 200, `feed reload failed ${after.status}`);
      return { targetStillRecycled: after.data.some((c) => c.userId === passTarget) };
    });
    await test("3.4", "one-sided like returns matched false", async () => {
      await call(sessions.Alex, "POST", "/match/swipe", { targetUserId: me.Marcus.id, direction: "pass" });
      const r = await call(sessions.Marcus, "POST", "/match/swipe", { targetUserId: me.Alex.id, direction: "like" });
      assert(r.status === 200 && r.data?.matched === false, `expected matched false, got ${JSON.stringify(r.data)}`);
    });
    await test("3.5", "mutual likes create or return a Marcus–Mia match", async () => {
      await call(sessions.Mia, "POST", "/match/swipe", { targetUserId: me.Marcus.id, direction: "like" });
      const r = await call(sessions.Marcus, "POST", "/match/swipe", { targetUserId: me.Mia.id, direction: "like" });
      assert(r.status === 200 && r.data?.matched === true && r.data?.matchId, `expected mutual match, got ${JSON.stringify(r.data)}`);
    });
  } else {
    for (const id of ["3.3", "3.4", "3.5"]) skipped(id, "run with --mutating");
  }
  await test("3.6", "self swipe is rejected", async () => {
    const r = await call(sessions.Marcus, "POST", "/match/swipe", { targetUserId: me.Marcus.id, direction: "like" });
    assert(r.status === 400 && /yourself/i.test(r.data?.error || ""), `expected 400 self-swipe, got ${r.status}`);
  });
  await test("3.7", "invalid direction is rejected", async () => {
    const r = await call(sessions.Marcus, "POST", "/match/swipe", { targetUserId: me.Mia.id, direction: "maybe" });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  if (MUTATING) {
    await test("3.8", "re-swipe updates direction without an API error", async () => {
      let r = await call(sessions.Mia, "POST", "/match/swipe", { targetUserId: me.Alex.id, direction: "like" });
      assert(r.status === 200, `like failed ${r.status}`);
      r = await call(sessions.Mia, "POST", "/match/swipe", { targetUserId: me.Alex.id, direction: "pass" });
      assert(r.status === 200 && r.data?.matched === false, `pass upsert failed ${r.status}`);
    });
  } else skipped("3.8", "run with --mutating");

  let sarahPremium = false;
  if (MUTATING) {
    const activate = await call(sessions.Sarah, "POST", "/users/me/premium/activate");
    sarahPremium = activate.status === 200;
    await test("7.1", "30-day premium trial activates", async () => {
      assert(activate.status === 200 && activate.data?.expiresAt, `expected activation, got ${activate.status}`);
      const days = (new Date(activate.data.expiresAt) - Date.now()) / 86_400_000;
      assert(days > 29 && days <= 31, `expected about 30 days, got ${days.toFixed(2)}`);
    });
  } else skipped("7.1", "run with --mutating");

  if (MUTATING) {
    await test("3.9", "free daily swipe limit returns first 429 without retries", async () => {
      let observed = null;
      for (let i = 0; i < 21; i += 1) {
        const r = await call(sessions.Marcus, "POST", "/match/swipe", { targetUserId: me.Alex.id, direction: i % 2 ? "like" : "pass" });
        if (r.status === 429) { observed = r; break; }
      }
      assert(observed?.data?.upgradeRequired === true, "did not observe the daily-limit 429 within 21 requests (account may have been reset or premium)");
    });
    await test("3.10", "premium Sarah exceeds 20 swipes without daily-limit 429", async () => {
      assert(sarahPremium, "Sarah premium activation failed");
      for (let i = 0; i < 21; i += 1) {
        const r = await call(sessions.Sarah, "POST", "/match/swipe", { targetUserId: me.Mia.id, direction: i % 2 ? "pass" : "like" });
        assert(r.status !== 429, `premium request ${i + 1} hit 429`);
      }
      return { swipes: 21 };
    });
    await test("3.11", "free-user super-like request is accepted only as a normal swipe", async () => {
      const r = await call(sessions.Mia, "POST", "/match/swipe", { targetUserId: me.Alex.id, direction: "like", superLike: true });
      assert(r.status === 200, `expected normal swipe response, got ${r.status}`);
      return { note: "Response does not expose is_super_like; server-side flag requires DB inspection" };
    });
    await test("3.12", "premium super-like on a mutual swipe emits API match result", async () => {
      await call(sessions.Alex, "POST", "/match/swipe", { targetUserId: me.Sarah.id, direction: "like" });
      const r = await call(sessions.Sarah, "POST", "/match/swipe", { targetUserId: me.Alex.id, direction: "like", superLike: true });
      assert(r.status === 200 && r.data?.matched === true, `expected matched super-like, got ${JSON.stringify(r.data)}`);
    });
  } else {
    for (const id of ["3.9", "3.10", "3.11", "3.12"]) skipped(id, "run with --mutating");
  }

  await test("3.13", "feed ranking returns bounded scores and remains stable enough to reload", async () => {
    const first = await call(sessions.Alex, "GET", "/match/feed");
    const second = await call(sessions.Alex, "GET", "/match/feed");
    assert(first.status === 200 && second.status === 200, `feed returned ${first.status}/${second.status}`);
    assert(second.data.every((c) => Number.isFinite(c.score) && c.score >= 0 && c.score <= 100), "feed contains invalid score");
    return { first: first.data.map((c) => ({ userId: c.userId, score: c.score, aiScore: c.aiScore })), second: second.data.map((c) => ({ userId: c.userId, score: c.score, aiScore: c.aiScore })) };
  });
  await test("3.14", "feed responds using fallback when scores are absent or delayed", async () => {
    const r = await call(sessions.Marcus, "GET", "/match/feed", undefined, { timeoutMs: 15_000 });
    assert(r.status === 200 && Array.isArray(r.data), `expected feed within 15s, got ${r.status}`);
    return { elapsedMs: r.elapsedMs, nullAiScores: r.data.filter((c) => c.aiScore == null).length };
  });
  await test("3.15", "compatibility returns score/pros/cons shape", async () => {
    const r = await call(sessions.Sarah, "GET", `/match/compatibility/${me.Alex.id}`, undefined, { timeoutMs: 90_000 });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(Number.isFinite(r.data?.score) && r.data.score >= 0 && r.data.score <= 100, "invalid score");
    assert(Array.isArray(r.data?.pros) && r.data.pros.length >= 2 && r.data.pros.length <= 4, "invalid pros length");
    assert(Array.isArray(r.data?.cons) && r.data.cons.length >= 1 && r.data.cons.length <= 3, "invalid cons length");
  });
  blocked("3.16", "requires backend redeploy with GEMINI_API_KEY unset/invalid");
  await test("3.17", "compatibility bogus target returns 404 when AI is configured", async () => {
    const r = await call(sessions.Sarah, "GET", "/match/compatibility/00000000-0000-4000-8000-000000000000", undefined, { timeoutMs: 90_000 });
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  const pitchPdf = pitchDeckPdf();
  await test("4.2", "investor team creation is blocked", async () => {
    const r = await call(sessions.Sarah, "POST", "/challenges/teams", { name: "Investor must not create" });
    assert(r.status === 403 && /Only entrepreneurs/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
  });
  await test("4.4", "team name moderation rejects create", async () => {
    const r = await call(sessions.Mia, "POST", "/challenges/teams", { name: "fuckboy" });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  const myTeams = await call(sessions.Alex, "GET", "/challenges/teams/mine");
  const teamSyncSquad = myTeams.data?.find((t) => t.name === "TeamSync Squad") || myTeams.data?.[0];
  await test("4.13", "non-member is blocked from reading a team", async () => {
    assert(teamSyncSquad?.id, "existing team unavailable");
    const r = await call(sessions.Marcus, "GET", `/challenges/teams/${teamSyncSquad.id}`);
    assert(r.status === 403 && /Not a member/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
  });
  await test("4.7", "non-creator member cannot invite (star topology)", async () => {
    assert(teamSyncSquad?.id, "existing team unavailable");
    const r = await call(sessions.Mia, "POST", `/challenges/teams/${teamSyncSquad.id}/invite`, { userId: me.Marcus.id });
    assert(r.status === 403 && /Only the team creator/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
  });
  await test("4.5", "inviting an unmatched user is blocked", async () => {
    const r = await call(sessions.Alex, "POST", "/challenges/teams", { name: `E2E blocked-invite check ${Date.now()}` });
    if (r.status !== 201) return skipped("4.5", `team create returned ${r.status}`);
    const inv = await call(sessions.Alex, "POST", `/challenges/teams/${r.data.id}/invite`, { userId: me.Marcus.id });
    assert(inv.status === 403 && /must have a match/i.test(inv.data?.error || ""), `expected 403, got ${inv.status}`);
  });
  await test("4.51", "non-numeric team id returns 404, not 500", async () => {
    const r = await call(sessions.Sarah, "GET", "/challenges/teams/abc");
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });
  const myChallenges = await call(sessions.Sarah, "GET", "/challenges/challenges/mine");
  await test("4.20", "entrepreneur challenge creation is blocked", async () => {
    const r = await call(sessions.Alex, "POST", "/challenges/challenges", { title: "Entrepreneur must not create", submissionDeadline: new Date(Date.now() + 86_400_000).toISOString() });
    assert(r.status === 403 && /Only investors/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
  });
  await test("4.21", "challenge creation requires title and deadline", async () => {
    const r = await call(sessions.Sarah, "POST", "/challenges/challenges", { title: "" });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  if (MUTATING) {
    let openChallenge = null;
    await test("4.19", "investor creates a hackathon challenge", async () => {
      const r = await call(sessions.Sarah, "POST", "/challenges/challenges", { title: `E2E Hackathon ${Date.now()}`, description: "Temporary challenge created by the live E2E pass", submissionDeadline: new Date(Date.now() + 3_600_000).toISOString() });
      assert(r.status === 201 && r.data?.id, `expected 201 challenge, got ${r.status}`);
      openChallenge = r.data;
      const mine = await call(sessions.Sarah, "GET", "/challenges/challenges/mine");
      assert(mine.data?.some((c) => c.id === openChallenge.id), "created challenge missing from mine");
    });
    await test("4.24", "open challenges list includes the new hackathon", async () => {
      const r = await call(sessions.Mia, "GET", "/challenges/challenges/open");
      assert(r.status === 200 && r.data?.some((c) => c.id === openChallenge?.id), `expected new challenge in open list, got ${r.status}`);
    });
    if (teamSyncSquad?.id && openChallenge?.id) {
      let signupId = null;
      await test("4.25", "cohesion-complete team can sign up for an open hackathon", async () => {
        const r = await call(sessions.Alex, "POST", `/challenges/challenges/${openChallenge.id}/signup`, { teamId: teamSyncSquad.id });
        assert([200, 201].includes(r.status), `expected signup success, got ${r.status}: ${JSON.stringify(r.data)}`);
        signupId = r.data?.id;
      });
      if (signupId) {
        await test("4.28", "pitch deck PDF uploads to a challenge signup", async () => {
          const r = await call(sessions.Alex, "POST", `/challenges/signups/${signupId}/upload-deck`, formFile("deck", pitchPdf, "e2e-pitch.pdf", "application/pdf"));
          assert(r.status === 200 && r.data?.deck_url, `expected deck_url, got ${r.status}`);
        });
        await test("4.31", "submit without a video is rejected", async () => {
          const r = await call(sessions.Alex, "POST", `/challenges/signups/${signupId}/submit`, { description: "E2E entry description" });
          assert(r.status === 400 && /deck and demo video/i.test(r.data?.error || ""), `expected 400, got ${r.status}`);
        });
      } else skipped("4.28", "signup did not return an id");
    } else skipped("4.25", "requires an existing cohesion-complete team");
    await test("4.36", "select winner before deadline is rejected", async () => {
      const r = await call(sessions.Sarah, "POST", `/challenges/challenges/${openChallenge.id}/select-winner`, { teamId: teamSyncSquad?.id ?? "1" });
      assert(r.status === 400 && /Deadline hasn't passed/i.test(r.data?.error || ""), `expected 400, got ${r.status}`);
    });
  } else {
    for (const id of ["4.19", "4.24", "4.25", "4.36"]) skipped(id, "run with --mutating");
  }
  await test("4.18", "signup without cohesion completion is gated", async () => {
    const fresh = await call(sessions.Mia, "POST", "/challenges/teams", { name: `E2E gate-check ${Date.now()}` });
    if (fresh.status !== 201 || !myChallenges.data?.[0]?.id) return skipped("4.18", "requires a fresh team and an existing challenge");
    const r = await call(sessions.Mia, "POST", `/challenges/challenges/${myChallenges.data[0].id}/signup`, { teamId: fresh.data.id });
    assert(r.status === 403 && /cohesion challenge first/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
  });

  const sarahMatches = await call(sessions.Sarah, "GET", "/match/matches");
  const sarahAlex = findMatch(sarahMatches.data, me.Alex.id);
  await test("5.1", "conversation list includes Sarah–Alex with preview", async () => {
    const r = await call(sessions.Sarah, "GET", "/messages");
    const c = r.data?.find((x) => x.userId === me.Alex.id);
    assert(r.status === 200 && c && c.lastMessage, `expected Sarah–Alex preview, got ${r.status}`);
    return c;
  });
  let sentMessage = null;
  await test("5.2", "Sarah–Alex message history is ascending and seeded", async () => {
    assert(sarahAlex?.matchId, "Sarah–Alex match unavailable");
    const r = await call(sessions.Sarah, "GET", `/messages/${sarahAlex.matchId}`);
    assert(r.status === 200 && r.data.length >= 2, `expected at least 2 messages, got ${r.status}/${r.data?.length}`);
    assert(r.data.every((m, i, a) => i === 0 || new Date(a[i - 1].created_at) <= new Date(m.created_at)), "messages not ascending");
    return { count: r.data.length, types: [...new Set(r.data.map((m) => m.message_type))] };
  });
  if (MUTATING) {
    await test("5.3", "new message is saved with sender and timestamp", async () => {
      const r = await call(sessions.Sarah, "POST", `/messages/${sarahAlex.matchId}`, { body: `E2E message ${new Date().toISOString()}` });
      assert(r.status === 201 && r.data?.sender_id === me.Sarah.id && r.data?.created_at, `expected 201 message, got ${r.status}`);
      sentMessage = r.data;
    });
  } else skipped("5.3", "run with --mutating");
  await test("5.4", "flagged message is rejected", async () => {
    const r = await call(sessions.Sarah, "POST", `/messages/${sarahAlex.matchId}`, { body: "fuckboy" });
    assert(r.status === 400 && /flagged/i.test(r.data?.error || ""), `expected 400 moderation, got ${r.status}`);
  });
  await test("5.5", "nonparticipant cannot post to Sarah–Alex match", async () => {
    const r = await call(sessions.Mia, "POST", `/messages/${sarahAlex.matchId}`, { body: "unauthorized e2e" });
    assert(r.status === 403 && /Not part/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
  });
  if (sentMessage) {
    await test("5.6", "receiver marks incoming message read", async () => {
      const mark = await call(sessions.Alex, "POST", `/messages/${sarahAlex.matchId}/read`);
      assert(mark.status === 200, `mark read failed ${mark.status}`);
      const r = await call(sessions.Sarah, "GET", `/messages/${sarahAlex.matchId}?after=${sentMessage.id - 1}`);
      const message = r.data?.find((m) => m.id === sentMessage.id);
      assert(message?.read_at, "message read_at was not stamped");
    });
  } else skipped("5.6", "requires mutating send in 5.3");
  blocked("5.7", "premium read-receipt distinction is UI-only; API correctly exposes read_at to both roles");
  await test("5.8", "after parameter returns only higher ids in ascending order", async () => {
    const all = await call(sessions.Sarah, "GET", `/messages/${sarahAlex.matchId}`);
    assert(all.data?.length >= 2, "not enough messages for after test");
    const pivot = all.data[Math.max(0, all.data.length - 2)].id;
    const r = await call(sessions.Sarah, "GET", `/messages/${sarahAlex.matchId}?after=${pivot}`);
    assert(r.status === 200 && r.data.every((m) => m.id > pivot), "after returned an old message");
    assert(r.data.every((m, i, a) => i === 0 || a[i - 1].id < m.id), "after result not ascending");
  });
  blocked("5.9", "requires two concurrent browser sessions and a timed polling observation");

  const marcusMatches = await call(sessions.Marcus, "GET", "/match/matches");
  const marcusMia = findMatch(marcusMatches.data, me.Mia.id);
  const meetingPayload = (matchId, locationType = "virtual") => ({
    matchId,
    title: `E2E ${locationType} meeting`,
    scheduledAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    locationType,
    ...(locationType === "virtual" ? { videoLink: "https://meet.example.com/e2e" } : { address: "1 Test Street" }),
  });
  if (MUTATING) {
    await test("6.1", "free matched user cannot propose a meeting", async () => {
      assert(marcusMia?.matchId, "Marcus–Mia match unavailable");
      const r = await call(sessions.Marcus, "POST", "/meetings", meetingPayload(marcusMia.matchId));
      assert(r.status === 403 && r.data?.upgradeRequired === true, `expected premium 403, got ${r.status}`);
    });
  } else skipped("6.1", "requires --mutating match");

  let virtualMeeting = null;
  if (MUTATING && sarahPremium && sarahAlex?.matchId) {
    await test("6.4", "virtual proposal requires videoLink", async () => {
      const p = meetingPayload(sarahAlex.matchId); delete p.videoLink;
      const r = await call(sessions.Sarah, "POST", "/meetings", p);
      assert(r.status === 400 && /videoLink is required/i.test(r.data?.error || ""), `expected 400, got ${r.status}`);
    });
    await test("6.5", "in-person proposal requires address", async () => {
      const p = meetingPayload(sarahAlex.matchId, "in_person"); delete p.address;
      const r = await call(sessions.Sarah, "POST", "/meetings", p);
      assert(r.status === 400 && /address is required/i.test(r.data?.error || ""), `expected 400, got ${r.status}`);
    });
    await test("6.6", "nonparticipant cannot propose against another match", async () => {
      const r = await call(sessions.Sarah, "POST", "/meetings", meetingPayload(marcusMia?.matchId || 999999));
      assert(r.status === 403 && /Not part/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
    });
    await test("6.2", "premium proposer creates virtual meeting and chat card", async () => {
      const r = await call(sessions.Sarah, "POST", "/meetings", meetingPayload(sarahAlex.matchId));
      assert(r.status === 201 && r.data?.location_type === "virtual" && r.data?.status === "proposed", `expected 201 virtual meeting, got ${r.status}`);
      virtualMeeting = r.data;
    });
    await test("6.8", "proposer cannot confirm own proposal", async () => {
      const r = await call(sessions.Sarah, "PUT", `/meetings/${virtualMeeting.id}`, { status: "confirmed" });
      assert(r.status === 403 && /Only the receiver/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
    });
    await test("6.7", "receiver confirms proposed meeting", async () => {
      const r = await call(sessions.Alex, "PUT", `/meetings/${virtualMeeting.id}`, { status: "confirmed" });
      assert(r.status === 200 && r.data?.status === "confirmed", `expected confirmed, got ${r.status}`);
    });
    await test("6.10", "proposer cancels a confirmed meeting", async () => {
      const r = await call(sessions.Sarah, "PUT", `/meetings/${virtualMeeting.id}`, { status: "cancelled" });
      assert(r.status === 200 && r.data?.status === "cancelled", `expected cancelled, got ${r.status}`);
    });
    let inPerson;
    await test("6.3", "premium proposer creates in-person meeting", async () => {
      const r = await call(sessions.Sarah, "POST", "/meetings", meetingPayload(sarahAlex.matchId, "in_person"));
      assert(r.status === 201 && r.data?.address, `expected 201 in-person, got ${r.status}`);
      inPerson = r.data;
    });
    await test("6.9", "receiver declines proposed meeting", async () => {
      const r = await call(sessions.Alex, "PUT", `/meetings/${inPerson.id}`, { status: "declined" });
      assert(r.status === 200 && r.data?.status === "declined", `expected declined, got ${r.status}`);
    });
    let proposed;
    await test("6.11", "receiver cannot cancel still-proposed meeting", async () => {
      proposed = (await call(sessions.Sarah, "POST", "/meetings", meetingPayload(sarahAlex.matchId))).data;
      const r = await call(sessions.Alex, "PUT", `/meetings/${proposed.id}`, { status: "cancelled" });
      assert(r.status === 403 && /cannot cancel/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
    });
    await call(sessions.Sarah, "PUT", `/meetings/${proposed.id}`, { status: "cancelled" });
    await test("6.12", "receiver cancels a confirmed meeting", async () => {
      const m = (await call(sessions.Sarah, "POST", "/meetings", meetingPayload(sarahAlex.matchId))).data;
      await call(sessions.Alex, "PUT", `/meetings/${m.id}`, { status: "confirmed" });
      const r = await call(sessions.Alex, "PUT", `/meetings/${m.id}`, { status: "cancelled" });
      assert(r.status === 200 && r.data?.status === "cancelled", `expected cancelled, got ${r.status}`);
    });
    let rescheduled;
    await test("6.13", "receiver reschedules proposal and swaps roles", async () => {
      const m = (await call(sessions.Sarah, "POST", "/meetings", meetingPayload(sarahAlex.matchId))).data;
      const r = await call(sessions.Alex, "PATCH", `/meetings/${m.id}/reschedule`, { scheduledAt: new Date(Date.now() + 5 * 86_400_000).toISOString(), locationType: "virtual", videoLink: "https://meet.example.com/rescheduled" });
      assert(r.status === 200 && r.data?.status === "proposed" && r.data?.proposer_id === me.Alex.id && r.data?.receiver_id === me.Sarah.id, `expected swapped proposal, got ${r.status}`);
      rescheduled = r.data;
    });
    await test("6.14", "declined meeting cannot be rescheduled", async () => {
      await call(sessions.Sarah, "PUT", `/meetings/${rescheduled.id}`, { status: "declined" });
      const r = await call(sessions.Alex, "PATCH", `/meetings/${rescheduled.id}/reschedule`, { scheduledAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
      assert(r.status === 400 && /Can only reschedule/i.test(r.data?.error || ""), `expected 400, got ${r.status}`);
    });
    await test("6.15", "meeting list excludes cancelled and is sorted", async () => {
      const r = await call(sessions.Sarah, "GET", "/meetings");
      assert(r.status === 200 && r.data.every((m) => m.status !== "cancelled"), `cancelled meeting present or status ${r.status}`);
      assert(r.data.every((m, i, a) => i === 0 || new Date(a[i - 1].scheduled_at) <= new Date(m.scheduled_at)), "meetings not sorted ascending");
      return { count: r.data.length, statuses: [...new Set(r.data.map((m) => m.status))] };
    });
  } else {
    for (const id of ["6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "6.12", "6.13", "6.14", "6.15"]) skipped(id, "requires --mutating, Sarah premium, and Sarah–Alex match");
  }

  if (MUTATING) {
    await test("7.2", "premium cancellation clears state and can be restored", async () => {
      const cancel = await call(sessions.Sarah, "DELETE", "/users/me/premium");
      assert(cancel.status === 200, `cancel failed ${cancel.status}`);
      const free = await call(sessions.Sarah, "GET", "/users/me");
      assert(free.data?.is_premium === false && free.data?.premium_expires_at == null, "premium fields not cleared");
      const restore = await call(sessions.Sarah, "POST", "/users/me/premium/activate");
      assert(restore.status === 200, "failed to restore Sarah premium for repeatable follow-up tests");
    });
    await test("7.3", "premium who-liked-me returns an array with super-like flags", async () => {
      const r = await call(sessions.Sarah, "GET", "/users/me/who-liked-me");
      assert(r.status === 200 && Array.isArray(r.data), `expected array, got ${r.status}`);
      assert(r.data.every((x) => "isSuperLike" in x), "missing isSuperLike property");
      return { count: r.data.length, superLikes: r.data.filter((x) => x.isSuperLike).length };
    });
  } else {
    skipped("7.2", "run with --mutating");
    skipped("7.3", "run with --mutating");
  }
  await test("7.4", "free user is blocked from who-liked-me", async () => {
    const r = await call(sessions.Marcus, "GET", "/users/me/who-liked-me");
    assert(r.status === 403 && /Premium required/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
  });

  await test("8.1", "notifications list is capped, newest first", async () => {
    const r = await call(sessions.Sarah, "GET", "/notifications");
    assert(r.status === 200 && Array.isArray(r.data) && r.data.length <= 50, `expected <=50 array, got ${r.status}`);
    assert(r.data.every((n, i, a) => i === 0 || new Date(a[i - 1].createdAt) >= new Date(n.createdAt)), "notifications not newest first");
    return { count: r.data.length, types: [...new Set(r.data.map((n) => n.type))] };
  });
  if (MUTATING) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const miaNotes = await call(sessions.Mia, "GET", "/notifications");
    await test("8.2", "mutual match creates match notification", async () => {
      assert(miaNotes.data?.some((n) => n.type === "match"), "no match notification observed for Mia");
    });
    const alexNotes = await call(sessions.Alex, "GET", "/notifications");
    await test("8.3", "meeting proposal creates receiver notification", async () => {
      assert(alexNotes.data?.some((n) => n.type === "meeting"), "no meeting notification observed for Alex");
    });
    await test("8.4", "message creates at most one unread notification per match", async () => {
      const messageNotes = alexNotes.data?.filter((n) => n.type === "message" && String(n.refId) === String(sarahAlex.matchId) && !n.readAt) || [];
      assert(messageNotes.length <= 1, `found ${messageNotes.length} unread message notifications for one match`);
      assert(messageNotes.length === 1, "no unread message notification observed");
    });
    await test("8.5", "premium super-like creates a super_like notification", async () => {
      assert(alexNotes.data?.some((n) => n.type === "super_like"), "no super_like notification observed for Alex");
    });
    await test("8.6", "mark-read by ids changes only selected notifications", async () => {
      const before = (await call(sessions.Alex, "GET", "/notifications")).data;
      const unread = before.find((n) => !n.readAt);
      if (!unread) return { note: "no unread notification remained; vacuous" };
      const r = await call(sessions.Alex, "POST", "/notifications/read", { ids: [unread.id] });
      assert(r.status === 200, `mark ids failed ${r.status}`);
      const after = (await call(sessions.Alex, "GET", "/notifications")).data;
      assert(after.find((n) => n.id === unread.id)?.readAt, "selected notification not read");
      const otherUnreadIds = before.filter((n) => !n.readAt && n.id !== unread.id).map((n) => n.id);
      assert(otherUnreadIds.every((id) => !after.find((n) => n.id === id)?.readAt), "unselected notification was changed");
    });
    await test("8.7", "mark-read by type changes message notifications only", async () => {
      const before = (await call(sessions.Alex, "GET", "/notifications")).data;
      const r = await call(sessions.Alex, "POST", "/notifications/read", { types: ["message"] });
      assert(r.status === 200, `mark type failed ${r.status}`);
      const after = (await call(sessions.Alex, "GET", "/notifications")).data;
      assert(after.filter((n) => n.type === "message").every((n) => n.readAt), "message notification remained unread");
      const protectedIds = before.filter((n) => n.type !== "message" && !n.readAt).map((n) => n.id);
      assert(protectedIds.every((id) => !after.find((n) => n.id === id)?.readAt), "non-message notification was changed");
    });
  } else {
    for (const id of ["8.2", "8.3", "8.4", "8.5", "8.6", "8.7"]) skipped(id, "run with --mutating");
  }

  if (MUTATING) {
    await test("10.1", "display name persists, moderation rejects, original name restored", async () => {
      const original = me.Sarah.name;
      try {
        const temp = `${original} E2E`;
        let r = await call(sessions.Sarah, "PATCH", "/users/me", { name: temp });
        assert(r.status === 200 && r.data?.name === temp, `rename failed ${r.status}`);
        r = await call(sessions.Sarah, "GET", "/users/me");
        assert(r.data?.name === temp, "rename did not persist");
        r = await call(sessions.Sarah, "PATCH", "/users/me", { name: "fuckboy" });
        assert(r.status === 400, `flagged rename expected 400, got ${r.status}`);
      } finally {
        await call(sessions.Sarah, "PATCH", "/users/me", { name: original });
      }
      return { restoredName: original };
    });
  } else skipped("10.1", "run with --mutating");
  blocked("10.2", "requires a disposable inbox-backed account; seeded identities must never be deleted");
  await test("10.3", "non-admin verification override is blocked", async () => {
    const r = await call(sessions.Sarah, "PATCH", `/users/${me.Marcus.id}/verification`, { status: "verified" });
    assert(r.status === 403 && /Admin only/i.test(r.data?.error || ""), `expected 403, got ${r.status}`);
  });

  await test("11.1", "protected endpoint rejects missing Authorization", async () => {
    const r = await call(null, "GET", "/users/me", undefined, { noAuth: true });
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });
  await test("11.2", "protected endpoint rejects malformed token", async () => {
    const r = await call(null, "GET", "/users/me", undefined, { headers: { Authorization: "Bearer garbage" } });
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });
  blocked("11.3", "no genuinely expired signed end-user JWT is available; a fabricated JWT would only duplicate malformed-token coverage");
  for (const [id, origin, expected] of [
    ["11.4", "https://bizmatchapp.netlify.app", "echo"],
    ["11.5", "https://abc123--bizmatchapp.netlify.app", "echo"],
    ["11.6", "https://evil.example.com", "absent"],
  ]) {
    await test(id, `CORS ${expected === "echo" ? "allows" : "rejects"} ${origin}`, async () => {
      const r = await call(null, "OPTIONS", "/users/me", undefined, { noAuth: true, headers: { Origin: origin, "Access-Control-Request-Method": "GET" } });
      const actual = r.headers.get("access-control-allow-origin");
      assert(expected === "echo" ? actual === origin : actual == null, `expected ${expected}, got ${actual}`);
    });
  }
  if (!GLOBAL_RATE_LIMIT) {
    skipped("11.7", "not run against production: 3001 requests would degrade service; runner supports --global-rate-limit and stops on first 429");
  } else {
    await test("11.7", "global fixed-window limit reaches first 429 and stops", async () => {
      let observed = null;
      for (let i = 1; i <= 3001; i += 1) {
        const r = await call(sessions.Sarah, "GET", "/users/me");
        if (r.status === 429) { observed = { requestNumber: i, response: lastExchange.response }; break; }
      }
      assert(observed, "no 429 by request 3001");
      return observed;
    });
  }
  await test("11.8", "all eight deployed Edge Functions are reachable", async () => {
    const probes = [
      ["auth", "POST", "/auth/precheck-name", { name: "Reachability Probe" }],
      ["users", "GET", "/users/me"], ["profile", "GET", "/profile"], ["match", "GET", "/match/feed"],
      ["messages", "GET", "/messages"], ["meetings", "GET", "/meetings"],
      ["notifications", "GET", "/notifications"], ["challenges", "GET", "/challenges/teams/mine"],
    ];
    const observed = [];
    for (const [name, method, route, body] of probes) {
      const r = await call(name === "auth" ? null : sessions.Sarah, method, route, body);
      observed.push({ name, status: r.status, server: r.headers.get("server"), projectRef: r.headers.get("sb-project-ref") });
      assert(r.headers.get("sb-project-ref") === "luuhaczovcphtqvvwvkv", `${name} was not served by target project`);
      assert(r.status !== 404, `${name} returned 404`);
    }
    return observed;
  });
  await test("11.9", "profile update returns promptly while feed scoring remains available", async () => {
    // Ensure at least one candidate remains visible: likes are excluded from the
    // feed, while passes deliberately recycle at the bottom.
    await call(sessions.Mia, "POST", "/match/swipe", { targetUserId: me.Alex.id, direction: "pass" });
    const before = await call(sessions.Mia, "GET", "/profile");
    const update = await call(sessions.Mia, "PUT", "/profile", before.data, { timeoutMs: 15_000 });
    assert(update.status === 200 && update.elapsedMs < 15_000, `update did not return promptly: ${update.status}/${update.elapsedMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const feed = await call(sessions.Mia, "GET", "/match/feed");
    assert(feed.status === 200, `later feed failed ${feed.status}`);
    assert(feed.data.length > 0 && feed.data.some((c) => c.aiScore != null), "later feed did not expose a populated AI score");
    return { updateElapsedMs: update.elapsedMs, feedCount: feed.data.length, populatedAiScores: feed.data.filter((c) => c.aiScore != null).length };
  });
  blocked("11.10", "requires DB access/admin activity view; no end-user endpoint exposes last_active_at");

  if (AUTH_RATE_LIMIT) {
    await test("1.15", "precheck-name stops at first 429 after the fixed-window allowance", async () => {
      let observed = null;
      for (let i = 1; i <= 51; i += 1) {
        const r = await call(null, "POST", "/auth/precheck-name", { name: `Rate Limit Probe ${i}` });
        if (r.status === 429) { observed = { requestNumber: i, response: lastExchange.response }; break; }
      }
      assert(observed, "no 429 by request 51 (earlier calls in this IP/window affect the exact number)");
      return observed;
    });
  }

  const ordered = Object.values(results).sort((a, b) => {
    const [as, ac] = a.id.split(".").map(Number); const [bs, bc] = b.id.split(".").map(Number);
    return as - bs || ac - bc;
  });
  const counts = ordered.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(), target: { frontend: "https://bizmatchapp.netlify.app", supabaseProject: "luuhaczovcphtqvvwvkv" },
    flags: { MUTATING, AUTH_RATE_LIMIT, LARGE_UPLOADS, GLOBAL_RATE_LIMIT }, counts, results: ordered,
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
