#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifacts = path.join(here, "artifacts", "browser");
const webdriver = process.env.WEBDRIVER_URL || "http://127.0.0.1:4444";
const appUrl = "https://bizmatchapp.netlify.app";
const password = "Demo1234!";
const chatOnly = process.argv.includes("--chat-only");
const results = {};
let sessionId;
let lastObservation;

function record(id, status, summary, evidence) {
  results[id] = { id, status, summary, ...(evidence ? { evidence } : {}) };
  console.log(`${id.padEnd(5)} ${status.padEnd(7)} ${summary}`);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function blocked(id, reason) { record(id, "BLOCKED", reason); }

async function http(endpoint, method = "GET", body) {
  const response = await fetch(`${webdriver}${endpoint}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || json.value?.error) throw new Error(json.value?.message || `WebDriver ${response.status}`);
  return json.value;
}

async function script(source, args = []) {
  return http(`/session/${sessionId}/execute/sync`, "POST", { script: source, args });
}

async function observe() {
  lastObservation = await script(`return {
    title: document.title,
    url: location.href,
    text: document.body?.innerText || "",
    inputs: Array.from(document.querySelectorAll("input,textarea")).map((e, i) => ({
      i, type: e.type, placeholder: e.placeholder, accept: e.accept, value: e.type === "password" ? "<redacted>" : e.value
    }))
  }`);
  return lastObservation;
}

async function waitFor(predicate, timeoutMs = 45_000) {
  const started = Date.now();
  let observed;
  while (Date.now() - started < timeoutMs) {
    observed = await observe();
    if (predicate(observed)) return observed;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`timed out; last page was ${JSON.stringify(observed)}`);
}

async function navigate(url = appUrl) {
  await http(`/session/${sessionId}/url`, "POST", { url });
  return waitFor((o) => o.text.length > 0);
}

async function clickText(text, occurrence = "last") {
  const clicked = await script(`
    const wanted = arguments[0], occurrence = arguments[1];
    const matches = Array.from(document.querySelectorAll("*")).filter(e => e.textContent.trim() === wanted);
    const pressable = matches.find(e => e.getAttribute("role") === "button");
    const target = pressable || (occurrence === "first" ? matches[0] : matches[matches.length - 1]);
    if (!target) return { clicked: false, count: matches.length };
    let clickable = target;
    while (clickable.parentElement && clickable !== document.body) {
      const role = clickable.getAttribute("role");
      if (role === "button" || clickable.tabIndex >= 0 || clickable.onclick) break;
      clickable = clickable.parentElement;
    }
    // React Native Web attaches press handling above the leaf Text node. A
    // native element.click() on the leaf reliably bubbles through that chain;
    // synthesizing only on the guessed ancestor can miss Pressability state.
    target.click();
    return { clicked: true, count: matches.length, tag: clickable.tagName, role: clickable.getAttribute("role") };
  `, [text, occurrence]);
  assert(clicked.clicked, `text control not found: ${text}`);
  return clicked;
}

async function setInput(index, value) {
  const ok = await script(`
    const e = document.querySelectorAll("input,textarea")[arguments[0]];
    if (!e) return false;
    const proto = e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(e, arguments[1]);
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  `, [index, value]);
  assert(ok, `input ${index} not found`);
}

async function screenshot(name) {
  const encoded = await http(`/session/${sessionId}/screenshot`);
  const filename = path.join(artifacts, `${name}.png`);
  await fs.writeFile(filename, Buffer.from(encoded, "base64"));
  return filename;
}

async function test(id, summary, fn) {
  try {
    const evidence = await fn();
    record(id, "PASS", summary, evidence || lastObservation);
  } catch (error) {
    record(id, "FAIL", `${summary}: ${error.message}`, lastObservation);
  }
}

async function sendAlexPollingProbe() {
  const require = createRequire(import.meta.url);
  const dotenv = require("dotenv");
  dotenv.config({ path: path.resolve(here, "../../.env") });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  assert(url && key, "public Supabase env vars unavailable");
  const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email: "alex.rivera@bizmatch.app", password }) });
  const session = await auth.json();
  assert(auth.ok && session.access_token, `Alex API login failed ${auth.status}`);
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}` };
  const conversations = await fetch(`${url}/functions/v1/messages`, { headers });
  const items = await conversations.json();
  const sarah = items.find((item) => /Sarah Chen/i.test(item.name));
  assert(sarah?.matchId, "Alex–Sarah conversation unavailable");
  const body = `Polling probe ${Date.now()}`;
  const sent = await fetch(`${url}/functions/v1/messages/${sarah.matchId}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
  assert(sent.status === 201, `polling probe send failed ${sent.status}`);
  return body;
}

async function freshWelcome() {
  await script("localStorage.clear(); sessionStorage.clear(); return true");
  await navigate(appUrl);
  return waitFor((o) => /CREATE ACCOUNT/.test(o.text));
}

async function login(email) {
  await freshWelcome();
  await clickText("SIGN IN");
  await waitFor((o) => /Welcome back to BizMatch/.test(o.text));
  await setInput(0, email);
  await setInput(1, password);
  await clickText("SIGN IN");
  return waitFor((o) => /\/Main\//.test(o.url) || /\/Onboarding/.test(o.url), 75_000);
}

async function main() {
  await fs.mkdir(artifacts, { recursive: true });
  const session = await http("/session", "POST", {
    capabilities: { alwaysMatch: { browserName: "firefox", "moz:firefoxOptions": { args: ["-headless"] } } },
  });
  sessionId = session.sessionId;
  if (chatOnly) {
    try {
      await navigate(appUrl);
      let o = await login("sarah.chen@bizmatch.app");
      if (/\/Onboarding/.test(o.url)) { await clickText("Skip"); await waitFor((x) => /\/Main\/Discover/.test(x.url)); }
      await test("5.1", "Messages UI renders Sarah–Alex conversation card", async () => {
        await clickText("Messages");
        const page = await waitFor((x) => /ALL CONVERSATIONS/.test(x.text) && /Alex Rivera/.test(x.text), 75_000);
        return { text: page.text };
      });
      await test("5.2", "Chat UI renders seeded/new message history", async () => {
        await clickText("Alex Rivera");
        const page = await waitFor((x) => /\/Chat/.test(x.url) && /Project Shared|Meeting (Proposed|Confirmed|Declined|Cancelled)|E2E message/.test(x.text), 75_000);
        return { text: page.text, screenshot: await screenshot("chat-history") };
      });
      await test("5.7", "premium Sarah chat visibly renders read receipts", async () => {
        const page = await observe();
        assert(/✓✓|✓/.test(page.text), "no read-receipt glyph rendered in chat");
        return { receiptTextObserved: /✓✓/.test(page.text) ? "double" : "single", screenshot: await screenshot("chat-read-receipts") };
      });
      await test("5.11", "open chat polls and renders a message sent from Alex's second session", async () => {
        const body = await sendAlexPollingProbe();
        const started = Date.now();
        const page = await waitFor((x) => x.text.includes(body), 10_000);
        return { body, observedAfterMs: Date.now() - started, text: page.text };
      });
    } finally {
      if (sessionId) await http(`/session/${sessionId}`, "DELETE").catch(() => {});
    }
    const ordered = Object.values(results);
    const counts = ordered.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
    const output = path.join(here, "artifacts", "browser-chat-rerun.json");
    await fs.writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), webdriver, counts, results: ordered }, null, 2));
    console.log(`Wrote ${output}`);
    console.log(counts);
    if (counts.FAIL) process.exitCode = 1;
    return;
  }
  try {
    await test("UI.0", "live web app renders Welcome screen", async () => {
      const o = await navigate(appUrl);
      assert(/CREATE ACCOUNT/.test(o.text) && /CONTINUE WITH GOOGLE/.test(o.text), "welcome actions missing");
      return { title: o.title, url: o.url, screenshot: await screenshot("welcome") };
    });

    blocked("1.1", "registration form rendered, but completing signup requires a disposable inbox and OTP");
    await test("1.3", "registration form enforces weak-password rule in UI", async () => {
      await freshWelcome(); await clickText("CREATE ACCOUNT");
      let o = await waitFor((x) => /Join the BizMatch network/.test(x.text));
      assert(o.inputs.length === 3, `expected 3 registration inputs, found ${o.inputs.length}`);
      await setInput(0, "Weak Password E2E"); await setInput(1, `weak-${Date.now()}@example.com`); await setInput(2, "a1");
      await clickText("CREATE ACCOUNT");
      o = await waitFor((x) => /Password must be at least 8 characters/.test(x.text));
      return { errorTextObserved: "Password must be at least 8 characters", screenshot: await screenshot("register-weak-password") };
    });
    await test("1.4", "registration UI surfaces name moderation rejection", async () => {
      await freshWelcome(); await clickText("CREATE ACCOUNT"); await waitFor((o) => /Join the BizMatch network/.test(o.text));
      await setInput(0, "fuckboy"); await setInput(1, `moderation-${Date.now()}@example.com`); await setInput(2, "Valid1234!");
      await clickText("CREATE ACCOUNT");
      const o = await waitFor((x) => /flagged by moderation/i.test(x.text), 60_000);
      return { text: o.text, screenshot: await screenshot("register-moderation") };
    });
    await test("1.5", "registration UI blocks blank name", async () => {
      await freshWelcome(); await clickText("CREATE ACCOUNT"); await waitFor((o) => /Join the BizMatch network/.test(o.text));
      await setInput(1, `blank-${Date.now()}@example.com`); await setInput(2, "Valid1234!");
      await clickText("CREATE ACCOUNT");
      const o = await waitFor((x) => /This field is required/.test(x.text));
      return { errorTextObserved: "This field is required" };
    });
    blocked("1.6", "requires inbox OTP"); blocked("1.7", "requires unverified signup state"); blocked("1.8", "requires inbox access");
    blocked("1.12", "requires password-reset inbox link");
    await test("1.13", "Google OAuth control initiates provider redirect", async () => {
      await freshWelcome(); await clickText("G   CONTINUE WITH GOOGLE");
      const o = await waitFor((x) => /accounts\.google\.com|supabase\.co\/auth\/v1\/authorize/.test(x.url), 60_000);
      assert(/accounts\.google\.com|supabase\.co/.test(o.url), `unexpected OAuth URL ${o.url}`);
      return { redirectHost: new URL(o.url).host, completion: "BLOCKED: no interactive Google identity" };
    });

    await test("9.1", "first-time seeded Marcus session shows four-slide walkthrough", async () => {
      let o = await login("marcus.webb@bizmatch.app");
      if (!/\/Onboarding/.test(o.url)) throw new Error("Marcus had already seen onboarding before this pass");
      const slides = [];
      for (let i = 0; i < 4; i += 1) {
        o = await observe(); slides.push(o.text);
        if (i < 3) { await clickText("Next"); await waitFor((x) => x.text !== o.text); }
      }
      assert(slides.length === 4 && new Set(slides).size === 4, "did not observe four distinct slides");
      return { slideHeadings: slides.map((t) => t.split("\n").filter(Boolean).slice(1, 3).join(" / ")), screenshot: await screenshot("onboarding-slide-4") };
    });
    await test("9.2", "Skip dismisses onboarding and persists the seen flag", async () => {
      await login("mia.johnson@bizmatch.app");
      const before = await observe();
      if (!/\/Onboarding/.test(before.url)) throw new Error("Mia had already seen onboarding before this pass");
      await clickText("Skip");
      const after = await waitFor((o) => /\/Main\/Discover/.test(o.url));
      return { destination: after.url };
    });
    await test("9.3", "onboarding is not shown after logout-like storage reset and fresh login", async () => {
      const o = await login("mia.johnson@bizmatch.app");
      assert(/\/Main\/Discover/.test(o.url), `onboarding reappeared at ${o.url}`);
      return { destination: o.url };
    });

    await test("1.9", "Sarah logs in through the live UI", async () => {
      const o = await login("sarah.chen@bizmatch.app");
      if (/\/Onboarding/.test(o.url)) { await clickText("Skip"); await waitFor((x) => /\/Main\/Discover/.test(x.url)); }
      const loaded = await waitFor((x) => /LIKE\nPASS/.test(x.text) || /All caught up/.test(x.text), 75_000);
      return { destination: loaded.url, screenshot: await screenshot("discover") };
    });
    await test("1.14", "session survives a full page reload", async () => {
      await http(`/session/${sessionId}/refresh`, "POST", {});
      // Auth restoration briefly renders the previous Main route before
      // AppNavigator applies the persisted onboarding gate. Let it settle.
      await new Promise((resolve) => setTimeout(resolve, 4000));
      let o = await waitFor((x) => (/\/Main\//.test(x.url) || /\/Onboarding/.test(x.url)) && !/Welcome back/.test(x.text), 75_000);
      const restoredDestination = o.url;
      if (/\/Onboarding/.test(o.url)) {
        await clickText("Skip");
        o = await waitFor((x) => /\/Main\/Discover/.test(x.url));
      }
      return { restoredDestination, continuedTo: o.url, note: restoredDestination.includes("Onboarding") ? "session restored, but onboarding persistence failed separately in 9.3" : null };
    });
    await test("3.1", "investor Discover deck visibly renders entrepreneur card data", async () => {
      const o = await waitFor((x) => /ENTREPRENEUR/.test(x.text) && /LIKE\nPASS/.test(x.text), 75_000);
      assert(!/INVESTOR ·/.test(o.text), "investor candidate label appeared");
      return { text: o.text, screenshot: await screenshot("swipe-deck") };
    });
    await test("5.1", "Messages UI renders Sarah–Alex conversation card", async () => {
      await clickText("Messages");
      const o = await waitFor((x) => /ALL CONVERSATIONS/.test(x.text) && /Alex Rivera/.test(x.text), 75_000);
      return { text: o.text, screenshot: await screenshot("messages-list") };
    });
    await test("5.2", "Chat UI renders seeded/new message history", async () => {
      await clickText("Alex Rivera");
      const o = await waitFor((x) => /Type a message/.test(x.text) && (/Project details shared|E2E message|Hi Sarah|Hi Alex/.test(x.text)), 20_000);
      return { text: o.text, screenshot: await screenshot("chat-history") };
    });
    await test("5.7", "premium Sarah chat visibly renders read receipt controls", async () => {
      const o = await observe();
      assert(/✓✓|✓/.test(o.text), "no read-receipt glyph rendered in chat");
      return { receiptTextObserved: /✓✓/.test(o.text) ? "double" : "single", screenshot: await screenshot("chat-read-receipts") };
    });
    blocked("5.11", "two concurrent authenticated browser sessions were not available in this single-session runner");

    await test("4.UI", "Projects screen visibly renders project controls/cards", async () => {
      let o = await login("alex.rivera@bizmatch.app");
      if (/\/Onboarding/.test(o.url)) { await clickText("Skip"); await waitFor((x) => /\/Main\/Discover/.test(x.url)); }
      await clickText("Projects");
      o = await waitFor((x) => /TeamSync/.test(x.text) && /Upload PDF|Replace PDF/.test(x.text) && /Upload Video|Replace Video/.test(x.text), 75_000);
      return { text: o.text, screenshot: await screenshot("projects") };
    });
    let sarahAgain = await login("sarah.chen@bizmatch.app");
    if (/\/Onboarding/.test(sarahAgain.url)) { await clickText("Skip"); await waitFor((x) => /\/Main\/Discover/.test(x.url)); }
    await clickText("Messages");
    await test("6.15", "Meetings tab visibly renders meeting cards/statuses", async () => {
      await waitFor((x) => /ALL CONVERSATIONS/.test(x.text), 75_000);
      await clickText("📅 Meetings");
      const o = await waitFor((x) => /E2E virtual meeting|E2E in_person meeting|No meetings/i.test(x.text), 75_000);
      return { text: o.text, screenshot: await screenshot("meetings") };
    });

    let alexAgain = await login("alex.rivera@bizmatch.app");
    if (/\/Onboarding/.test(alexAgain.url)) { await clickText("Skip"); await waitFor((x) => /\/Main\/Discover/.test(x.url)); }
    await clickText("Profile");
    await test("2.6", "Profile screen visibly renders completeness percentage/progress", async () => {
      const o = await waitFor((x) => /Profile Strength|Complete your profile/i.test(x.text), 75_000);
      assert(/%|complete/i.test(o.text), "no completeness percentage or label found");
      return { text: o.text, screenshot: await screenshot("profile") };
    });
    await test("2.UI-pickers", "profile UI exposes photo and CV picker controls", async () => {
      let o = await waitFor((x) => /Edit Profile|Create Profile/.test(x.text), 75_000);
      const editText = /Edit Profile/.test(o.text) ? "Edit Profile" : "Create Profile";
      await clickText(editText);
      o = await waitFor((x) => /CV\s*\/\s*RESUME/i.test(x.text) && /Add Photo|Change Photo/i.test(x.text), 75_000);
      assert(/Photo/i.test(o.text) && /CV|Resume/i.test(o.text), "photo/CV labels not both visible");
      const cvControl = /✓ CV Uploaded — tap to replace/.test(o.text) ? "✓ CV Uploaded — tap to replace" : "📄 Upload PDF";
      await clickText(cvControl);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const controls = await script(`return Array.from(document.querySelectorAll("input[type=file]")).map(e => ({accept:e.accept, multiple:e.multiple}))`);
      assert(controls.some((c) => /pdf/i.test(c.accept)), "CV control did not open a PDF file input");
      return { labels: o.text, fileInputsPresent: controls };
    });

    await test("1.16", "logout clears session and returns to Welcome", async () => {
      let o = await login("alex.rivera@bizmatch.app");
      if (/\/Onboarding/.test(o.url)) { await clickText("Skip"); await waitFor((x) => /\/Main\/Discover/.test(x.url)); }
      await clickText("Profile");
      o = await waitFor((x) => /Log Out|LOG OUT|Logout/.test(x.text), 75_000);
      const logoutText = /LOG OUT/.test(o.text) ? "LOG OUT" : /Log Out/.test(o.text) ? "Log Out" : "Logout";
      await clickText(logoutText);
      o = await waitFor((x) => /CREATE ACCOUNT/.test(x.text), 75_000);
      return { destination: o.url, screenshot: await screenshot("logout") };
    });
  } finally {
    if (sessionId) await http(`/session/${sessionId}`, "DELETE").catch(() => {});
  }

  const ordered = Object.values(results);
  const counts = ordered.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  const output = path.join(here, "artifacts", "browser-results.json");
  await fs.writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), webdriver, counts, results: ordered }, null, 2));
  console.log(`Wrote ${output}`);
  console.log(counts);
  if (counts.FAIL) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 2; });
