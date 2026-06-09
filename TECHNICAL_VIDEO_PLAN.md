# BizMatch — Technical Video Plan (סרטון טכני)

A follow-along storyboard for a ~13–15 min **technical** walkthrough of the BizMatch codebase:
what each file does, how the key functions work, how the DB is built, and how code maps to the product.

- **Narration:** Hebrew, with English technical terms (controller, schema, JWT, migration…).
- **Style:** code-editor screen recording + voiceover; cut to diagrams for DB & request-flow.
- **Live demo account:** Sarah Chen · `sarah.chen@bizmatch.app` · `Demo1234!`
- **Live web app:** https://6a1d32758ef33b30b4c33702--strong-fenglisu-a83822.netlify.app
- **Not** the same as `docs/VIDEO_FLOWS.md` (that's a product demo) — this is the engineering tour.

> **Coverage note:** ~40 backend + ~30 frontend files. Core files get a function-by-function deep
> dive; supporting files get a one-line purpose and are name-checked on screen. That keeps it ~14 min.
> For true 100% coverage, split into a 2-part series.

---

## ✅ Before you record (checklist)
- [ ] **ER diagram** of the 14 tables (Excalidraw / draw.io) — centerpiece of Scene 3.
- [ ] **Architecture map** slide: Frontend (React Native/Expo) ↔ Backend (Node/Express) ↔ MySQL, with Cloudinary + Claude on the side. Reused in intro & outro.
- [ ] **Pipeline overlay** graphic: `CORS → auth → route → controller → model → query() → MySQL`.
- [ ] Code editor: clean theme, large font (readable at 1080p).
- [ ] App logged in as Sarah Chen, ready for the live swipe (Scene 7).
- [ ] (Optional) Open `graphify-out/graph.html` to show the real code graph (files as nodes + edges).
- [ ] **Decision:** 1 video (~14 min) or 2-part series (full coverage)?

---

## 🎬 Scene list (timing ~13–14 min)

| # | Scene | Files | ~Time |
|---|-------|-------|-------|
| 1 | Intro + architecture map | (diagram) | 0:45 |
| 2 | Repo tour / file inventory | file tree, `package.json` | 1:30 |
| 3 | **How the DB is built + schema** | `migrations/run.js`, `001…014_*.sql` | 2:30 |
| 4 | Boot + data layer | `server.js`, `config/db.js` | 1:00 |
| 5 | Request pipeline | `app.js`, `auth.middleware.js`, `match.routes.js` | 1:00 |
| 6 | **Matchmaking engine** | `match.controller.js`, `match.model.js` | 2:30 |
| 7 | Swipe UI + live app | `SwipeScreen.js` | 1:30 |
| 8 | Frontend infra | `api.js`, `authStore.js`, `AppNavigator.js` | 1:00 |
| 9 | AI features cluster | `project.controller.js`, `meeting.controller.js` | 1:15 |
| 10 | Security & moderation | `passport.js`, `moderation.service.js` | 0:45 |
| 11 | Deployment + wrap | `app.js` (CORS), `netlify.toml` | 0:45 |

---

## Scene 1 — Intro & architecture map (0:45)
**On screen:** title card → architecture diagram (3 tiers + Cloudinary + Claude).
**Say (HE):**
- ביזמאצ'​ הוא marketplace בסגנון swipe שמחבר entrepreneurs ל-investors.
- הארכיטקטורה היא three-tier: client ב-**React Native/Expo**, server ב-**Node.js/Express**, ו-**MySQL** כ-database.
- שירותים חיצוניים: **Cloudinary** לקבצים, **Anthropic Claude** ל-AI, ו-**Railway + Netlify** ל-hosting.

## Scene 2 — Repo tour & file inventory (1:30)
**On screen:** scroll the file tree; open `backend/package.json` + `frontend/package.json`.
**Say (HE):**
- ה-monorepo מחולק ל-`backend` ו-`frontend`.
- Backend stack: Express, mysql2, JWT + Passport, bcryptjs, Helmet, `@anthropic-ai/sdk`.
- Frontend stack: Expo (React Native 0.81), **Zustand** ל-state, Axios, React Navigation.

**File-by-file inventory (read the one-liners; ★ = deep dive later):**

*Backend — entry & config*
- `backend/server.js` ★ — entry point: migrations → DB test → start Express.
- `backend/src/app.js` ★ — Express app: Helmet, CORS, body parsing, mounts routes, error handler.
- `backend/src/config/db.js` ★ — MySQL pool + the `query()` helper every model uses.
- `backend/src/config/cloudinary.js` — Cloudinary config for photo/CV/deck/video uploads.
- `backend/src/config/passport.js` ★ — Passport strategies: JWT, Google OAuth.
- `backend/migrations/run.js` ★ — migration runner: applies `*.sql` in order, idempotently.
- `backend/migrations/001…014_*.sql` ★ — one CREATE TABLE per file; the schema source of truth.
- `backend/scripts/seed.js` — wipes + reseeds 5 investors + 5 entrepreneurs + matches + chats.
- `backend/scripts/check-schema.js` — asserts the live DB matches expected tables/columns.

*Backend — middleware*
- `auth.middleware.js` ★ — `authenticate()` JWT guard + `requireVerified()`.
- `rateLimiter.js` — express-rate-limit for auth + API. `upload.js` — Multer + Cloudinary. `errorHandler.js` — error → JSON.

*Backend — routes* (thin: URL → controller fn): `auth`, `user`, `profile`, `match`, `message`, `project`, `meeting`, `notification` (`backend/src/routes/*.routes.js`).

*Backend — controllers* (validate → call model → respond)
- `auth.controller.js` — register, login, OTP, password reset, OAuth, 2FA.
- `user.controller.js` — profile CRUD, premium, push-token. `profile.controller.js` — profile setup, triggers `preScoreUser`.
- `match.controller.js` ★ — `feed`, `swipe`, `matches`, `compatibility`, `getNdaStatus`.
- `message.controller.js` — chat, NDA (PDFKit), share project, job offers.
- `project.controller.js` ★ — project CRUD, swipe/match, deck/video upload, `reviewDeck` (AI).
- `meeting.controller.js` ★ — propose/confirm/cancel, `briefing` (AI). `notification.controller.js` — list/mark-read + `emitNotification`.

*Backend — models* (SQL + logic): `user.model.js`, `match.model.js` ★ (matchmaking engine), `message.model.js`, `project.model.js`, `profile.model.js`, `meeting.model.js`.

*Backend — services*: `email.service.js` (Gmail OTP/reset), `notification.service.js` (Expo push), `moderation.service.js` ★ (`moderateText()` word-list gate).

*Frontend — shell & infra*
- `frontend/App.js` — root: restore auth, notifications, deep links, render navigator.
- `AppNavigator.js` ★ — auth stack vs 4-tab main; deep links. `authStore.js` ★ — Zustand token+user, SecureStore.
- `appStore.js` ★ — Zustand investorMode/darkMode/theme. `api.js` ★ — Axios + interceptors.
- `services/{auth,match,project}.service.js` — endpoint wrappers. `config/constants.js` — API URLs. `theme.js` — design tokens.

*Frontend — screens*: `auth/*`, `match/SwipeScreen.js` ★, `match/{Matches,Chat,ProfileDetail}Screen.js`, `project/*`, `profile/*`, `meeting/*`, `premium/*`, `onboarding/*`.

---

## Scene 3 — How the DB is built + schema (2:30) ⭐ core
**On screen:** open `backend/migrations/run.js`, then `001_create_users.sql`, then your **ER diagram**.

**`runMigrations()` — how the DB is built (HE):**
- ה-DB נבנה דקלרטיבית מקובצי `.sql` ממוספרים (`001…014`).
- השלבים: (1) `CREATE DATABASE IF NOT EXISTS` (נכשל בעדינות על Railway המנוהל); (2) יוצר טבלת ledger
  `schema_migrations(filename, run_at)`; (3) קורא את כל ה-`.sql` ממויינים, ולכל קובץ **שעוד לא רץ** —
  מריץ אותו בתוך **transaction**, רושם את שם הקובץ, ו-commit; (4) שגיאות "כבר קיים" (errno 1050/1060/1061/1091)
  נחשבות כ-applied במקום להפיל את ה-build.
- המשמעות: כל migration רץ **פעם אחת בלבד**, וההרצה **idempotent** — אפשר להריץ שוב בלי נזק.

**The schema — walk the ER diagram (HE):** הכל מקושר ב-foreign keys ל-`users.id` (ה-hub). שני **match loops**:
- **Identity — `users`:** role enum (entrepreneur/investor); investor: domain/preferred_stage/max_investment;
  entrepreneur: bio/skills/cv_url; security: login_attempts/locked_until/two_factor_secret; premium:
  is_premium/premium_expires_at; throttle: swipe_count/swipe_count_date.
- **People loop:** `swipes` → `matches` → `messages`; `ai_match_scores` (0–100 ב-cache). (`matches.ai_summary` עמודה קיימת ב-schema אך לא בשימוש.)
- **Project loop:** `projects` (deck_url/video_url/stage/funding_needed) → `project_swipes` → `project_matches`;
  `ai_project_scores`; `project_partners`, `project_ndas`, `partner_invitations` (equity_pct/salary).
- **Coordination:** `meetings` (`ai_briefing`), `notifications` (type enum + JSON payload).

## Scene 4 — Boot + data layer (1:00)
**On screen:** `server.js`, then `config/db.js`.
**`server.js → start()` (HE):** `await runMigrations()` → `await testConnection()` → `app.listen(PORT)`.
השרת לא עולה לפני שה-schema מעודכן וה-DB מגיב.
**`config/db.js` (HE):**
- `pool = createPool({ connectionLimit: 10, timezone:'+00:00', ssl in prod })`.
- `query(sql, params)`: ממיר `undefined`→`null`, מריץ `pool.execute` (**prepared statement**), מחזיר rows.
- כל קריאת DB באפליקציה עוברת דרך ה-`query()` היחיד הזה — pooled ו-parameterized, אין SQL injection.
  (בגרף הידע זה ה-node הכי מחובר, 82 edges.)

## Scene 5 — Request pipeline (1:00)
**On screen:** `app.js` → `auth.middleware.js` → `match.routes.js`.
**Say (HE):** כל endpoint עובר אותו pipeline:
- `app.js`: CORS (מתיר Netlify + `FRONTEND_URL` ב-prod), מרכיב את כל ה-`/api/*` routers, ומסיים ב-`errorHandler`.
- `authenticate()`: שולף `Bearer` token → מאמת JWT → טוען `req.user` (+ מעדכן `last_active_at`). `requireVerified()` חוסם email לא מאומת.
- `match.routes.js`: `router.post('/swipe', authenticate, swipe)` — ה-route דק; ה-guard וה-handler נקשרים פה.

## Scene 6 — Matchmaking engine (2:30) ⭐ core
**On screen:** `match.controller.js`, then walk `match.model.js` top-down.

**`match.controller.js` (function by function, HE):**
- `feed(req,res)`: קורא `mode` (investors/partners) + `projectId`, קורא ל-`getFeed`, מחזיר cards.
- `swipe(req,res)`: validation + חסימת self-swipe; בודק **premium + daily limit** ב-query אחד עם
  `IF(swipe_count_date=CURDATE(),…)`; free מעל `DAILY_SWIPE_LIMIT=20` → `429 {upgradeRequired:true}`;
  אחרת מגדיל את המונה; super-like רק ל-premium; קורא ל-`recordSwipe`.
- `matches`: מחזיר `getMatches`. `compatibility`: טוען שני profiles → prompt JSON-only → Claude Haiku (`max_tokens:250`) → `{score,pros,cons}`.
- `getNdaStatus`: בודק חתימת NDA ב-`project_ndas`.

**`match.model.js` — the engine (HE):**
- **Scoring helpers טהורים:** `stageScore` (מרחק על stage-ladder → 40/20/5/0), `budgetScore`
  (יחס maxInvestment/fundingNeeds → 30/20/10/0), `jaccardScore` (חפיפת tokens), `completenessBonus` (עד 10).
- `scoreInvestorEntrepreneur(inv,ent,aiScore)`: **כשיש AI score הוא דומיננטי (60 נק')** + stage(20) + budget(10);
  **fallback בלי AI** = stage(40)+budget(30)+Jaccard(30); תמיד +completeness(10).
- `buildPersonPrompt(...)`: ה-prompt "Rate 0-100, reply ONLY a number".
- `ensureAiScores(...)`: עד 10 candidates לא-cached → Claude (`max_tokens:5`) ב-`Promise.allSettled` → `INSERT IGNORE ai_match_scores` (cache).
- `preScoreUser(userId)`: fire-and-forget בשמירת profile — מחשב מראש את כל ה-candidates ב-batches של 10, כדי שה-feed יהיה "חם".
- `getFeed(...)`: מסנן liked+self; מושך candidates של ה-role הנגדי; מריץ `ensureAiScores` עם **timeout של 5 שניות**;
  טוען AI scores מה-cache ב-query אחד; מחשב score לפי זוג ה-roles; ממיין **fresh ואז passed**; חותך ל-limit.
- `recordSwipe(...)`: upsert ל-swipe; אם `like` ו-**הדדי** (או שה-investor כבר עשה like ל-project שלי) → `INSERT IGNORE matches`
  (+`project_matches`); שולח push + `emitNotification`; מחזיר `{matched, matchId}`.
- `getMatches(userId)`: JOIN אחד שמחזיר את ה-user *השני* בכל match (CASE על user1/user2).
- **Takeaway:** הדפוס הוא **AI כ-primary signal עם math fallback**, scores ב-cache, ו-timeouts כדי שה-UX יישאר מהיר גם אם Claude איטי.

## Scene 7 — Swipe UI + live app (1:30)
**On screen:** two-pane — `SwipeScreen.js` + the live app. Do a real swipe-right on camera.
**Say (HE):**
- `ProfileCard()`/`ProjectCard()` מציירים card; `MatchModal()` הוא ה-popup של "It's a Match!".
- `PanResponder` → בשחרור מעבר ל-threshold: `doCardFly()` animation → `sendSwipe()` → `match.service.swipe()` → `POST /match/swipe`.
- אם `matched:true` → `MatchModal` עם שם + תמונה; אחרת מתקדם ל-card הבא; `429` → upgrade alert.
- זה הצד השני של Scene 6 — שורת ה-SQL ב-`recordSwipe` הופכת ל-UI moment.

## Scene 8 — Frontend infra (1:00)
**On screen:** `api.js`, `authStore.js`, `AppNavigator.js`.
**Say (HE):**
- `api.js`: `axios.create({baseURL})`; **request interceptor** מזריק `Bearer ${token}` מ-`useAuthStore`; **response interceptor** עושה `logout()` על `401`.
- `authStore.js`: Zustand — `setAuth/logout`, מאחסן token ב-Expo **SecureStore**, `restoreAuth` בעליית האפליקציה.
- `AppNavigator.js`: מחליף בין auth-stack ל-main 4-tab; deep link `bizmatch://auth?token=` ל-OAuth.
- State ב-**Zustand** (לא Redux), שני stores. כל request מקבל JWT אוטומטית; 401 → logout אוטומטי.

## Scene 9 — AI features cluster (1:15)
**On screen:** `project.controller.js::reviewDeck`, `meeting.controller.js::briefing`.
**Say (HE):**
- `reviewDeck()`: מושך את ה-PDF → base64 → שולח כ-**`document` block** ל-Claude → `{score 1-10, strengths, weaknesses, suggestions}`.
- `briefing()`: בונה prompt מהאדם השני + ה-projects שלו → due-diligence ב-5 חלקים → **cache ב-`meetings.ai_briefing`**, Premium-only + daily cap.
- בסה"כ שלושה שימושי AI על Claude Haiku: feed ranking, deck review, due-diligence briefing — כולם נשמרים ב-DB כדי לא לקרוא ל-API פעמיים.
- (compatibility score זמין גם ב-`ProfileDetailScreen` דרך endpoint `/match/compatibility/:id`.)

## Scene 10 — Security & moderation (0:45)
**On screen:** `passport.js`, `auth.middleware.js`, `moderation.service.js`.
**Say (HE):**
- Multi-method auth: password (bcrypt, 12 rounds), **Google OAuth**, **2FA (TOTP)**.
- JWT (HS256, 7-day) נבדק ב-`authenticate()` בכל protected route; brute-force ע"י `login_attempts`/`locked_until`.
- `moderateText()`: word-list check על bios/messages/projects **לפני** שמירה.

## Scene 11 — Deployment + wrap (0:45)
**On screen:** `netlify.toml`, `app.js` CORS block, (optional) Railway/Netlify dashboards.
**Say (HE):**
- Backend על **Railway** (`node server.js`, auto-deploy מ-branch `main`); MySQL מנוהל על Railway.
- Frontend על **Netlify** (`expo export -p web`) + Expo למובייל; קבצים על **Cloudinary**.
- Migrations רצות אוטומטית ב-startup. Secrets ב-env: `ANTHROPIC_API_KEY`, `JWT_SECRET`, `CLOUDINARY_*`, `DATABASE_URL`, `FRONTEND_URL`.
- **סיכום:** client ב-React Native, server עם pipeline נקי route→controller→model→`query()`, MySQL עם 14 tables סביב שני match loops, ו-Claude לאורך כל ה-flow. כל שורת קוד מתחברת ל-product moment.

---

## 🔎 Accuracy check (run before recording)
These were read & verified against the script: `server.js`, `config/db.js`, `migrations/run.js`,
`match.controller.js`, `match.model.js`, `frontend/src/services/api.js`. Re-skim the rest you'll show:
```bash
rg -n "reviewDeck" backend/src/controllers/project.controller.js
rg -n "briefing"   backend/src/controllers/meeting.controller.js
rg -n "moderateText" backend/src/services/moderation.service.js
```
Run locally and perform the Scene-7 swipe→match live (modal shows name + photo, no AI summary):
```bash
cd backend && npm run dev      # http://localhost:3000
cd frontend && npx expo start  # http://localhost:8081
```
