# BizMatch — System Overview

## Stack
- **Frontend:** React Native (Expo) — `frontend/`
- **Backend:** Node.js + Express — `backend/`
- **Database:** MySQL (hosted on Railway)
- **File Storage:** Cloudinary (photos, decks, videos, NDA PDFs)
- **AI:** Anthropic Claude API (`claude-haiku-4-5-20251001`) — match summaries, meeting briefings, feed scoring, deck review, content moderation

---

## Authentication System
**Files:** `backend/src/routes/auth.routes.js`, `backend/src/controllers/auth.controller.js`

Handles all identity and session management:
- **Email/password** with bcrypt hashing
- **OTP email verification** — new users must verify before logging in (Gmail API via `backend/src/services/email.service.js`)
- **JWT sessions** — 7-day tokens, stored via Zustand + SecureStore on the frontend (`frontend/src/store/authStore.js`); persists across app restarts via `restoreAuth()` called on mount
- **Google OAuth** — web popup flow + React Native mobile flow (`backend/src/config/passport.js`)
- **2FA (TOTP)** — speakeasy-based; setup returns a QR code, verify sets the flag. Frontend: `frontend/src/screens/auth/Verify2FAScreen.js`
- **Password reset** — token-based email link, expires in 1 hour
- **Account lockout** — 5 consecutive failed login attempts locks the account for 15 minutes; counter resets on successful login. Tracked via `users.login_attempts` + `users.locked_until` (migration 014)
- **Account deletion** — hard delete via `DELETE /api/users/me`

---

## User & Profile System
**Files:** `backend/src/routes/user.routes.js`, `backend/src/routes/profile.routes.js`

Two-layer identity:
- **users table** — core identity (email, name, role, photo, oauth fields, 2FA, push_token, is_premium, premium_expires_at, login_attempts, locked_until, verification_status)
- **profiles table** — role-specific professional data:
  - Entrepreneur: bio, skills (JSON array), hobbies, venture_stage, funding_needs
  - Investor: bio, investment_domain, preferred_stage, max_investment
- **Role switching** — `PATCH /api/users/me/role` (entrepreneur ↔ investor)
- **Profile photo** — uploaded to Cloudinary via `POST /api/users/me/photo`
- **ID verification bypass** — "Verify Account" button in Account Settings calls `POST /api/users/me/verify-self`; instantly sets `verification_status = 'verified'` (no admin review, demo-friendly)
- **Profile completeness score** — progress bar on ProfileScreen (0–100%): photo +20, bio >50 chars +20, skills ≥2 +20, role-specific fields +40; colour-coded (green=100%, blue≥60%, yellow<60%) with inline hints
- **Push token** — saved via `PATCH /api/users/me/push-token` on app startup

---

## Matching & Feed System
**Files:** `backend/src/models/match.model.js`, `backend/src/controllers/match.controller.js`

The core "Tinder" mechanic:

**Feed modes:**
- Investor → sees entrepreneurs (scored by investor-entrepreneur algorithm)
- Entrepreneur (Find Investors) → sees investors
- Entrepreneur (Find Partners) → sees other entrepreneurs

**Scoring algorithm — AI primary (when cached):**
| Factor | Max Points | Logic |
|--------|-----------|-------|
| AI semantic score | 60 | Claude Haiku rates compatibility 0–100; dominant signal when cached |
| Stage alignment | 20 | Secondary when AI cached (scaled from 40-pt raw score) |
| Budget fit | 10 | Secondary when AI cached (scaled from 30-pt raw score) |
| Profile completeness | 10 | +3 photo, +4 bio>50chars, +3 skills≥2 |

**Math-only fallback (when AI score not yet cached):**
| Factor | Max Points |
|--------|-----------|
| Stage alignment | 40 |
| Budget fit | 30 |
| Domain/skill overlap (Jaccard) | 30 |
| Profile completeness | 10 |

**Entrepreneur↔entrepreneur scoring:**
- When AI cached: 60 pts (primary) + profile completeness 10 pts
- Math fallback: hobby overlap (×20 per shared hobby) + complementary skills (×10 each) + completeness 10 pts

**AI background scoring (`computeAiScores()`):**
- After `getFeed()` returns, Claude Haiku scores each uncached candidate pair in parallel (`Promise.allSettled`)
- Scores cached in `ai_match_scores` table (user_id + candidate_id composite key)
- Subsequent feed loads use cached scores for ranking — Claude never called twice for the same pair
- Cache invalidated when user updates profile (`DELETE FROM ai_match_scores WHERE user_id = ? OR candidate_id = ?`)

**Deduplication:** Already-liked users excluded from feed. Already-passed users shown at the bottom. Re-swiping updates the existing record.

**Mutual match:** When both users like each other → row inserted in `matches` table → Claude Haiku generates a 1-sentence match summary async (stored in `matches.ai_summary`) → push notification sent to matched user.

**Premium & swipe limits:**
- Free users: 20 swipes/day enforced server-side; 429 + `{ upgradeRequired: true }` returned
- Premium users: unlimited swipes; Super Like (`is_super_like = 1` on swipe record)
- Super Like shown with ★ badge in "Who Liked Me" section

---

## Project System
**Files:** `backend/src/models/project.model.js`, `backend/src/controllers/project.controller.js`

Entrepreneurs create project cards that investors can browse and swipe on — separate from person-to-person matching.

- **CRUD:** Create, edit, delete, toggle active
- **Visibility:** `public` (appears in investor feed) vs `private` (hidden)
- **Uploads:** pitch deck (PDF/PPTX via Cloudinary), demo video (MP4/MOV via Cloudinary)
- **Project feed scoring (investor side, 0–100 pts):**
  - Stage match: graduated
  - Budget fit: graduated
  - Industry↔domain overlap: Jaccard
  - Deck present: +10, Video present: +10
- **Partners:** Entrepreneurs can add/remove partners from a project (`project_partners` table)
- **AI Deck Review:** `POST /api/projects/:id/deck-review { deckSummary }` → Claude Haiku returns JSON (overallScore 1–10, strengths, weaknesses, suggestions)

---

## Messaging System
**Files:** `backend/src/models/message.model.js`, `backend/src/controllers/message.controller.js`

Real-time-like chat per match (polling-based, 15s interval):

**Message types:**
| type | Description |
|------|-------------|
| `text` | Normal chat message — triggers push notification to recipient |
| `partner_invite` | Entrepreneur invites investor to join a project |
| `partner_invite_response` | Accepted or declined |
| `nda_request` | Investor requests NDA signing for a project |
| `nda_signed` | Signer confirmed; PDF link included |
| `project_shared` | Full project details shared after NDA |
| `meeting_proposal` | Meeting proposed via the meeting system |
| `meeting_response` | Confirmed / declined / cancelled / rescheduled |

---

## NDA System
**Files:** `backend/src/controllers/message.controller.js` (requestNda, signNda)

Lightweight legal flow within a chat:
1. Entrepreneur requests NDA → `POST /api/messages/:matchId/nda-request { projectId }`
2. Other party signs → `POST /api/messages/:matchId/nda-sign { projectId }`
   - Backend generates a PDF NDA using `pdfkit` (names, project title, date, standard clauses)
   - PDF uploaded to Cloudinary (`bizmatch/ndas/`)
   - `document_url` stored in `project_ndas` table
   - `nda_signed` message sent to chat with "View NDA Document →" button (`Linking.openURL`)
3. After NDA signed, project details are automatically shared in chat

---

## Meeting System
**Files:** `backend/src/models/meeting.model.js`, `backend/src/controllers/meeting.controller.js`, `backend/src/routes/meeting.routes.js`
**Frontend:** `frontend/src/screens/meeting/`

Enables either party in a match to schedule or reschedule a meeting:

**Types:** Virtual (video link) or In-Person (address, Google Maps link)

**Flow:**
1. Tap the 📅 button in any chat → `ProposeMeetingScreen`
2. Fill in title, date/time, type (virtual/in-person), link or address
3. A `meeting_proposal` card appears in chat
4. Receiver confirms, declines, or suggests a new time from `MeetingDetailScreen`
5. **Rescheduling:** "Suggest New Time" → `ProposeMeetingScreen` pre-filled → new proposal sent with roles swapped (`PATCH /api/meetings/:id/reschedule`)

**AI Due Diligence Briefing:**
- Available from `MeetingDetailScreen` → "Get AI Briefing" button
- Calls `GET /api/meetings/:id/briefing`
- Claude Haiku generates a JSON report: personSummary, matchRationale, talkingPoints, questionsToAsk, watchOutFor
- Result cached in `meetings.ai_briefing` — only generated once per meeting
- Daily cost limit: `api_usage` table tracks briefing count per day; 429 returned when `MAX_DAILY_BRIEFINGS` env var exceeded

---

## Push Notification System
**Files:** `backend/src/services/notification.service.js`, `frontend/App.js`

- App registers for push permissions on startup; Expo push token saved via `PATCH /api/users/me/push-token`
- Token stored in `users.push_token`
- `sendPushNotification(userId, title, body, data)` calls Expo Push API (`https://exp.host/--/api/v2/push/send`)
- Triggered on: new mutual match (from `recordSwipe()`), new text message (from `sendMessage()`)
- Only works on real physical devices (not simulators)

---

## Onboarding System
**Files:** `frontend/src/screens/onboarding/OnboardingScreen.js`, `frontend/src/navigation/AppNavigator.js`

- 4-slide walkthrough shown to first-time users after role is set
- `hasSeenOnboarding` persisted in SecureStore via authStore
- Navigation gate: `token && user.role && !hasSeenOnboarding → OnboardingScreen`
- Skip button on slides 1–3; "Get Started" on slide 4
- Never shown again once completed or skipped

---

## Premium System
**Files:** `backend/src/controllers/user.controller.js`, `frontend/src/screens/premium/PremiumScreen.js`

- **Activate:** `POST /api/users/me/premium/activate` → sets `is_premium=1`, `premium_expires_at = NOW() + 30 days`
- **Swipe limit:** 20 swipes/day for free users; checked server-side in `match.controller.js`
- **Super Like:** star button in SwipeScreen; `is_super_like = 1` stored in swipes table; non-premium blocked server-side
- **Who Liked Me:** `GET /api/users/me/who-liked-me` — returns users who swiped like; 403 if not premium
- **UI:** Benefits list (Unlimited Swipes, Super Like, Who Liked You) + "Activate Free Trial (30 days)" button
- **MatchesScreen:** "WHO LIKED YOU ★ PREMIUM" section shows bubbles with ★ badge for Super Likes

---

## AI Moderation System
**File:** `backend/src/services/moderation.service.js`

Screens user-generated text content with Claude Haiku before it is saved to the database.

**What is moderated:**
| Content | Endpoint |
|---------|---------|
| Profile bio | `POST /api/profile` and `PUT /api/profile` |
| Chat messages | `POST /api/messages/:matchId` |
| Project description | `POST /api/projects` and `PUT /api/projects/:id` |

**Behaviour:**
- Sends the text to Claude Haiku with a business-context prompt — only clearly inappropriate content (hate speech, threats, sexual content, obvious spam) is rejected; normal business language always passes
- Returns HTTP 400 with a user-facing error message if flagged: `"Bio flagged by moderation: <reason>"`
- **Fails open** — if `ANTHROPIC_API_KEY` is missing or Claude returns an error, content is allowed through; moderation never blocks users due to an AI outage

---

## File Storage System
**Files:** `backend/src/config/cloudinary.js`, `backend/src/middleware/upload.js`

All file uploads go to Cloudinary (not local disk — Railway's filesystem is ephemeral):

| Upload type | Field name | Folder | Formats |
|-------------|-----------|--------|---------|
| Profile photo | `photo` | `bizmatch/photos` | jpg, jpeg, png |
| ID document | `document` | `bizmatch/docs` | jpg, jpeg, png, pdf |
| Pitch deck | `deck` | `bizmatch/docs` | pdf, pptx, ppt |
| Demo video | `video` | `bizmatch/videos` | mp4, mov |
| NDA PDF | (server-generated) | `bizmatch/ndas` | pdf |

Files are served directly via Cloudinary CDN URLs (no `/uploads` route on the backend).

---

## Database Migrations
Located in `backend/migrations/` — auto-run on server startup via `migrations/run.js` (tracked in `schema_migrations` table):

| File | Contents |
|------|---------|
| 001 | users table |
| 002 | profiles table |
| 003 | swipes + matches tables |
| 004 | messages table |
| 005 | projects + project_swipes + project_matches |
| 006 | project_partners |
| 007 | NDA visibility, partner_invitations, message types |
| 008 | matches.ai_summary column |
| 009 | project_ndas.document_url column |
| 010 | meetings table |
| 011 | api_usage table + users.push_token column |
| 012 | users.is_premium, users.premium_expires_at, swipes.is_super_like |
| 013 | ai_match_scores table |
| 014 | users.login_attempts, users.locked_until (account lockout) |

To rebuild from scratch: `node backend/scripts/seed.js` (drops all tables, reruns all migrations, seeds 25 investors + 25 entrepreneurs).
