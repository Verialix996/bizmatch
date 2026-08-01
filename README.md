# BizMatch

A Tinder-style matchmaking platform for entrepreneurs and investors.

**This is the `mvp-lean` branch** — a trimmed-down fork of the original BizMatch build. Partner invitations, job offers, the NDA e-signature system, AI meeting briefings, 2FA, and the investor project-swipe feed have all been removed to focus on the core matching/chat/meetings loop. The data layer has also moved from MySQL + custom JWT auth to **Supabase** (Postgres + Auth + Storage), and AI features now run on **Gemini** instead of Claude.

**Backend:** Node/Express, deployed on Railway (or run locally)  
**Frontend:** Expo (React Native) — run locally or build via EAS  
**Database / Auth / Storage:** [Supabase](https://supabase.com)  
**AI:** Google Gemini (`@google/generative-ai`)

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

### Projects
- Entrepreneurs create and manage project cards (single owner — no team/partner roster)
- Public / private visibility toggle
- Pitch deck upload (PDF) and demo video upload — both on Supabase Storage, served via a backend proxy endpoint that accepts a JWT token in the query string for direct browser navigation
- **AI Deck Review** — upload a PDF, get back an overall score (1–10), strengths, weaknesses, and suggestions; Gemini reads the actual PDF content, not just a description; non-pitch documents receive a score of 1

### Messaging
- Chat screen for every mutual match, updates via 3-second polling
- Structured message cards: project sharing, meeting proposals/responses
- Date dividers, timestamps, unread blue dot per conversation
- **Read receipts** — ✓ (sent) / ✓✓ (read) indicators; ✓✓ gated behind Premium
- **Last seen** — chat header shows "Active now" (< 2 min) or "Last seen Xm/h/d ago" based on real activity
- **Share Project** — entrepreneurs can share a project's full details directly in chat once matched (no signing step)
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
- Profile bios, chat messages, and project descriptions screened before saving
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

---

## Local Setup

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Gemini API key](https://aistudio.google.com/apikey) (free)

### 1. Set up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Push the schema: from the repo root, `cd backend && npm run migrate` (runs `supabase db push` using your `DATABASE_URL`)
3. In **Authentication → Providers**, enable **Email** (with "Confirm email" on, for OTP verification) and optionally **Google** (using a Google Cloud OAuth Client ID/Secret)

### 2. Backend

```bash
cd backend
npm install
cp env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default: `3000`) |
| `NODE_ENV` | `development` or `production` |
| `SUPABASE_URL` | Project Settings → API |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API (publishable/anon key) |
| `SUPABASE_SECRET_KEY` | Project Settings → API (secret/service_role key — backend only, never expose) |
| `DATABASE_URL` | Project Settings → Database → Connection string (session pooler, port 5432) |
| `GEMINI_API_KEY` | Free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — powers feed ranking, deck review, compatibility score |
| `FRONTEND_URL` | Frontend origin for CORS (e.g. `http://localhost:8081`) |

```bash
node scripts/setup-storage-buckets.js   # one-time: creates the photos/cvs/decks/videos buckets
node scripts/seed.js                    # optional: seeds demo accounts (password: Demo1234!)
npm run dev
```

Server runs on `http://localhost:3000`. Schema migrations are applied via `npm run migrate` (Supabase CLI), not automatically on boot.

### 3. Frontend

```bash
cd frontend
npm install
```

Set these as `EXPO_PUBLIC_*` env vars (or in a `.env` picked up by Expo):

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | Your backend URL (default points at the original Railway deployment) |
| `EXPO_PUBLIC_SUPABASE_URL` | Same as backend's `SUPABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as backend's `SUPABASE_PUBLISHABLE_KEY` (safe for client bundles) |

```bash
npx expo start --clear
```

Scan the QR code with [Expo Go](https://expo.dev/go), or build a dev client with `eas build --profile development`.

---

## Project Structure

```
bizmatch/
├── supabase/
│   └── migrations/        # Postgres schema, applied via Supabase CLI (supabase db push)
├── backend/
│   ├── scripts/           # seed.js, setup-storage-buckets.js (local-only, gitignored)
│   ├── src/
│   │   ├── config/        # db (pg pool), supabase (Auth client), gemini, storage
│   │   ├── controllers/   # auth, user, profile, match, message, meeting, project, notification
│   │   ├── middleware/     # auth (Supabase JWT verify), upload (multer memory storage), rateLimiter
│   │   ├── models/        # user, profile, match, message, meeting, project
│   │   ├── routes/        # API route definitions
│   │   └── services/      # notification (Expo push), moderation (word-list)
│   └── server.js
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
│   │   │   └── project/   # ProjectsScreen, ProjectDetailScreen
│   │   ├── services/      # api (axios), supabase (client), auth.service, match.service, project.service
│   │   ├── store/         # Zustand (auth + app state)
│   │   └── utils/         # pushNotifications.native.js / .web.js (platform stubs)
│   └── App.js
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/precheck-name` | Moderation check on display name, called before `supabase.auth.signUp` |
| GET | `/api/profile` | Get my profile |
| GET | `/api/profile/public/:userId` | Get another user's public profile |
| POST | `/api/profile` | Create profile |
| PUT | `/api/profile` | Update profile |
| POST | `/api/profile/upload-cv` | Upload CV/résumé PDF |
| GET | `/api/profile/cv` | Serve CV PDF inline (`?token=<Supabase JWT>`) |
| GET | `/api/users/me` | Get my merged profile row |
| PATCH | `/api/users/me` | Update name |
| PATCH | `/api/users/me/role` | Switch role |
| POST | `/api/users/me/photo` | Upload profile photo (base64) |
| PATCH | `/api/users/me/push-token` | Save Expo push token |
| PATCH | `/api/users/me/onboarding` | Mark onboarding tutorial as seen |
| POST | `/api/users/me/verify-self` | Instant self-verification (demo) |
| POST | `/api/users/me/premium/activate` | Activate 30-day free trial |
| DELETE | `/api/users/me/premium` | Cancel premium subscription |
| GET | `/api/users/me/who-liked-me` | Get users who liked you (premium) |
| DELETE | `/api/users/me` | Delete account |
| GET | `/api/users/:id` | Get a user's public info by ID |
| PATCH | `/api/users/:id/verification` | Set verification status (admin only) |
| GET | `/api/match/feed` | Get AI-scored swipe feed |
| POST | `/api/match/swipe` | Record a swipe (returns match if mutual) |
| GET | `/api/match/matches` | Get all matches |
| GET | `/api/match/compatibility/:targetUserId` | Get compatibility score with another user |
| GET | `/api/messages` | Get all conversations |
| GET | `/api/messages/:matchId` | Get messages for a match (includes `read_at`) |
| POST | `/api/messages/:matchId` | Send a message |
| POST | `/api/messages/:matchId/read` | Mark all received messages in this chat as read |
| POST | `/api/messages/:matchId/share-project` | Share project details (no signing step) |
| GET | `/api/projects/mine` | Get my own projects |
| GET | `/api/projects/:id` | Get a single project by ID |
| POST | `/api/projects` | Create a project |
| PUT | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |
| POST | `/api/projects/:id/upload-deck` | Upload pitch deck PDF |
| POST | `/api/projects/:id/upload-video` | Upload demo video |
| GET | `/api/projects/:id/deck` | Serve pitch deck PDF inline (`?token=<Supabase JWT>`) |
| POST | `/api/projects/:id/deck-review` | Get AI feedback on pitch deck |
| POST | `/api/meetings` | Propose a meeting (Premium only) |
| GET | `/api/meetings` | List my meetings |
| PUT | `/api/meetings/:id` | Confirm / decline / cancel meeting |
| PATCH | `/api/meetings/:id/reschedule` | Suggest a new meeting time |
| GET | `/api/notifications` | Get all notifications (last 50) |
| POST | `/api/notifications/read` | Mark notifications as read (`{ ids }` or `{ types }`) |

---

## Deployment

- **Backend:** Railway (or any Node host) — start command `node server.js`
- **Frontend:** Netlify (web) / EAS (native) — build command `npx expo export -p web`, publishes `frontend/dist/`
- **Database / Auth / Storage:** Supabase — schema pushed via `supabase db push` (see Local Setup above), not run automatically at boot
- **AI:** Google Gemini (`gemini-flash-latest`) — feed ranking, deck review, compatibility score
- **Content moderation:** local word-list (no API calls)

## Notes

- Never commit `.env` files
- AI features return `503` when `GEMINI_API_KEY` is missing or invalid
- `backend/scripts/seed.js` and `setup-storage-buckets.js` are gitignored — local dev tools, not part of the deployed app
