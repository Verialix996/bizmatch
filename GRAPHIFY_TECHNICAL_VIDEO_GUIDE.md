# BizMatch Technical Video Guide

Use this as the recording map for a technical walkthrough. It is based on the actual code structure, your diagrams, and the SmartPark reference video format.

## Starting Point

Visual assets you already have:

- Architecture map: `/home/verialix/Downloads/ERD-ARCHICATURE MAP.jpg`
- ERD: `/home/verialix/Downloads/ERD-ERD.jpg`
- Request pipeline overlay: `/home/verialix/Downloads/ERD-Pipeline overlay.jpg`

Key findings to show on screen:

- The project is a three-tier system: Expo app, Express API, MySQL database.
- The backend is organized around route -> controller -> model -> `query()` -> MySQL.
- The product has two main match loops: people matching and project matching.
- AI appears in three important places: feed ranking, pitch-deck review, and meeting briefing.
- The frontend is organized around screens, services, Zustand stores, and React Navigation.
- The connection from `SwipeScreen.js` to `recordSwipe()` is not an import; it crosses HTTP through Axios, so explain it as an API contract.

Recommended first shot:

1. Open the architecture map.
2. Briefly explain the client, backend, database, and external services.
3. Say: "The video will move from diagrams, to the running app, to the code that powers each flow."

## One-Sentence Architecture

BizMatch is a React Native/Expo client backed by a Node/Express API, a MySQL schema managed by migrations, Cloudinary for uploaded files, and Claude Haiku for ranking, pitch-deck review, and due-diligence briefing.

## YouTube Reference: SmartPark Format

Reference video: `https://www.youtube.com/watch?v=g2xZLYBeH1w`

What I checked:

- Title: `SmartPark`
- Length: 16:23
- Published: 2018-01-11
- No subtitles/captions were available, so the reference is based on video structure and sampled frames.

The reference video is not just a code walkthrough. It uses this sequence:

1. Title slide with project name and authors.
2. Technology/context slide.
3. System/data diagram.
4. Live web-app demo.
5. Admin/data view.
6. IDE/code walkthrough.
7. Physical/live behavior demo.
8. Final app result screen.

Use the same style for BizMatch:

1. Title slide: BizMatch, names, course/context/date.
2. Architecture map: show `/home/verialix/Downloads/ERD-ARCHICATURE MAP.jpg`.
3. ERD/schema: show `/home/verialix/Downloads/ERD-ERD.jpg`.
4. Product demo: login, swipe, match/chat/projects.
5. Request pipeline: show `/home/verialix/Downloads/ERD-Pipeline overlay.jpg`.
6. Code walkthrough: open the must-show backend and frontend files below.
7. AI features demo/explanation: feed ranking, deck review, meeting briefing.
8. Deployment/wrap: Railway, Netlify, Cloudinary, and architecture summary.

SmartPark spends a lot of time alternating between the app and code. For BizMatch, use the same rhythm:

- Show the feature in the app.
- Jump to the frontend screen/service that triggers it.
- Jump to the backend route/controller/model that handles it.
- Return to the app or diagram to explain the result.

Recommended BizMatch pacing if you want to match the reference length:

| Time | Segment | What to show |
|---|---|---|
| 0:00-0:45 | Title and project purpose | Title slide + one-sentence architecture |
| 0:45-2:00 | System architecture | Architecture map + package.json stack |
| 2:00-3:20 | Database | ERD at a high level, not every column |
| 3:20-5:00 | Live app overview | Login, tabs, swipe screen, projects, chat |
| 5:00-6:15 | Request pipeline | Pipeline overlay + `app.js` + auth middleware |
| 6:15-9:00 | Matchmaking deep dive | `SwipeScreen.js`, `match.service.js`, `match.controller.js`, `match.model.js` |
| 9:00-11:00 | Projects and AI deck review | `ProjectsScreen.js`, project controller/model |
| 11:00-12:30 | Messaging/NDA/meetings | chat screen, message controller, meeting briefing |
| 12:30-14:00 | Frontend state/navigation | App, navigator, stores, Axios client |
| 14:00-15:15 | Security/deployment | Passport, moderation, Netlify/Railway/Cloudinary |
| 15:15-16:20 | Wrap | Architecture recap: frontend, backend, database, AI, deployment |

## Recording Structure

Target length: 12-15 minutes.

## Files You Need On Screen

This is enough to cover the important architecture without opening every file. Keep the rest as verbal mentions.

### Must Show

- `/home/verialix/Downloads/ERD-ARCHICATURE MAP.jpg` - top-level architecture: Expo, Express, MySQL, Claude, Cloudinary, OAuth/Gmail, Expo Push, Nominatim.
- `/home/verialix/Downloads/ERD-ERD.jpg` - database schema and the two match loops.
- `/home/verialix/Downloads/ERD-Pipeline overlay.jpg` - request path from client to backend to database.
- `backend/package.json` and `frontend/package.json` - tech stack proof.
- `backend/server.js` - startup order.
- `backend/migrations/run.js` - how the database is created and migrated.
- `backend/src/app.js` - Express middleware and route mounting.
- `backend/src/config/db.js` - `query()` and pool, the central backend data helper.
- `backend/src/middleware/auth.middleware.js` - JWT guard and `req.user`.
- `backend/src/config/passport.js` - JWT, Google OAuth, and auth strategy setup.
- `backend/src/controllers/match.controller.js` - feed/swipe API behavior.
- `backend/src/models/match.model.js` - scoring, AI cache, feed ranking, `recordSwipe()`.
- `backend/src/controllers/project.controller.js` - project CRUD, file proxy, deck AI review.
- `backend/src/models/project.model.js` - project feed/swipe/match/AI score logic.
- `backend/src/controllers/message.controller.js` - chat, structured messages, NDA flow.
- `backend/src/controllers/meeting.controller.js` - proposal flow and AI briefing.
- `backend/src/services/moderation.service.js` - local content moderation shared by write paths.
- `backend/src/services/notification.service.js` - push notification integration.
- `frontend/App.js` - root app startup.
- `frontend/src/navigation/AppNavigator.js` - auth/onboarding/main-tab routing.
- `frontend/src/services/api.js` - Axios base URL, JWT injection, 401 logout.
- `frontend/src/store/authStore.js` and `frontend/src/store/appStore.js` - Zustand state.
- `frontend/src/screens/match/SwipeScreen.js` - swipe UI and API trigger.
- `frontend/src/services/match.service.js` - frontend API wrapper for feed/swipe.
- `frontend/src/screens/project/ProjectsScreen.js` and `frontend/src/services/project.service.js` - project UI and deck review trigger.
- `frontend/src/screens/match/ChatScreen.js` - chat UI and structured message cards.
- `frontend/src/screens/meeting/MeetingDetailScreen.js` - AI briefing UI.
- `netlify.toml` and `README.md` - deployment and run instructions.

### Mention, But Do Not Open Unless Asked

- `backend/src/routes/*.routes.js` - all routes are thin URL-to-controller bindings; show only `match.routes.js` if you need one example.
- `backend/src/models/user.model.js`, `profile.model.js`, `message.model.js`, `meeting.model.js` - supporting SQL access; mention that models own database details.
- `backend/src/controllers/auth.controller.js`, `profile.controller.js`, `user.controller.js`, `notification.controller.js` - important product support, but not central to the main architecture video.
- `backend/src/config/cloudinary.js` and `backend/src/middleware/upload.js` - mention when explaining file upload, open only if you want to prove storage setup.
- `backend/src/services/email.service.js` - mention under OTP/password reset.
- Auth screens, profile screens, premium screen, onboarding screen, notification components, and theme files - show only in the live app, not in code.
- Individual migration files beyond the ERD - open only 2-3 examples (`users`, `swipes`, `projects`, `ai_match_scores`) and explain the rest from the ERD.

### Coverage Check

If you show the must-show list, you cover every important project area:

- Backend boot: `server.js`, `run.js`, `app.js`, `db.js`
- Data model: ERD plus representative migrations
- Request pipeline: pipeline overlay, auth middleware, route/controller/model
- Matchmaking: match controller/model, swipe screen, match service
- Projects: project controller/model, projects screen/service
- Messaging/NDA: message controller/model, chat screen
- Meetings/AI briefing: meeting controller/model, meeting detail screen
- Auth/security: Passport, JWT middleware, rate limiter, moderation
- Frontend shell: App, navigator, stores, Axios API client
- Deployment: README, Netlify config, Railway API URL, CORS

## How To Present The Database

Do not present the database as 14 separate tables. Present it as a story around user actions.

### DB Story In 90 Seconds

Use this order on the ERD:

1. Start with `users` in the center.

Say:

> Everything starts from `users`. A user can be an entrepreneur or an investor. This table is intentionally the identity hub: login data, profile fields, role, premium state, and activity state are all connected to the same `user_id`.

2. Explain the people matching loop.

Point to:

- `swipes`
- `matches`
- `messages`
- `ai_match_scores`

Say:

> The first loop is person-to-person matching. A user swipes on another user, that creates a row in `swipes`. If both sides like each other, the backend creates a row in `matches`. After that, the match can have chat messages. AI ranking is cached separately in `ai_match_scores`, so the feed does not need to call Claude every time.

3. Explain the project matching loop.

Point to:

- `projects`
- `project_swipes`
- `project_matches`
- `ai_project_scores`

Say:

> The second loop is investor-to-project matching. Entrepreneurs create projects, investors swipe on project cards, and mutual interest becomes `project_matches`. This is separate from regular profile matching because a project has its own stage, funding need, deck, video, and AI score.

4. Explain collaboration tables.

Point to:

- `project_partners`
- `partner_invitations`
- `project_ndas`

Say:

> After a match, the system supports collaboration. Entrepreneurs can invite partners, investors can sign NDAs, and project access can become more structured. These tables are not the first thing the user sees, but they support the business workflow after matching.

5. Explain coordination tables.

Point to:

- `meetings`
- `notifications`

Say:

> Finally, meetings and notifications coordinate the relationship. Meetings include status, time, location, and the cached AI briefing. Notifications store alerts like new matches, messages, and super-likes.

### DB Flow Example

Use one concrete example instead of listing every table:

> If Sarah the investor swipes right on Alex's project, the app creates `project_swipes`. If Alex already liked Sarah, the backend can create `matches` and `project_matches`. Then they can chat through `messages`, sign an NDA through `project_ndas`, schedule a meeting in `meetings`, and receive alerts through `notifications`.

### How To Handle The Large `users` Table

Say this directly:

> The original design had one wide `users` table. I normalized it into focused one-to-one tables: `users` for identity, `user_auth_security` for password/OTP/OAuth/2FA, `user_profiles` for shared profile data, `investor_profiles` for investor matching preferences, `entrepreneur_profiles` for entrepreneur-specific expansion, and `user_app_state` for premium, push token, onboarding, activity, and swipe limits.

This is enough. Do not read all `users` columns.

### 1. Repo Map

Show:

- `/home/verialix/Downloads/ERD-ARCHICATURE MAP.jpg`
- `frontend/package.json`
- `backend/package.json`

Explain:

- `frontend/` is the Expo app: screens, navigation, Zustand stores, Axios services.
- `backend/` is the API: Express routes, controllers, models, migrations, services.
- Do not walk files alphabetically. Use the product flows as the outline: auth, swipe/match, projects, chat, meetings, AI, deployment.

### 2. Backend Boot Path

Show:

- `backend/server.js`
- `backend/migrations/run.js`
- `backend/src/app.js`
- `backend/src/config/db.js`

Explain:

- `server.js` starts in strict order: `runMigrations()`, `testConnection()`, then `app.listen()`.
- `runMigrations()` reads numbered SQL files, checks `schema_migrations`, runs new files in a transaction, and records them.
- `app.js` wires Helmet, CORS, JSON parsing, Passport, rate limiting, request logging, routers, health check, 404, and error handling.
- `db.js` owns the MySQL pool and the shared `query(sql, params)` helper.

Narration line:

> The central backend helper is `query()`, because every serious backend feature eventually becomes parameterized SQL through the same MySQL pool.

### 3. Database Model

Show:

- `/home/verialix/Downloads/ERD-ERD.jpg`
- `backend/migrations/001_create_users.sql`
- `backend/migrations/002_create_swipes.sql`
- `backend/migrations/003_create_matches.sql`
- `backend/migrations/005_create_projects.sql`
- `backend/migrations/011_create_meetings.sql`
- `backend/migrations/012_create_ai_match_scores.sql`
- `backend/migrations/014_create_ai_project_scores.sql`

Timebox this section to 1:15-1:45. The ERD is too large for a table-by-table or column-by-column walkthrough in a 15-16 minute video.

Explain the schema as four groups:

- Identity: `users`
- People matching: `swipes`, `matches`, `messages`, `ai_match_scores`
- Project matching: `projects`, `project_swipes`, `project_matches`, `project_partners`, `project_ndas`, `partner_invitations`, `ai_project_scores`
- Coordination: `meetings`, `notifications`

Only call out these columns:

- `users.id` - central foreign-key target.
- `users.role` - entrepreneur vs investor.
- `swipes.swiper_id`, `swipes.swiped_id`, `swipes.direction` - people swipe loop.
- `matches.user1_id`, `matches.user2_id` - mutual match result.
- `projects.user_id`, `projects.stage`, `projects.funding_needed`, `projects.deck_url` - project card and AI/deck features.
- `project_swipes.investor_id`, `project_swipes.project_id`, `project_swipes.direction` - project swipe loop.
- `meetings.match_id`, `meetings.status`, `meetings.ai_briefing` - coordination and AI meeting prep.
- `ai_match_scores.score`, `ai_project_scores.score` - cached AI ranking.

Do not read the full `users` table on camera. Say that it contains auth, profile, premium, activity, and onboarding fields, then move on.

Narration line:

> There are two matching loops: person-to-person matching and investor-to-project matching. Both start with swipes, both cache AI scores, and both turn mutual interest into a durable match row.

### 4. Request Pipeline

Show:

- `/home/verialix/Downloads/ERD-Pipeline overlay.jpg`
- `backend/src/app.js`
- `backend/src/middleware/auth.middleware.js`
- `backend/src/routes/match.routes.js`
- `backend/src/controllers/match.controller.js`

Explain:

- Express mounts `/api/*` route modules.
- Protected routes use `authenticate()`, which validates JWT through Passport and sets `req.user`.
- `authenticate()` also updates `last_active_at`, debounced to once per minute per user.
- Route files stay thin: they connect URL plus middleware plus controller function.

Narration line:

> A normal protected request moves through CORS, rate limit, route, JWT auth, controller validation, model logic, `query()`, and MySQL.

### 5. Matchmaking Engine

Show:

- `backend/src/controllers/match.controller.js`
- `backend/src/models/match.model.js`
- `frontend/src/screens/match/SwipeScreen.js`
- `frontend/src/services/match.service.js`

Explain:

- `feed()` reads `mode` and optional `projectId`, then calls `getFeed()`.
- `swipe()` validates input, blocks self-swipe, enforces the free daily swipe limit, gates super-like behind premium, then calls `recordSwipe()`.
- `getFeed()` excludes liked users, recycles passed users later, loads candidates, tries to ensure AI scores with a 5-second timeout, then sorts cards by score.
- `recordSwipe()` upserts the swipe, checks for mutual like or matching project interest, creates `matches`, optionally creates `project_matches`, and emits notifications.

Scoring explanation:

- With AI score: AI contributes up to 60 points, then stage, budget, and completeness add secondary signal.
- Without AI score: math fallback uses stage, budget, Jaccard overlap, hobbies/skills, and completeness.
- AI scores are cached in `ai_match_scores`.

Narration line:

> This is the key engineering pattern in BizMatch: AI is the primary signal when available, but deterministic math keeps the feed working when the AI call is slow or missing.

### 6. Frontend Shell

Show:

- `frontend/App.js`
- `frontend/src/navigation/AppNavigator.js`
- `frontend/src/store/authStore.js`
- `frontend/src/store/appStore.js`
- `frontend/src/services/api.js`

Explain:

- `App.js` restores auth and renders navigation.
- `AppNavigator.js` chooses auth stack, profile setup, onboarding, or the main tab app.
- `MainTabs()` exposes Discover, Matches, Projects, and Profile.
- `authStore.js` stores token/user in Zustand and persists them with SecureStore.
- `api.js` injects `Authorization: Bearer <token>` on every request and logs the user out on `401`.

- `useAuthStore` is worth showing because navigation, API calls, onboarding, badges, and logout all depend on it.

### 7. Project System And Deck AI

Show:

- `backend/src/controllers/project.controller.js`
- `backend/src/models/project.model.js`
- `frontend/src/screens/project/ProjectsScreen.js`
- `frontend/src/services/project.service.js`

Explain:

- Entrepreneurs create projects with title, description, industry, stage, funding, visibility, pitch deck, and video.
- Investors swipe project cards separately from person cards.
- Project scores are cached in `ai_project_scores`.
- `reviewDeck()` fetches the uploaded PDF from Cloudinary, sends it to Claude as a document block, and expects JSON with strengths, weaknesses, suggestions, and `overallScore`.

Narration line:

> Project matching is not just profile matching with another UI. It has its own tables, swipe loop, AI score cache, media upload flow, and NDA path.

### 8. Messaging, NDA, Meetings

Show:

- `backend/src/controllers/message.controller.js`
- `backend/src/models/message.model.js`
- `backend/src/controllers/meeting.controller.js`
- `backend/src/models/meeting.model.js`
- `frontend/src/screens/match/ChatScreen.js`
- `frontend/src/screens/meeting/MeetingDetailScreen.js`

Explain:

- Chat is built around mutual matches.
- Messages can carry structured payloads: partner invites, NDA requests, project sharing, meeting proposals.
- NDA signing generates a PDF and stores it through Cloudinary.
- `briefing()` checks meeting membership, returns cached `ai_briefing` if present, otherwise prompts Claude with the other person and their active projects, then saves JSON into the meeting.

Narration line:

> Messaging is the collaboration layer. Once the match exists, the app moves into structured actions: NDA, project sharing, meetings, and AI preparation.

### 9. Security And Moderation

Show:

- `backend/src/config/passport.js`
- `backend/src/middleware/auth.middleware.js`
- `backend/src/services/moderation.service.js`
- `backend/src/middleware/rateLimiter.js`

Explain:

- Auth supports password login, JWT, Google OAuth, OTP verification, and TOTP 2FA.
- Passwords are hashed with bcrypt.
- `authenticate()` protects routes and attaches `req.user`.
- `moderateText()` is a local word-list gate used by auth, user, profile, project, and message flows before saving user text.
- Rate limiting applies to `/api`.

- `moderateText()` is worth showing because it is reused across many write paths.

### 10. Deployment

Show:

- `README.md`
- `netlify.toml`
- `backend/src/app.js` CORS section
- `frontend/src/services/api.js`

Explain:

- Backend runs on Railway.
- Frontend web export runs on Netlify; Expo also supports mobile/dev-build testing.
- API base URL currently points to the Railway backend.
- CORS allows the production Netlify domain and configured `FRONTEND_URL`.
- Cloudinary holds profile photos, pitch decks, demo videos, and NDA PDFs.

## Best Demo Flow

Use this sequence while screen recording:

1. Open the architecture map and ERD.
2. Show the repo split: `backend/` and `frontend/`.
3. Walk boot: `server.js` to migrations to `app.js` to `query()`.
4. Show the schema as two loops: people match and project match.
5. Demo the app: login, swipe, match/chat, projects.
6. Walk `SwipeScreen.js` to `match.service.js`, then explain the HTTP boundary to `match.routes.js`.
7. Deep-dive `match.controller.js` and `match.model.js`.
8. Show project deck review and meeting briefing as the AI features cluster.
9. Close with security, moderation, and deployment.

## Short Closing Script

> BizMatch is organized around a few central flows, not just many screens. The backend funnels through `query()` and MySQL. The product has two matching loops: people and projects. Claude is used as an enhancer for ranking, pitch-deck review, and meeting prep, but the app still has deterministic fallbacks and cached scores. On the frontend, Zustand stores and React Navigation decide what the user sees, while Axios carries the JWT into the backend pipeline.

## Internal Analysis Note

Graphify was used only to understand the code and decide what matters. Do not show Graphify in the final video unless someone specifically asks how the codebase was analyzed.

Commands used:

```bash
graphify install --platform codex
graphify explain "query()" --graph graphify-out/graph.json
graphify explain "getFeed()" --graph graphify-out/graph.json
graphify explain "recordSwipe()" --graph graphify-out/graph.json
graphify explain "reviewDeck()" --graph graphify-out/graph.json
graphify explain "briefing()" --graph graphify-out/graph.json
graphify explain "moderateText()" --graph graphify-out/graph.json
graphify path "SwipeScreen()" "recordSwipe()" --graph graphify-out/graph.json
```
