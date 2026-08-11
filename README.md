# BizMatch — Founder Accelerator

A co-founder matching and program-management platform for startup accelerators:
admins track founders through a cohort, capture evidence about them (interviews,
evaluations, peer feedback), and get AI-free, evidence-backed compatibility
scoring to form founding teams.

**This is the `founder-profile-pivot` branch** — a full pivot away from the
original BizMatch dating-style swipe app (still on `supabase-full`) to an
accelerator-program tool. There is no swipe deck, no chat, no meetings, no
premium tier, and no AI calls anywhere — matching runs on a deterministic
evidence-weighted scoring model over structured data (interview answers,
evaluator scores, peer ratings), not an LLM.

**Backend:** [Supabase Edge Functions](https://supabase.com/docs/guides/functions) (Deno) — one function per route group, deployed via `supabase functions deploy`
**Frontend:** Expo (React Native + react-native-web) — deployed to Netlify (web) or run locally
**Database / Auth / Storage:** [Supabase](https://supabase.com)
**Email:** [Resend](https://resend.com), via a Supabase Auth "Send Email" hook (`supabase/functions/send-email/`) — replaces Supabase's low default mailer rate for OTP/reset emails

There is no AI dependency in this build — no Gemini, no API key to configure for core functionality.

---

## Personas

- **Admin** — full console: dashboard, founder roster, evaluations, activities,
  matching, teams. Left sidebar (desktop) / bottom tab bar (mobile) navigation
  via a shared `AppShell` component.
- **Founder** — read-only view of their own profile plus their activities;
  narrower nav (Home, Activities). New founders land in a one-time onboarding
  wizard before reaching their profile.

Role is set at the `users` table level; every Edge Function enforces
admin-or-self access per route (see `_shared/auth.ts`'s `requireAdmin` /
`requireAdminOrSelf` helpers).

---

## Features

### Founder Profiles
- Basic info: role/background, industry, location, commitment (full-time/part-time), venture name
- **Provides / Needs capability bars** — self-reported skill scores (Sales, Engineering, Product, etc.)
- **Partner requirements** — role wanted, must-provide skills, commitment/ambition required, preferred traits, stated deal breakers
- **Founder DNA radar chart** — 8-dimension evidence-derived scores (execution, integrity, commitment, communication, conflict, resilience, ego/learning, values), rendered with `react-native-svg`
- **Evidence confidence** — per-dimension score + confidence level (high/medium/low) + evidence count; missing dimensions show `—`, never a fabricated 0
- **Behavioral signals** — strengths/weaknesses derived from the same dimension scores
- Full evidence timeline (every interview answer, evaluator score, and peer rating that fed into the profile, with source attribution)
- Team membership status and link to the founder's team
- Admin actions: change status (active/inactive/dropped), add evaluation, find matches

### Evaluations & Evidence
- Structured interview form: open questions, 1–5 scales, yes/no — each scored
  answer tagged to an evidence dimension and fanned out into the founder's
  evidence trail (`assessments` + `evidence` functions)
- **Peer feedback** — founders rate co-participants on a specific dimension
  after a shared activity; folds into the same evidence/scoring pipeline
- Every score is source-weighted (self-report vs. peer vs. evaluator vs.
  interview carry different weight) — see `_shared/founderScoring.ts`

### Activities
- Interviews, workshops, pitches, team challenges, work trials
- Participant + evaluator management, status lifecycle (upcoming → active → completed)
- Filterable list (All/Upcoming/Active/Completed), scopable by program, team, or founder

### Matching
- **Suggested Matches** — cohort-wide ranked list of founder pairs by
  compatibility score, with "why they match" / "potential friction" explanation
  pulled from the same evidence used everywhere else (no separate narrative
  generation)
- Scopable to a single founder (via their profile's "Find Matches")
- **Compare / Match Detail** — full pairwise breakdown: score, positives, risks,
  stated deal breakers, per-dimension gap
- Deterministic scoring — recompute on demand, or automatically after new
  evidence lands (`_shared/matchRecompute.ts`)

### Teams
- **Team Creation** — select ≥2 founders, live compatibility/skills-gap preview
  before committing
- **Team List** — roster grid across the cohort, searchable by team or member name
- **Team Profile** — members, compatibility score, team strengths,
  complementary skills, potential gaps, potential friction, team activity log
- A founder belongs to at most one team (`team_founders.founder_id` unique)

### Admin Dashboard
- Program overview stat tiles (active founders, evaluations done, missing info, teams created)
- Quick actions (view founders, add evaluation, go to matching, create activity, create team)
- Needs Attention (incomplete profiles) and Recent Activity feeds

### Authentication
- Email & password registration with OTP email verification, forgot/reset password — **Supabase Auth**, emails delivered via the Resend send-email hook
- Session persistence and token refresh via the Supabase client SDK
- Seed/demo accounts documented in `docs/` (gitignored — see your own copy or ask a teammate)

---

## Not in this build

Deliberately out of scope for the pivot (see `supabase-full` if you need them):

- Swipe deck / person-to-person matching feed, chat, meetings, premium tier
- Investor role, projects, partner invitations, pitch-deck AI review
- Any AI/LLM calls — matching and evidence scoring are pure deterministic math

---

## Local Setup

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`, no global install needed)
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Resend](https://resend.com) API key (free tier) if you want working auth emails locally

### 1. Set up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. `npx supabase login`, then `npx supabase link --project-ref <your-project-ref>`
3. Push the schema: `npx supabase db push --db-url "<your DATABASE_URL>" --yes`
4. In **Authentication → Providers**, enable **Email** (with "Confirm email" on, for OTP verification)
5. In **Authentication → Hooks**, register the Send Email hook pointing at your deployed `send-email` function, with a shared secret matching `SEND_EMAIL_HOOK_SECRET`

### 2. Edge Functions (backend)

Set secrets (read by every function via `Deno.env.get`, see `supabase/functions/_shared/`):

```bash
npx supabase secrets set \
  DATABASE_URL="<transaction-mode pooler URL, port 6543>" \
  RESEND_API_KEY="<your Resend key>" \
  SEND_EMAIL_HOOK_SECRET="<shared secret, matches the Dashboard hook config>" \
  SEND_EMAIL_FROM="BizMatch <onboarding@resend.dev>" \
  FRONTEND_URL="<your deployed frontend origin, comma-separated if several>"
```

`SUPABASE_URL` and the service-role key are auto-injected by the platform — no need to set them.

Deploy all functions:

```bash
for fn in auth users founders founder-dna evidence assessments peer-feedback activities matches teams notifications send-email; do
  npx supabase functions deploy "$fn" --no-verify-jwt
done
```

`--no-verify-jwt` is required — every function does its own auth verification in `_shared/auth.ts` (it needs the full `public.users` row, not just JWT claims), and `founders/:id/cv` accepts the token as a `?token=` query param for direct browser navigation, which platform-level JWT verification doesn't support. `send-email` is the exception — it's called server-to-server by Supabase's auth hook with a Standard Webhooks signature, not a user JWT, so it skips the shared router/rate-limit wrapper entirely.

Run locally with `npx supabase functions serve` (needs Docker); functions are then reachable at `http://127.0.0.1:54321/functions/v1/<name>`.

### 3. Frontend

```bash
cd frontend
npm install
```

Set these as `EXPO_PUBLIC_*` env vars (or in a `.env` picked up by Expo):

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Same project URL used to deploy the Edge Functions — also used to build `API_BASE_URL` (`${SUPABASE_URL}/functions/v1`) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project's publishable/anon key (safe for client bundles) |

```bash
npx expo start --web
```

Or scan the QR code with [Expo Go](https://expo.dev/go) for native, or build a dev client with `eas build --profile development`.

---

## Project Structure

```
bizmatch/
├── supabase/
│   ├── migrations/          # Postgres schema, applied via Supabase CLI (supabase db push)
│   ├── config.toml           # verify_jwt = false per function (see Edge Functions setup above)
│   └── functions/            # the deployed backend — one Edge Function per route group
│       ├── _shared/          # auth, cors, db (postgres.js pool), respond, router, serve,
│       │                     # background (waitUntil), founderScoring (pure scoring math),
│       │                     # dnaRecompute, matchRecompute, teamRecompute, rateLimit
│       ├── auth/              # POST /precheck-name
│       ├── users/             # /me, role, photo, push-token, onboarding, verification
│       ├── founders/           # dashboard, list, profile CRUD, capabilities, partner
│       │                       # requirements, deal breakers, status, CV upload/serve
│       ├── founder-dna/         # derived insights (dimension scores/confidence, radar data)
│       ├── evidence/            # raw evidence entries ("Add Evaluation" quick-add)
│       ├── assessments/         # structured interview/evaluation form submission
│       ├── peer-feedback/       # founder-on-founder ratings tied to an activity
│       ├── activities/          # CRUD, participants, evaluators
│       ├── matches/             # top matches (one founder), top pairs (cohort-wide),
│       │                        # compare/pairwise detail, recompute
│       ├── teams/               # preview, CRUD, members, recompute
│       ├── notifications/       # list, mark-read
│       └── send-email/          # Supabase Auth "Send Email" hook target (Resend-backed)
├── frontend/
│   ├── src/
│   │   ├── navigation/        # AppNavigator — Admin / Founder / FounderOnboarding stacks
│   │   ├── components/
│   │   │   ├── AppShell.js    # responsive nav shell: sidebar (desktop) / tab bar (mobile)
│   │   │   ├── ui/             # shared primitives: StatTile, GradientHero, IconCircle,
│   │   │   │                   # Pill, SectionCard, Avatar, ResponsiveRow
│   │   │   └── founder/        # FounderHeader, RadarChart, CapabilityList,
│   │   │                       # PartnerRequirementsCard, EvidenceTimeline,
│   │   │                       # EvidenceConfidenceTable, BehavioralSignals, TopMatches,
│   │   │                       # MatchCard, InsightsList
│   │   ├── screens/
│   │   │   ├── auth/           # Welcome, Login, Register, VerifyOtp, ForgotPassword, ResetPassword
│   │   │   ├── onboarding/     # OnboardingScreen (first-run wizard, founders only)
│   │   │   ├── admin/          # AdminDashboard, FounderList, ActivitiesList, ActivityDetail,
│   │   │   │                   # Matching, MatchDetail, TeamCreation, TeamList, TeamProfile
│   │   │   ├── founders/       # FounderProfileScreen (shared by admin + self-view),
│   │   │   │                   # EvaluationScreen, ComingSoonScreen
│   │   │   └── profile/        # AccountSettings
│   │   ├── config/nav.js       # ADMIN_NAV_ITEMS / FOUNDER_NAV_ITEMS for AppShell
│   │   ├── services/           # api (axios), supabase (client), founders/activities/
│   │   │                       # matches/teams/peerFeedback .service.js, auth.service
│   │   ├── store/               # Zustand (auth + app state, incl. dark mode)
│   │   └── theme.js              # design tokens: colors (light/dark), radius, typography
│   └── App.js
└── docs/                      # gitignored — mockups, E2E/visual QA plans, local working docs
```

---

## API Endpoints

All paths below are relative to `${SUPABASE_URL}/functions/v1` (e.g. `/founders/dashboard` → `https://<ref>.supabase.co/functions/v1/founders/dashboard`).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/precheck-name` | Moderation check on display name, called before `supabase.auth.signUp` |
| GET | `/users/me` | Get my merged profile row |
| PATCH | `/users/me` | Update name |
| DELETE | `/users/me` | Delete account |
| POST | `/users/me/photo` | Upload profile photo |
| PATCH | `/users/me/push-token` | Save Expo push token |
| PATCH | `/users/me/onboarding` | Mark onboarding wizard as seen |
| POST | `/users/me/verify-self` | Instant self-verification (demo) |
| PATCH | `/users/:id/verification` | Set verification status (admin only) |
| GET | `/users/:id` | Get a user's public info by ID |
| GET | `/founders/dashboard` | Admin dashboard stats + recent activity + needs-attention |
| GET | `/founders` | List founders (`?search=`) |
| GET | `/founders/:id` | Get a founder's full profile |
| PUT | `/founders/:id/profile` | Update basic profile fields |
| PUT | `/founders/:id/capabilities` | Replace provides/needs capability list |
| PUT | `/founders/:id/partner-requirements` | Update partner requirements |
| PUT | `/founders/:id/deal-breakers` | Replace stated deal breakers |
| POST | `/founders/:id/onboarding/complete` | Mark founder onboarding complete |
| PATCH | `/founders/:id/status` | Set status (active/inactive/dropped) |
| PATCH | `/founders/:id/program` | Assign to a program/cohort |
| POST | `/founders/:id/cv` | Upload CV |
| GET | `/founders/:id/cv` | Serve CV inline (`?token=<Supabase JWT>`) |
| GET | `/founder-dna/:founderId` | Derived DNA insights (dimension scores, confidence, evidence counts) |
| POST | `/founder-dna/:founderId/recompute` | Force-recompute DNA insights |
| GET | `/evidence` | List raw evidence entries (`?founderId=&...filters`) |
| POST | `/evidence` | Add a raw evidence entry ("Add Evaluation" quick-add) |
| GET | `/assessments` | List structured assessments (`?founderId=`) |
| POST | `/assessments` | Submit a structured interview/evaluation form |
| GET | `/peer-feedback` | List peer feedback |
| POST | `/peer-feedback` | Submit peer feedback about a co-participant |
| GET | `/activities` | List activities (`?programId=&teamId=&founderId=`) |
| POST | `/activities` | Create an activity |
| GET | `/activities/:id` | Get an activity's detail (participants, evaluators) |
| PATCH | `/activities/:id` | Update an activity (title, description, schedule, status) |
| PUT | `/activities/:id/participants` | Replace an activity's participant list |
| PUT | `/activities/:id/evaluators` | Replace an activity's evaluator list |
| DELETE | `/activities/:id` | Delete an activity |
| GET | `/matches/top` | Top matches for one founder (`?founderId=&limit=`) |
| GET | `/matches/top-pairs` | Cohort-wide ranked pairs (`?limit=&founderId=` to scope) |
| GET | `/matches/compare` | Pairwise compare/detail (`?a=&b=`) |
| POST | `/matches/recompute` | Recompute a founder's compatibility scores (`{founderId}`) |
| GET | `/teams/preview` | Preview a not-yet-created team's compatibility (`?founderIds=`) |
| GET | `/teams` | List teams (`?programId=`) |
| POST | `/teams` | Create a team (`{name, founderIds}`) |
| GET | `/teams/:id` | Get a team's profile + computed insights |
| PUT | `/teams/:id/members` | Replace a team's member list |
| POST | `/teams/:id/recompute` | Recompute a team's insights |
| DELETE | `/teams/:id` | Delete a team |
| GET | `/notifications` | Get all notifications |
| POST | `/notifications/read` | Mark notifications as read (`{ ids }`) |

---

## Deployment

- **Backend:** Supabase Edge Functions — `npx supabase functions deploy <name> --no-verify-jwt` per function (see Local Setup above); no server to host, no `PORT`/`node server.js` involved
- **Frontend:** Netlify (web) / EAS (native) — build command `npx expo export -p web`, publishes `frontend/dist/`; Netlify's build environment needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set (Expo inlines `EXPO_PUBLIC_*` vars at build time, so runtime-only env vars won't work)
- **Database / Auth / Storage:** Supabase — schema pushed via `supabase db push` (see Local Setup above), not run automatically at boot
- **Email:** Resend, via the `send-email` Edge Function registered as a Supabase Auth hook — replaces Supabase's built-in mailer (low default send rate) for OTP/reset emails
- **Rate limiting:** Postgres-table-backed (`rate_limits`), since Edge Functions are stateless/multi-instance — no in-memory store

## Notes

- Never commit `.env` files or Supabase secrets
- `docs/` is gitignored — mockups, the E2E test plan, and the visual/functionality QA plan live there as local working references, not part of the repo history
- This branch is intentionally kept separate from `main`/`supabase-full` per product direction — do not merge without an explicit decision to retire the swipe-app product
