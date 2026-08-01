# Deletion candidates

Files/directories moved here because they're no longer needed for the current
`mvp-lean` iteration (Netlify frontend + Supabase Edge Functions backend).
Nothing was deleted — this is a staging area for review before you decide to
actually remove them. Each item keeps its original relative path so it's
obvious where it came from and how to restore it if needed.

## backend/server.js + backend/src/

The entire legacy Express API — routes, controllers, models, middleware,
config, services. Fully superseded by `supabase/functions/` (8 Edge
Functions, one per route group), which were ported from this exact code and
are what's actually deployed now. Confirmed nothing else in the repo still
imports from `backend/src/` — the two scripts that used to (`seed.js`,
`setup-storage-buckets.js`) were made standalone (inline Supabase/pg clients)
before this move, specifically so this directory could be archived without
breaking them.

To restore: `git mv "deletion candidate/backend/server.js" backend/server.js`
and `git mv "deletion candidate/backend/src" backend/src`, then re-add
`express`, `cors`, `helmet`, `multer`, `winston`, `express-rate-limit`,
`express-validator` to `backend/package.json` if you'd trimmed them.

Note: `backend/package.json` still lists those Express-only dependencies
(unused now) alongside the ones the scripts actually need
(`@supabase/supabase-js`, `pg`, `dotenv`, `@google/generative-ai`). Left
as-is since trimming `package.json` wasn't part of this pass — worth doing
as a follow-up if this directory is permanently deleted.

## index.html (repo root)

An old standalone marketing landing page (git history: "uploaded landing
page"). Not part of the deployed app — Netlify's build (`netlify.toml`) uses
`base = "frontend"`, so this file is outside the build context entirely and
was never actually served. Its copy also references features explicitly
removed in the mvp-lean fork (NDA e-signature layer, AI due diligence, a
different "AI Due Diligence" framing than the current AI deck review) —
confirmed via a `/graphify` pass that flagged this as a stale-content
mismatch against `README.md`.

## docs/htmp+promt.zip, docs/מחקר מתחרים מידע ומשימות.html

Old research artifacts (a zip export and a Hebrew-language competitive
research HTML export) unrelated to the current codebase — not referenced
anywhere, not part of the reusable prompt docs that live in `docs/`
(`competitive-research-prompt.md`, `E2E_TEST_PLAN.md`, etc., which are
current and were left in place).
