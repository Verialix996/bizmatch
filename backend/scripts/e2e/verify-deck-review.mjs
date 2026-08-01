#!/usr/bin/env node

// Targeted rerun for case 4.12 after a full pass. It reuses the disposable
// project id captured in api-results.json and uploads a real multi-page deck.

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

function deckPdf() {
  const slides = [
    ["TeamSync", "Async collaboration for distributed startup teams", "Seed round pitch | August 2026"],
    ["Problem", "Remote startup teams lose 12 hours per employee each month to status meetings", "Work is fragmented across chat, tasks, and documents", "Managers lack a reliable view of blockers and ownership"],
    ["Solution", "Async standups, decision logs, and accountable tasks in one workspace", "Automated summaries keep every timezone aligned", "A single workspace replaces three disconnected tools"],
    ["Market", "TAM: $18B global collaboration market", "SAM: $4.2B for teams of 10 to 500 employees", "SOM: $210M focused on venture-backed remote startups"],
    ["Business Model", "$18 per active user per month SaaS subscription", "Enterprise security and analytics plan", "82 percent gross margin with annual contracts"],
    ["Traction", "14,200 weekly active users at 180 companies", "$640K ARR growing 18 percent month over month", "124 percent net revenue retention"],
    ["Team and Financials", "CEO: repeat founder with one prior exit", "CTO: former collaboration-platform engineering lead", "Forecast: $0.9M, $2.8M, and $7.4M ARR over three years"],
    ["Funding Ask", "Raising $2.5M for 18 months runway", "45 percent product, 35 percent go-to-market, 20 percent operations", "Milestones: $3M ARR, 600 customers, SOC 2"],
  ];
  const esc = (s) => s.replace(/[()\\]/g, (c) => `\\${c}`);
  const fontId = 3 + slides.length * 2;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${slides.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${slides.length} >>`];
  slides.forEach(([heading, ...lines], i) => {
    const pageId = 3 + i * 2; const contentId = pageId + 1;
    const commands = ["BT", "/F1 26 Tf", "50 740 Td", `(${esc(heading)}) Tj`, "/F1 13 Tf", ...lines.flatMap((line) => ["0 -42 Td", `(${esc(line)}) Tj`]), "ET"].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

const prior = JSON.parse(await fs.readFile(path.join(here, "artifacts", "api-results.json"), "utf8"));
const failed = prior.results.find((r) => r.id === "4.12");
const projectId = failed?.evidence?.request?.url?.match(/projects\/(\d+)\/deck-review/)?.[1];
if (!projectId) throw new Error("Could not recover disposable project id from case 4.12 evidence");

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email: "mia.johnson@bizmatch.app", password: "Demo1234!" }) });
const session = await auth.json();
if (!auth.ok || !session.access_token) throw new Error(`Mia login failed: ${auth.status}`);
const headers = { apikey: key, Authorization: `Bearer ${session.access_token}` };
const form = new FormData();
form.append("deck", new Blob([deckPdf()], { type: "application/pdf" }), "teamsync-e2e-deck.pdf");
const upload = await fetch(`${url}/functions/v1/projects/${projectId}/upload-deck`, { method: "POST", headers, body: form });
const uploadBody = await upload.json();
if (!upload.ok) throw new Error(`Deck upload failed: ${upload.status} ${JSON.stringify(uploadBody)}`);
const review = await fetch(`${url}/functions/v1/projects/${projectId}/deck-review`, { method: "POST", headers });
const reviewBody = await review.json();
const passed = review.ok && Number.isFinite(reviewBody.overallScore) && reviewBody.overallScore >= 2 && reviewBody.overallScore <= 10 && Array.isArray(reviewBody.strengths) && Array.isArray(reviewBody.weaknesses) && Array.isArray(reviewBody.suggestions);
const result = { generatedAt: new Date().toISOString(), case: "4.12", projectId, uploadStatus: upload.status, reviewStatus: review.status, response: reviewBody, status: passed ? "PASS" : "FAIL" };
await fs.writeFile(path.join(here, "artifacts", "deck-review-rerun.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;
