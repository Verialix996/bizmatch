#!/usr/bin/env node

// Targeted rerun for case 11.9 without repeating the full stateful suite.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require("dotenv").config({ path: path.resolve(here, "../../.env") });
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Missing public Supabase variables in backend/.env");

async function login(email) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Demo1234!" }) });
  const body = await r.json();
  if (!r.ok) throw new Error(`Login failed: ${r.status}`);
  return body.access_token;
}
async function call(token, method, route, body) {
  const started = performance.now();
  const r = await fetch(`${url}/functions/v1${route}`, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await r.json();
  return { status: r.status, data, elapsedMs: Math.round(performance.now() - started) };
}

const [mia, alex] = await Promise.all([login("mia.johnson@bizmatch.app"), login("alex.rivera@bizmatch.app")]);
const alexMe = await call(alex, "GET", "/users/me");
await call(mia, "POST", "/match/swipe", { targetUserId: alexMe.data.id, direction: "pass" });
const profile = await call(mia, "GET", "/profile");
const update = await call(mia, "PUT", "/profile", profile.data);
await new Promise((resolve) => setTimeout(resolve, 2000));
const feed = await call(mia, "GET", "/match/feed");
const passed = update.status === 200 && update.elapsedMs < 15_000 && feed.status === 200 && feed.data.length > 0 && feed.data.some((c) => c.aiScore != null);
const result = { generatedAt: new Date().toISOString(), case: "11.9", status: passed ? "PASS" : "FAIL", updateStatus: update.status, updateElapsedMs: update.elapsedMs, feedStatus: feed.status, feed: feed.data.map((c) => ({ userId: c.userId, score: c.score, aiScore: c.aiScore })) };
await fs.writeFile(path.join(here, "artifacts", "background-scoring-rerun.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;
