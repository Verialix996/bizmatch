# BizMatch — Cleanup Plan (conservative, evidence-backed)

**Status:** ✅ **ALL TIERS COMPLETE** (2026-06-09). The tier descriptions below are the original plan — kept as a record. See "Already done" section for what was executed.

## Owner answers driving this plan
Web=**Netlify** · targets=**ALL** (Expo Go, Android/EAS, web) → be conservative about platform code ·
Railway deploys from **`main`** · LinkedIn OAuth **not live** · `/role-request` flow **remove** ·
AI compatibility + match summary **remove both** · `index.html` legacy/low-pri · `better-sqlite3` leftover ·
`frontend/dist/` already deleted · no hidden flows · env vars live in **Railway/Netlify dashboards**
(so never treat a `process.env.*` / `EXPO_PUBLIC_*` reference as unused).

## Already done — all tiers complete

### Tier A ✅
- ✅ **A1** Removed `better-sqlite3`, `nodemailer`, `qrcode` from `backend/package.json`.
- ✅ **A2** Removed dead imports: `colors` (Login/RegisterScreen), `WebBrowser` (ChatScreen), `FlatList`+`Alert` (MatchesScreen), `useEffect`+`FlatList` (ProposeMeetingScreen), `Animated`+`typography` (ProfileScreen), `Constants` (api.js).
- ✅ **A3** Removed unused vars: `setSelectedProject`/`openProjectPicker` (SwipeScreen), `coFounderName` (ProjectsScreen), unused `get` param (authStore).
- ✅ **A4** Updated `backend/env.example` (discrete vars → `DATABASE_URL`); fixed branch `main-Ai_integrated` → `main` in README + docs/CLAUDE.md.
- ✅ Added knip + eslint configs (`backend/`, `frontend/`) + devDeps.
- ✅ Deleted `frontend/dist/` locally (gitignored build artifact).
- ✅ Removed dead import `cloudinary` in `profile.controller.js`.
- ✅ Removed dead import `sendMessage` in `project.controller.js`.

### Tier B ✅
- ✅ **B1** Removed AI match-summary from SwipeScreen (compatibility 🔍 button, MatchModal aiSummary, matchSummaryBanner, CompatibilityModal + ~14 orphaned styles); removed `getCompatibility` from `match.service.js`; removed `generateMatchSummary` from `match.model.js`; updated `recordSwipe` return to `{matched,matchId}`; removed `ai_summary` from `getMatches` SELECT; removed `aiSummary` preview branch from `MatchesScreen`. Backend `/match/compatibility` endpoint **kept** (used by ProfileDetailScreen).
- ✅ **B2** Removed unfinished `/role-request` flow: `proposeRoleChange` + `respondToRoleChange` from `project.service.js`; import + render blocks from `ChatScreen.js`; import from `ProjectsScreen.js`.

### Tier C ✅
- ✅ **C1** LinkedIn OAuth removed (`passport-linkedin-oauth2` dep, `LinkedInStrategy` from `passport.js`, `/linkedin` + `/linkedin/callback` routes from `auth.routes.js`). `linkedin_url` profile field untouched.
- ℹ️ **C2** `react-native-web` kept (Netlify build). `expo-status-bar` + `expo-auth-session` left as-is (safe defaults from Expo template).
- ℹ️ **C3** Dual base-URL not refactored (separate concern).
- ℹ️ **C4** Redundant service wrappers kept intentionally.
- ℹ️ **C5** Root `index.html` left as-is (low priority).

---

## TIER A — Safe dead-code removals (provably unused, behavior-preserving)

### A1. Unused backend npm dependencies (grep-confirmed zero usage)
`backend/package.json`: remove **`better-sqlite3`**, **`nodemailer`**, **`qrcode`**.
- Evidence: `grep -rn "better-sqlite3|nodemailer|qrcode" backend --include=*.js` → none. App uses
  `mysql2` (not sqlite), `googleapis` for email (`email.service.js:1`), `speakeasy` for 2FA (returns
  `otpauth_url`, client renders QR).
- Verify: `cd backend && npm remove better-sqlite3 nodemailer qrcode && npm run dev` boots clean.
- Risk: none found.

### A2. Unused frontend imports (ESLint `no-unused-vars`, scoped to one file each = safe)
Remove the unused identifier from each import:
- `src/screens/auth/LoginScreen.js:12` — `colors`
- `src/screens/auth/RegisterScreen.js:11` — `colors`
- `src/screens/match/ChatScreen.js:11` — `WebBrowser` (unused *here*; WelcomeScreen still uses it — leave that)
- `src/screens/match/MatchesScreen.js:3` — `FlatList`; `:5` — `Alert`
- `src/screens/meeting/ProposeMeetingScreen.js:1` — `useEffect`; `:4` — `FlatList`
- `src/screens/profile/ProfileScreen.js:3` — `Animated`; `:11` — `typography`
- `src/services/api.js:3` — `Constants` (the `expo-constants` import is unused)
- Verify after edits: `cd frontend && npx eslint src/**/*.js` → these warnings gone, no new errors.

### A3. Unused frontend local vars (ESLint)
- `src/screens/match/SwipeScreen.js:390` — `setSelectedProject`, `openProjectPicker` assigned but unused.
  ⚠️ Coordinate with **B1** (SwipeScreen is edited there too) — do both in one pass.
- `src/screens/project/ProjectsScreen.js:622` — `coFounderName` unused.
- `src/store/authStore.js:4` — unused `get` param (cosmetic: prefix `_get` or drop).
- Verify: ESLint clean for these lines.

### A4. Stale docs (no code impact, prevents future confusion)
- `backend/env.example` — documents discrete `DB_HOST/DB_USER/...`; code reads a single `DATABASE_URL`
  (`backend/src/config/db.js:5`). Update the example to `DATABASE_URL`.
- `README` — deploy branch `main-Ai_integrated` is stale; Railway deploys `main`. Fix the doc.

**Tier A net:** 3 deps + ~11 dead imports/vars + 2 doc fixes. Zero behavior change.

---

## TIER B — Intentional feature removals (behavior changes you approved)

> These are NOT dead code — they are working features you chose to remove. Each is reversible via git.
> **DB note:** migrations are append-only/idempotent — do **not** drop the `matches.ai_summary` column;
> just stop reading/writing it.

### B1. Remove AI "Compatibility" button + AI "match summary" (Q6)
**Keep untouched:** the AI **feed ranking** (`match.model.js` `ensureAiScores` / `preScoreUser` /
`ai_match_scores`) — that's a separate system and stays.

**Frontend — `src/screens/match/SwipeScreen.js`:**
- Remove `getCompatibility` from the import (L16).
- Remove the Compatibility button in `ProfileCard` (~L145–147) and the `onCompatibility` prop plumbing
  (`ProfileCard` signature L57, the `onCompatibility={...}` at ~L713).
- Remove `handleCompatibility` (~L477) and the `CompatibilityModal` component (~L286) + its render (~L809).
- Remove match-summary UI: `aiSummary` usage in `MatchModal` (~L255 signature, ~L269 render); the
  `matchSummaryBanner` + `lastMatchSummary` state (L399, set at L505/L580, rendered ~L786); pass
  `aiSummary={null}`/drop the prop at the MatchModal call (~L797).
- Remove now-orphaned styles: `compatBtn`, `compatBtnText`, `modalAiSummary`, `matchSummaryBanner`,
  `matchSummaryText` (and CompatibilityModal-only styles).

**Frontend — others:**
- `src/services/match.service.js` — remove the `getCompatibility` wrapper.
- `src/screens/match/ProfileDetailScreen.js` — it also calls `/match/compatibility/...`; remove that
  call + the compatibility UI it renders. (Verify the screen still renders without it.)

**Backend:**
- `src/controllers/match.controller.js` — remove `compatibility` handler (L69–135) and its export (L151).
- `src/routes/match.routes.js` — remove the `compatibility` route + import.
- `src/models/match.model.js` — remove `generateMatchSummary` (L432–479); in `recordSwipe` (L407–429)
  stop calling it and stop returning `aiSummary` (return `{ matched, matchId }`). Leave `matches.ai_summary`
  column in place (unused).
- Keep `Anthropic` import only if still used by feed ranking (it is, via the model) — confirm before deleting.

**Verification:** swipe to a match → modal shows name only, no summary, no banner; no Compatibility button on
cards; `grep -rn "getCompatibility|aiSummary|generateMatchSummary|matchSummary" frontend/src backend/src`
returns nothing live; backend boots; `/api/match/swipe` still returns matches.
**Rollback:** `git checkout -- <files>`.

### B2. Remove the unfinished `/role-request` partner-role-change flow (Q5)
Backend never implemented `/role-request` — only the *direct* `updatePartnerRole`
(`PUT /:id/partners/:userId/role`) exists and **stays**. Remove the half-built frontend pieces:
- `src/services/project.service.js` — remove `proposeRoleChange` (L49) and `respondToRoleChange` (L50).
- `src/screens/project/ProjectsScreen.js` — remove `proposeRoleChange` from the import (L13) and any
  proposeRoleChange call/UI (verify whether it's wired to a button or just imported).
- `src/screens/match/ChatScreen.js` — remove `respondToRoleChange` import (L14), `handleRespondToRoleChange`
  (L303–315), and the `role_change_request` (~L583) and `role_change_response` (~L627) message-type render
  blocks.
- Backend: nothing to remove (endpoints never existed).
- ⚠️ Note: if any existing chat message has `message_type='role_change_request'/'response'`, removing the
  renderer means it falls through to the default message display — harmless, but worth knowing.
**Verification:** open a chat → no errors; partner direct role change (ProjectsScreen role dropdown) still
works; `grep -rn "role.?change|role-request" frontend/src` returns nothing live.
**Rollback:** `git checkout -- <files>`.

---

## TIER C — Verify-first / decisions / latent issues (do NOT act without confirmation)

### C1. LinkedIn OAuth login — confirm before removing
`linkedin_url` is a **profile field** (ProfileScreen L187, EditProfileScreen L455, profile.model L6) —
**do not touch**. Separately, the LinkedIn *OAuth login* (`passport-linkedin-oauth2` dep; strategy in
`passport.js:48`; routes `/linkedin` + `/linkedin/callback` in `auth.routes.js:84`) is gated on
`LINKEDIN_CLIENT_ID` and has no frontend entry point. It's inert without env, so removal is low-value and
low-risk-of-staying.
- **Confirm:** is `LINKEDIN_CLIENT_ID` set in the Railway dashboard? If **no**, the OAuth strategy/routes +
  `passport-linkedin-oauth2` dep can move to Tier A. If unsure, **leave it** — it's harmless.

### C2. Frontend deps flagged by knip — verify, don't auto-remove (all platforms matter)
- `react-native-web` — **KEEP.** Required for the Netlify web build (`expo export -p web`). False positive.
- `expo-status-bar` — code imports `StatusBar` from `react-native` everywhere, not this package
  (e.g. AccountSettings.js:3). Likely unused, but it's part of the default Expo template — confirm it's not
  referenced by Expo config before removing.
- `expo-auth-session` — WelcomeScreen uses `expo-web-browser` (`WebBrowser.openAuthSessionAsync`), not
  `expo-auth-session`. Possibly unused, but auth is sensitive and native paths matter — confirm before removing.

### C3. Two backend base-URL definitions (consistency, not removal)
`frontend/src/services/api.js:5` hardcodes the Railway URL, while `src/config/constants.js:7` derives
`API_BASE_URL` from `EXPO_PUBLIC_BACKEND_URL`. They can disagree. Decide on one source of truth (recommend
`constants.js` env-driven) — a refactor, not a deletion.

### C4. Redundant-but-harmless service wrappers (do NOT delete)
`activatePremium`, `uploadPhoto`, `googleSignIn`, `getProjectMatches`, `addPartner`, `GOOGLE_CLIENT_ID`
look "unused" to knip, but the **features work** via direct `api.*` calls in screens (and
`googleSignIn`/`GOOGLE_CLIENT_ID` are the native auth path). Leaving them is the safe choice; at most,
standardize screens onto the service layer later (a refactor).

### C5. Root `index.html` (legacy landing page) — low priority
1432-line standalone marketing page; `netlify.toml` publishes `frontend/dist`, not this. You said legacy/
low-priority — leave for now, revisit when updating marketing.

---

## Suggested execution order (if/when approved)
1. **Tier A** (deps + dead imports/vars + docs) — fully safe, do first; verify with `eslint`/`knip` + boot.
2. **Tier B** (AI features, then role-request) — one feature at a time; verify each flow live before the next.
3. **Tier C** — only after you answer C1/C2; C3–C5 are separate refactor decisions.

## How to verify the whole cleanup
- `cd backend && npx eslint . && npx knip && npm run dev` (boots, migrates, `/api/match/swipe` works).
- `cd frontend && npx eslint src/**/*.js && npx knip && npx expo start` — swipe→match, chat, projects,
  premium, photo upload, Google sign-in all still work on web AND a native/Expo Go run.
- `grep` sweeps listed per item to confirm no live references remain.
