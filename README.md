# BizMatch

A Tinder-style matchmaking platform for entrepreneurs and investors.

**This is the `mvp-lean` branch** — a trimmed-down fork of the original BizMatch build. Partner invitations, job offers, the NDA e-signature system, AI meeting briefings, 2FA, and the investor project-swipe feed have all been removed to focus on the core matching/chat/meetings loop. The data layer has also moved from MySQL + custom JWT auth to **Supabase** (Postgres + Auth + Storage), and AI features now run on **Gemini** instead of Claude.

The backend has since moved a second time: from a Node/Express server (originally hosted on Railway) to **Supabase Edge Functions** — there is no standalone server to deploy or host anymore. The legacy Express app's source has been archived to `deletion candidate/backend/` (staged for removal, not deleted); `backend/` now only holds local dev scripts. All traffic goes to the Edge Functions in `supabase/functions/`.

**Backend:** [Supabase Edge Functions](https://supabase.com/docs/guides/functions) (Deno) — one function per route group, deployed via `supabase functions deploy`  
**Frontend:** Expo (React Native) — deployed to Netlify (web) or run locally  
**Database / Auth / Storage:** [Supabase](https://supabase.com)  
**AI:** Google Gemini, called directly via the REST API (no SDK, to stay Deno-compatible)

---

## Features

### Authentication
- Email & password registration with OTP email verification, forgot/reset password — all handled by **Supabase Auth** (no custom backend auth endpoints)
- Google OAuth sign-in via Supabase's native provider
- Session persistence and token refresh handled by the Supabase client SDK

### Profiles
- Role selection: Entrepreneur or Investor
- Entrepreneur profile: bio, skills (bubble tags), hobbies
- Investor profile: bio, investment domain, preferred stage, max investment
- Shared extended fields: portfolio URL, LinkedIn, experience, CV upload
- Profile photo upload (Supabase Storage)
- **Profile completeness score** — progress bar (0–100%) with colour coding and inline hints
- **One-click identity verification** — "Verify Account" button instantly marks account as verified (demo bypass)
- Change role at any time from Account Settings

### Swipe & Matching
- Tinder-style swipe deck — swipe right to like, left to pass
- Entrepreneurs browse other entrepreneurs by default; investors browse entrepreneur profiles
- **AI-driven feed ranking** — Gemini scores each candidate pair 0–100 in the background; scores cached in `ai_match_scores`; feed reranks on subsequent loads
- When AI score cached: AI is the dominant signal (60 pts) + stage alignment (20 pts) + budget fit (10 pts) + completeness (10 pts)
- Math-only fallback when not yet scored: stage (40 pts) + budget (30 pts) + Jaccard domain overlap (30 pts) + completeness (10 pts)
- Passed profiles recycle back at the bottom of the feed
- Mutual match detection → match celebration modal
- Push notification sent to matched user

### Teams & Challenges
- **Team formation** — an entrepreneur can form a team and invite anyone they've already matched with (star topology: only the team's creator invites; invitees don't need to be matched with each other)
- **AI Cohesion Challenge** — the moment a team reaches 2 accepted members, Gemini auto-generates a private exercise tailored to the team's combined listed skills; the team writes a response and gets AI feedback + a 0–100 cohesion score. Completing this is required before the team can apply to any investor hackathon.
- **Investor-posted hackathons** — investors create open, time-boxed challenges (title, description — optionally AI-drafted, judging criteria, investment teaser, submission deadline); any team can browse and sign up
- **Submissions** — teams submit a pitch deck (PDF) + demo video + description per challenge; Gemini reviews the deck content directly and returns an overall score (1–10), strengths, weaknesses, and suggestions
- **Winner selection & investment offers** — after the deadline, the investor picks a winning team and sends a structured offer (amount, equity %, valuation, terms); the team can accept, decline, or counter-offer, with a full multi-round negotiation history

### Messaging
- Chat screen for every mutual match, updates via 3-second polling
- Structured message cards: submission sharing, meeting proposals/responses
- Date dividers, timestamps, unread blue dot per conversation
- **Read receipts** — ✓ (sent) / ✓✓ (read) indicators; ✓✓ gated behind Premium
- **Last seen** — chat header shows "Active now" (< 2 min) or "Last seen Xm/h/d ago" based on real activity
- **Share Submission** — entrepreneurs can share one of their team's submitted challenge entries directly in chat once matched
- Push notification on new message (real device only)

### Meeting System
- **Premium-only** — meeting proposals require an active premium subscription
- Meeting types: Virtual (video link) or In-Person (address with autocomplete via Nominatim/OpenStreetMap)
- Proposal appears as a card in chat; receiver can confirm, decline, or suggest a new time
- **Meeting rescheduling** — pre-fills the proposal form with original details; new proposal sent with roles swapped
- Both proposer and receiver can cancel; receiver can cancel only after meeting is confirmed
- Meetings tab shows all upcoming meetings with status badges

### Premium System
- **Free trial** — "Activate Free Trial (30 days)" button; no real payment required
- **Unlimited swipes** — free users limited to 20 swipes/day; "Go Premium" alert when limit hit
- **Super Like** — ★ star button with gold flash animation + card fly-up; shown with badge in "Who Liked Me"
- **Who Liked Me** — premium-only section in Matches tab showing users who swiped right on you
- **Read receipts** — ✓✓ "read" indicator in chat (Premium only; free users see ✓ only)
- **Subscription management** — gold-bordered Premium card in Account Settings with cancel option

### Onboarding Tutorial
- 4-slide walkthrough for first-time users (shown once after role is set)

### Push Notifications
- New match and new message alerts when app is backgrounded (native only)
- Real physical device required for OS-level push (not simulators)
- **Web version** uses an in-app notification bell that polls every 5 s

### Content Moderation
- Profile bios, chat messages, team names, challenge text, submission descriptions, and offer terms screened before saving
- Local word-list (hate speech, sexual content, threats, spam triggers) — instant response, no API calls

### File Storage
- Profile photos, CVs, pitch decks, and demo videos stored on **Supabase Storage** (public buckets: `photos`, `cvs`, `decks`, `videos`)

---

## Removed in this fork

These existed in the original build and were deliberately cut to keep the MVP lean:

- Partner invitations (equity/salary negotiation) and the project team/partner roster
- Job offers (entrepreneur ↔ entrepreneur)
- NDA system (request/sign, AI-drafted legal text, PDF generation, NDA gate on project details)
- AI meeting due-diligence briefings
- Two-factor authentication (TOTP)
- Investor project-swipe feed (investors now discover entrepreneurs through the same person-to-person feed everyone else uses)
- ID document upload (was a non-functional stub)
- **Standalone Projects tab** — replaced entirely by Teams & Challenges (see above); the old `projects` table/Storage objects still exist for historical data but the feature and its Edge Function are gone

---

## Local Setup

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`, no global install needed)
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Gemini API key](https://aistudio.google.com/apikey) (free)

### 1. Set up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. `npx supabase login`, then `npx supabase link --project-ref <your-project-ref>`
3. Push the schema: `npx supabase db push --db-url "<your DATABASE_URL>" --yes`
4. In **Authentication → Providers**, enable **Email** (with "Confirm email" on, for OTP verification) and optionally **Google** (using a Google Cloud OAuth Client ID/Secret)

### 2. Edge Functions (backend)

Set secrets (these are read by every function via `Deno.env.get`, see `supabase/functions/_shared/`):

```bash
npx supabase secrets set \
  DATABASE_URL="<transaction-mode pooler URL, port 6543>" \
  GEMINI_API_KEY="<your Gemini key>" \
  FRONTEND_URL="<your deployed frontend origin, comma-separated if several>"
```

`SUPABASE_URL` and the service-role key are auto-injected by the platform — no need to set them.

Deploy all 8 functions:

```bash
for fn in auth users profile match messages challenges meetings notifications; do
  npx supabase functions deploy "$fn" --no-verify-jwt
done
```

`--no-verify-jwt` is required — every function does its own auth verification in `_shared/auth.ts` (it needs the full `public.users` row, not just JWT claims), and `profile/cv` accepts the token as a `?token=` query param for direct browser navigation, which platform-level JWT verification doesn't support.

Run locally with `npx supabase functions serve` (needs Docker); functions are then reachable at `http://127.0.0.1:54321/functions/v1/<name>`.

Optional local dev tools (gitignored, not part of the deployed app): `backend/scripts/setup-storage-buckets.js` (one-time bucket creation) and `backend/scripts/seed.js` (demo accounts, password `Demo1234!`).

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
npx expo start --clear
```

Scan the QR code with [Expo Go](https://expo.dev/go), or build a dev client with `eas build --profile development`.

---

## Project Structure

```
bizmatch/
├── supabase/
│   ├── migrations/        # Postgres schema, applied via Supabase CLI (supabase db push)
│   ├── config.toml         # verify_jwt = false per function (see Edge Functions setup above)
│   └── functions/          # the deployed backend — one Edge Function per route group
│       ├── _shared/        # auth, cors, db (postgres.js pool), gemini (REST fetch), storage,
│       │                   # moderation, notifications, rateLimit, router, serve, background (waitUntil),
│       │                   # matchModel (feed/swipe/scoring, shared with profile's preScoreUser),
│       │                   # messageService (shared by messages + meetings)
│       ├── auth/            # POST /precheck-name
│       ├── users/           # /me, role, photo, premium, who-liked-me, admin verification
│       ├── profile/         # public profile, my profile CRUD, CV upload/serve
│       ├── match/           # feed, swipe, matches, compatibility
│       ├── messages/        # conversations, messages, send, read, share-submission
│       ├── challenges/      # teams (create/invite/respond), AI cohesion challenge,
│       │                   # hackathons (CRUD, AI draft), signups/submissions (deck/video/AI-review),
│       │                   # winner selection, investment offer negotiation
│       ├── meetings/        # propose, list, respond, reschedule
│       └── notifications/   # list, mark-read
├── backend/                # local dev tools only — the Express app itself has been
│   │                       # archived (see deletion candidate/), not deployed anywhere
│   ├── scripts/            # seed.js, setup-storage-buckets.js (standalone, gitignored),
│   │   └── e2e/            # live E2E test suite against the deployed app (see docs/E2E_TEST_PLAN.md)
│   ├── package.json        # deps for the scripts above (@supabase/supabase-js, pg, dotenv, Gemini)
│   └── env.example
├── deletion candidate/      # staged-for-removal files kept for review, not deleted — see its README
├── frontend/
│   ├── src/
│   │   ├── navigation/    # AppNavigator (tabs + stacks)
│   │   ├── screens/
│   │   │   ├── auth/      # Welcome, Login, Register, VerifyOtp, ForgotPassword, ResetPassword
│   │   │   ├── match/     # SwipeScreen, MatchesScreen, ChatScreen, ProfileDetailScreen
│   │   │   ├── meeting/   # MeetingScreen, MeetingDetailScreen, ProposeMeetingScreen
│   │   │   ├── onboarding/# OnboardingScreen
│   │   │   ├── premium/   # PremiumScreen
│   │   │   ├── profile/   # ProfileScreen, EditProfileScreen, AccountSettings
│   │   │   └── challenge/ # ChallengesScreen, ChallengeDetailScreen, SubmissionScreen, OfferNegotiationScreen
│   │   ├── services/      # api (axios), supabase (client), auth.service, match.service, team.service, challenge.service
│   │   ├── store/         # Zustand (auth + app state)
│   │   └── utils/         # pushNotifications.native.js / .web.js (platform stubs)
│   └── App.js
```

---

## API Endpoints

All paths below are relative to `${SUPABASE_URL}/functions/v1` (e.g. `/match/feed` → `https://<ref>.supabase.co/functions/v1/match/feed`).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/precheck-name` | Moderation check on display name, called before `supabase.auth.signUp` |
| GET | `/profile` | Get my profile |
| GET | `/profile/public/:userId` | Get another user's public profile |
| POST | `/profile` | Create profile |
| PUT | `/profile` | Update profile |
| POST | `/profile/upload-cv` | Upload CV/résumé PDF |
| GET | `/profile/cv` | Serve CV PDF inline (`?token=<Supabase JWT>`) |
| GET | `/users/me` | Get my merged profile row |
| PATCH | `/users/me` | Update name |
| PATCH | `/users/me/role` | Switch role |
| POST | `/users/me/photo` | Upload profile photo (base64) |
| PATCH | `/users/me/push-token` | Save Expo push token |
| PATCH | `/users/me/onboarding` | Mark onboarding tutorial as seen |
| POST | `/users/me/verify-self` | Instant self-verification (demo) |
| POST | `/users/me/premium/activate` | Activate 30-day free trial |
| DELETE | `/users/me/premium` | Cancel premium subscription |
| GET | `/users/me/who-liked-me` | Get users who liked you (premium) |
| DELETE | `/users/me` | Delete account |
| GET | `/users/:id` | Get a user's public info by ID |
| PATCH | `/users/:id/verification` | Set verification status (admin only) |
| GET | `/match/feed` | Get AI-scored swipe feed |
| POST | `/match/swipe` | Record a swipe (returns match if mutual) |
| GET | `/match/matches` | Get all matches |
| GET | `/match/compatibility/:targetUserId` | Get compatibility score with another user |
| GET | `/messages` | Get all conversations |
| GET | `/messages/:matchId` | Get messages for a match (includes `read_at`) |
| POST | `/messages/:matchId` | Send a message |
| POST | `/messages/:matchId/read` | Mark all received messages in this chat as read |
| POST | `/messages/:matchId/share-submission` | Share a challenge submission (`{challengeId, teamId}`) |
| POST | `/challenges/teams` | Create a team |
| PUT | `/challenges/teams/:id` | Update team venture profile (stage/industry/funding) |
| POST | `/challenges/teams/:id/invite` | Invite a matched user to the team |
| POST | `/challenges/teams/:id/respond` | Accept/decline a team invite |
| POST | `/challenges/teams/:id/leave` | Leave a team (non-creator only) |
| GET | `/challenges/teams/mine` | Get my team(s) |
| GET | `/challenges/teams/invites/mine` | Get my pending team invites |
| GET | `/challenges/teams/:id` | Get a team's details/members |
| POST | `/challenges/challenges` | Create a hackathon challenge (investor) |
| POST | `/challenges/challenges/draft-description` | AI-draft a challenge description (investor) |
| GET | `/challenges/challenges/open` | List open hackathon challenges |
| GET | `/challenges/challenges/mine` | Get my created challenges (investor) |
| GET | `/challenges/challenges/:id` | Get a challenge's details |
| POST | `/challenges/challenges/:id/signup` | Sign a team up for a hackathon (requires completed cohesion test) |
| GET | `/challenges/challenges/:id/signups` | View all signups/submissions (investor, owner only) |
| POST | `/challenges/challenges/:id/select-winner` | Select the winning team (investor, after deadline) |
| POST | `/challenges/challenges/:id/offers` | Create the first investment offer (investor) |
| POST | `/challenges/challenges/:id/offers/counter` | Counter-offer (either party) |
| POST | `/challenges/challenges/:id/offers/accept` | Accept the current pending offer |
| POST | `/challenges/challenges/:id/offers/decline` | Decline the current pending offer |
| GET | `/challenges/challenges/:id/offers` | Get the full negotiation history |
| POST | `/challenges/signups/:id/upload-deck` | Upload a submission's pitch deck PDF |
| POST | `/challenges/signups/:id/upload-video` | Upload a submission's demo video |
| POST | `/challenges/signups/:id/ai-review` | Get AI feedback (deck review for hackathons, cohesion score for the team's cohesion test) |
| POST | `/challenges/signups/:id/submit` | Submit an entry |
| GET | `/challenges/signups/mine` | Get my team's signups across all challenges |
| POST | `/meetings` | Propose a meeting (Premium only) |
| GET | `/meetings` | List my meetings |
| PUT | `/meetings/:id` | Confirm / decline / cancel meeting |
| PATCH | `/meetings/:id/reschedule` | Suggest a new meeting time |
| GET | `/notifications` | Get all notifications (last 50) |
| POST | `/notifications/read` | Mark notifications as read (`{ ids }` or `{ types }`) |

---

## Deployment

- **Backend:** Supabase Edge Functions — `npx supabase functions deploy <name> --no-verify-jwt` per function (see Local Setup above); no server to host, no `PORT`/`node server.js` involved
- **Frontend:** Netlify (web) / EAS (native) — build command `npx expo export -p web`, publishes `frontend/dist/`; Netlify's build environment needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set (Expo inlines `EXPO_PUBLIC_*` vars at build time, so runtime-only env vars won't work)
- **Database / Auth / Storage:** Supabase — schema pushed via `supabase db push` (see Local Setup above), not run automatically at boot
- **AI:** Google Gemini (`gemini-flash-latest`), called via `fetch` to the REST API — feed ranking, deck review, compatibility score
- **Content moderation:** local word-list (no API calls)
- **Rate limiting:** Postgres-table-backed (`rate_limits`), since Edge Functions are stateless/multi-instance — no in-memory store

## Notes

- Never commit `.env` files or Supabase secrets
- AI features return `503` when `GEMINI_API_KEY` is missing or invalid
- `backend/scripts/seed.js` and `setup-storage-buckets.js` are gitignored, standalone local dev tools — not part of the deployed app
- The legacy Express app is archived at `deletion candidate/backend/` (staged for review/removal, not deleted) — the Edge Functions in `supabase/functions/` are direct ports of its controllers/models, so it's kept only as a reference until confirmed safe to delete for good
