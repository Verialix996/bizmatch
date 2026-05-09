# BizMatch

A Tinder-style matchmaking platform for entrepreneurs and investors.

**Backend:** Live on Railway → `https://zooming-surprise-production.up.railway.app`  
**Frontend:** Expo (React Native) — run locally, connects to Railway from any network  
**Deploy branch:** `main-Ai_integrated` (Railway auto-deploys from this branch)

---

## Features

### Authentication
- Email & password registration with OTP email verification (Gmail API)
- Login with JWT session management (7-day tokens, persisted across app restarts)
- Forgot password / reset password via email link (1-hour expiry)
- Google OAuth sign-in
- Two-factor authentication (TOTP) — QR code setup + verification screen
- **Account lockout** — 5 consecutive failed logins locks the account for 15 minutes

### Profiles
- Role selection: Entrepreneur or Investor
- Entrepreneur profile: bio, skills (bubble tags), hobbies, venture stage, funding needs
- Investor profile: bio, investment domain, preferred stage, max investment
- Profile photo upload (stored on Cloudinary CDN)
- **Profile completeness score** — progress bar (0–100%) with colour coding and inline hints
- **One-click identity verification** — "Verify Account" button instantly marks account as verified (demo bypass)
- Change role at any time from Account Settings

### Swipe & Matching
- Tinder-style swipe deck — swipe right to like, left to pass
- Entrepreneurs can toggle between "Find Investors" and "Find Partners" modes
- Investors see entrepreneur profiles and project cards
- **AI-driven feed ranking** — Claude Haiku scores each candidate pair 0–100 in the background; scores cached in `ai_match_scores`; feed reranks on subsequent loads
- When AI score cached: AI is the dominant signal (60 pts) + stage alignment (20 pts) + budget fit (10 pts) + completeness (10 pts)
- Math-only fallback when not yet scored: stage (40 pts) + budget (30 pts) + Jaccard domain overlap (30 pts) + completeness (10 pts)
- Passed profiles recycle back at the bottom of the feed
- Mutual match detection → match celebration modal with AI-generated "why you match" summary
- Push notification sent to matched user

### Projects
- Entrepreneurs create and manage project cards
- Public / private visibility toggle (private projects hidden from investor feed)
- Pitch deck upload (PDF/PPTX) and demo video upload (MP4/MOV) via Cloudinary
- Investors swipe on project cards (separate from person-to-person matching)
- Partner system: invite other entrepreneurs to join a project
- **AI Deck Review** — submit a deck description, get back an overall score (1–10), strengths, weaknesses, and suggestions from Claude

### Messaging
- Chat screen for every mutual match
- Message updates via 15-second polling
- Structured message cards: partner invites, NDA requests, project sharing, meeting proposals
- Date dividers, timestamps, unread blue dot per conversation
- Push notification on new message (real device only)

### NDA System
- Entrepreneur requests NDA via chat
- Investor signs NDA → backend generates a real PDF (pdfkit) with names, project title, standard clauses, and date
- PDF uploaded to Cloudinary; "View NDA Document →" link appears in chat
- After signing, full project details are automatically shared in chat

### Meeting System
- Either party can propose a meeting from any chat (📅 button)
- Meeting types: Virtual (video link) or In-Person (address + Google Maps link)
- Proposal appears as a card in chat; receiver can confirm, decline, or suggest a new time
- **Meeting rescheduling** — "Suggest New Time" pre-fills the proposal form with original details; new proposal sent with roles swapped
- Meetings tab shows all upcoming meetings with status badges
- **AI Due Diligence Briefing** — Claude Haiku generates a 5-section prep report (person summary, match rationale, talking points, questions to ask, watch out for); cached per meeting; daily usage limit enforced

### Premium System
- **Free trial** — "Activate Free Trial (30 days)" button; no real payment required
- **Unlimited swipes** — free users limited to 20 swipes/day; "Go Premium" alert when limit hit
- **Super Like** — ★ star button; shown with badge in the other user's "Who Liked Me" section
- **Who Liked Me** — premium-only section in Matches tab showing users who swiped right on you

### Onboarding Tutorial
- 4-slide walkthrough for first-time users (shown once after role is set)
- Skip button on any slide; "Get Started" on the final slide
- Never shown again after completion

### Push Notifications
- New match and new message alerts when app is backgrounded
- Real physical device required (not simulators)

### File Storage
- All uploads stored on Cloudinary — survives Railway redeploys
- Profile photos, ID docs, pitch decks, demo videos, NDA PDFs

---

## Testing the App

### What you need
- [Node.js](https://nodejs.org) v18 or higher
- [Expo Go](https://expo.dev/go) installed on your phone (Android or iOS)
- Any WiFi or mobile data — **no need to be on the same network as the backend**

### Steps

1. **Clone the repo**
   ```bash
   git clone https://github.com/Verialix996/bizmatch.git
   cd bizmatch
   git checkout main-Ai_integrated
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Start the frontend**
   ```bash
   npx expo start --clear
   ```

4. **Open in Expo Go**
   - Scan the QR code shown in the terminal with the Expo Go app
   - The app connects to the live Railway backend automatically

That's it — no backend setup needed for testing.

### Demo accounts (password: `Demo1234!`)
- Investor: `sarah.chen@bizmatch.app`
- Entrepreneur: `alex.rivera@bizmatch.app`
- See `DEMO_ACCOUNTS.md` for all 50 accounts (gitignored — ask the team)

### Verify the backend is live

```bash
curl https://zooming-surprise-production.up.railway.app/health
```

Expected: `{"status":"ok"}`

---

## Running the Backend Locally (optional)

### Prerequisites
- MySQL installed and running locally
- A database named `bizmatch`

### Setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `mysql://root:<password>@localhost:3306/bizmatch` |
| `JWT_SECRET` | Any long random string |
| `GMAIL_USER` | Your Gmail address |
| `GOOGLE_CLIENT_ID` | OAuth client ID (Gmail API) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | OAuth refresh token |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `ANTHROPIC_API_KEY` | Anthropic API key (AI features) |
| `MAX_DAILY_BRIEFINGS` | Max AI briefings per day (default: 50) |

```bash
npm run dev
```

Server runs on `http://localhost:3000`. Migrations run automatically on startup.

---

## Project Structure

```
bizmatch/
├── backend/
│   ├── migrations/        # MySQL schema files (001–014), auto-run on startup
│   ├── scripts/           # seed.js — rebuilds DB with demo data
│   ├── src/
│   │   ├── config/        # DB, Cloudinary, Passport OAuth
│   │   ├── controllers/   # auth, user, profile, match, message, meeting, project
│   │   ├── middleware/     # auth, upload (Cloudinary multer)
│   │   ├── models/        # match, message, meeting, project
│   │   ├── routes/        # API route definitions
│   │   └── services/      # email (Gmail API), notification (Expo push)
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── navigation/    # AppNavigator (tabs + stacks)
│   │   ├── screens/
│   │   │   ├── auth/      # Login, Register, Verify2FA, ForgotPassword
│   │   │   ├── match/     # SwipeScreen, MatchesScreen, ChatScreen
│   │   │   ├── meeting/   # MeetingScreen, MeetingDetailScreen, ProposeMeetingScreen
│   │   │   ├── onboarding/# OnboardingScreen
│   │   │   ├── premium/   # PremiumScreen
│   │   │   ├── profile/   # ProfileScreen, EditProfile
│   │   │   └── project/   # ProjectsScreen, CreateProject, EditProject
│   │   ├── services/      # API calls (axios)
│   │   └── store/         # Zustand (auth + SecureStore persistence)
│   └── App.js
├── docs/                  # Setup guides + academic files (gitignored)
├── FEATURE_STATUS.md      # Status of every feature
├── TESTING.md             # Manual testing guide
└── systems.md             # Full technical system documentation
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/verify-email` | Verify OTP code |
| POST | `/api/auth/resend-otp` | Resend OTP |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset with token |
| POST | `/api/auth/2fa/setup` | Setup 2FA (returns QR URI) |
| POST | `/api/auth/2fa/verify` | Verify TOTP code |
| GET | `/api/profile` | Get my profile |
| POST | `/api/profile` | Create profile |
| PUT | `/api/profile` | Update profile |
| POST | `/api/profile/upload-id` | Upload ID document |
| GET | `/api/users/me` | Get current user |
| PATCH | `/api/users/me/role` | Switch role |
| POST | `/api/users/me/photo` | Upload profile photo |
| PATCH | `/api/users/me` | Update name |
| PATCH | `/api/users/me/push-token` | Save Expo push token |
| POST | `/api/users/me/verify-self` | Instant self-verification (demo) |
| POST | `/api/users/me/premium/activate` | Activate 30-day free trial |
| GET | `/api/users/me/who-liked-me` | Get users who liked you (premium) |
| DELETE | `/api/users/me` | Delete account |
| GET | `/api/match/feed` | Get AI-scored swipe feed |
| POST | `/api/match/swipe` | Record a swipe (returns match if mutual) |
| GET | `/api/match/matches` | Get all matches |
| GET | `/api/messages` | Get all conversations |
| GET | `/api/messages/:matchId` | Get messages for a match |
| POST | `/api/messages/:matchId` | Send a message |
| POST | `/api/messages/:matchId/invite` | Send partner invite |
| POST | `/api/messages/:matchId/invite/:id/respond` | Accept or decline invite |
| POST | `/api/messages/:matchId/nda-request` | Request NDA signing |
| POST | `/api/messages/:matchId/nda-sign` | Sign NDA (generates PDF) |
| POST | `/api/messages/:matchId/share-project` | Share project details |
| GET | `/api/projects` | Get my projects |
| POST | `/api/projects` | Create a project |
| PUT | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |
| GET | `/api/projects/feed` | Get project feed (investors) |
| POST | `/api/projects/:id/swipe` | Swipe on a project |
| POST | `/api/projects/:id/deck-review` | Get AI feedback on pitch deck |
| POST | `/api/meetings` | Propose a meeting |
| GET | `/api/meetings` | List my meetings |
| PUT | `/api/meetings/:id` | Confirm / decline meeting |
| PATCH | `/api/meetings/:id/reschedule` | Suggest a new meeting time |
| GET | `/api/meetings/:id/briefing` | Get AI due diligence briefing |

---

## Deployment

The backend is deployed on [Railway](https://railway.app) and auto-deploys on every push to `main-Ai_integrated`.

- **Database:** MySQL on Railway — migrations run automatically on startup
- **File storage:** Cloudinary (photos, docs, videos, NDA PDFs)
- **AI:** Anthropic Claude API (`claude-haiku-4-5-20251001`)
- **Node.js service:** root directory `backend/`, start command `node server.js`

## Notes

- Never commit `.env` files
- AI features fail silently when `ANTHROPIC_API_KEY` is missing
- Push notifications only work on real physical devices
- See `FEATURE_STATUS.md` for full feature status
- See `systems.md` for detailed technical documentation
- See `TESTING.md` for manual testing instructions
