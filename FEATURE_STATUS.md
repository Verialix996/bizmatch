# BizMatch — Feature Status

Each system is described with its intended behavior, what's currently built, and what still needs work.

---

## 1. Authentication System
**Status:** ✅ Complete

**What it should do:** Manage user identity — registration, login, sessions, and account security.

**What's implemented:**
- Email/password registration with bcrypt hashing
- OTP email verification (Gmail API) — new users must verify before logging in
- JWT sessions (7-day tokens), stored via Zustand + SecureStore on the frontend (persists across app restarts)
- Password reset via token-based email link (expires 1 hour)
- Google OAuth (web popup + React Native mobile flow)
- LinkedIn OAuth (routes and passport strategy defined)
- 2FA (TOTP) — speakeasy-based; QR code setup, verification screen (`Verify2FAScreen.js`)
- Account deletion (hard delete via `DELETE /api/users/me`)
- Auth persistence fix: `restoreAuth()` called on app mount, token/user read from SecureStore

**What's missing / needs work:**
- LinkedIn OAuth intentionally removed from scope
- Account lockout: locks after 5 failed attempts for 15 minutes ✅ (migration 014)

---

## 2. User & Profile System
**Status:** ✅ Complete

**What it should do:** Store and display professional identity for each user, separated by role.

**What's implemented:**
- `users` table: core identity (email, name, role, photo, OAuth fields, 2FA flag, push_token, is_premium, premium_expires_at)
- `profiles` table: role-specific data (entrepreneur: bio, skills, hobbies, venture_stage, funding_needs; investor: bio, investment_domain, preferred_stage, max_investment)
- Role switching (`PATCH /api/users/me/role`)
- Profile photo upload to Cloudinary (`POST /api/users/me/photo`)
- ID verification — user uploads document, status set to `pending`

**What's missing / needs work:**
- ID verification: "Verify Account" button in Account Settings instantly sets status to `verified` (no admin review needed for demo) ✅
- Profile completeness score: progress bar shown on ProfileScreen with hints ✅

---

## 3. Matching & Feed System
**Status:** ✅ Complete

**What it should do:** Show a ranked, deduplicated feed of potential matches based on compatibility, and detect mutual likes.

**What's implemented:**
- Investor feed: sees entrepreneurs, scored by stage alignment (40 pts), budget fit (30 pts), AI semantic score (30 pts), profile completeness (10 pts)
- Entrepreneur "Find Investors" mode: sees investors with same scoring
- Entrepreneur "Find Partners" mode: sees other entrepreneurs, AI-scored for collaboration potential
- Deduplication: already-liked users excluded; already-passed users re-queued at bottom
- Mutual match detection: creates row in `matches` table
- AI match summary: Claude Haiku generates a 1-sentence "why you match" explanation stored in `matches.ai_summary`; displayed in MatchesScreen and match modal
- Match modal on swipe right (shows match + AI summary, navigates to chat on "Message" tap)
- **AI-driven background scoring**: Claude Haiku scores each candidate pair 0–100 in the background after the first feed load; cached in `ai_match_scores` table; replaces Jaccard on subsequent loads; invalidated when user updates profile
- Super Like: star button sends `is_super_like = 1` to DB; shown with ★ badge in "Who Liked Me" section
- Daily swipe limit (20 for free users) enforced server-side; 429 response with `upgradeRequired: true`
- Push notification sent to matched user on mutual match

**What's missing / needs work:**
- AI is now the primary ranking signal (60 pts when available vs 30 pts for math components) ✅
- AI summary may not appear immediately in match modal (generated async)

---

## 4. Project System
**Status:** ✅ Complete

**What it should do:** Allow entrepreneurs to create project cards (pitch decks, demo videos) that investors can browse and swipe on separately from person-to-person matching.

**What's implemented:**
- CRUD: create, edit, delete, toggle active
- Visibility: `public` (appears in investor feed) vs `private` (hidden)
- Pitch deck upload (PDF/PPTX) to Cloudinary
- Demo video upload (MP4/MOV) to Cloudinary
- Project feed scoring for investors: stage match, budget fit, industry/domain overlap (Jaccard), deck/video presence bonuses
- Partner system: entrepreneurs can add/remove partners from a project (`project_partners` table)
- AI Deck Review: `POST /api/projects/:id/deck-review { deckSummary }` → Claude Haiku returns JSON (overallScore, strengths, weaknesses, suggestions); rendered in modal on ProjectDetailScreen

**What's missing / needs work:**
- No analytics showing how many investors viewed or liked a project

---

## 5. Messaging System
**Status:** ✅ Complete (polling-based)

**What it should do:** Enable real-time chat between matched users, supporting structured message types for business workflows.

**What's implemented:**
- Text messaging between matched users
- Polling at 15-second intervals (no WebSocket)
- Unread message badge counter
- Special message types: `partner_invite`, `partner_invite_response`, `nda_request`, `nda_signed`, `project_shared`, `meeting_proposal`, `meeting_response`
- Read timestamps tracked per match
- Push notification sent to recipient on new text message

**What's missing / needs work:**
- True real-time (WebSocket or Server-Sent Events) — polling creates up to 15s delay
- No typing indicators

---

## 6. NDA System
**Status:** ✅ Complete

**What it should do:** Let investors request and sign an NDA before getting access to full project details, with a real signed PDF generated and stored.

**What's implemented:**
- Entrepreneur requests NDA via chat → `nda_request` message card appears
- Investor signs NDA → pdfkit generates a real PDF (names, project title, standard clauses, date)
- PDF uploaded to Cloudinary (`bizmatch/ndas/`)
- `document_url` stored in `project_ndas` table
- `nda_signed` message card sent to chat with "View NDA Document →" button (opens PDF via `Linking.openURL`)
- After NDA signed, project details automatically shared in chat

**What's missing / needs work:**
- No NDA expiry or revocation mechanism

---

## 7. Meeting System
**Status:** ✅ Complete

**What it should do:** Allow either party in a match to propose, confirm, decline, or reschedule a meeting (virtual or in-person), with AI-generated due diligence preparation.

**What's implemented:**
- Meeting proposal via 📅 button in chat → `ProposeMeetingScreen`
- Date/time picker, virtual (video link) or in-person (address) type
- `meeting_proposal` card in chat; other party sees confirm/decline
- Status: proposed → confirmed / declined / cancelled
- `MeetingDetailScreen`: full meeting info, confirm/decline buttons, Google Maps link for in-person, "Join Call" for virtual
- **Meeting rescheduling**: receiver can tap "Suggest New Time" → `ProposeMeetingScreen` pre-filled with original details → new proposal sent with roles swapped; `PATCH /api/meetings/:id/reschedule`
- AI Due Diligence Briefing: `GET /api/meetings/:id/briefing` → Claude Haiku generates JSON report (personSummary, matchRationale, talkingPoints, questionsToAsk, watchOutFor); cached per meeting in `meetings.ai_briefing`
- AI briefing daily cost limit: `api_usage` table tracks daily briefing count; 429 returned when `MAX_DAILY_BRIEFINGS` exceeded

**What's missing / needs work:**
- No calendar integration (iCal/Google Calendar export)
- No reminder notifications before meeting time

---

## 8. File Storage System
**Status:** ✅ Complete

**What it should do:** Persistently store all uploaded files (photos, documents, videos, PDFs) so they survive Railway redeploys.

**What's implemented:**
- All file uploads routed to Cloudinary (replaces Railway ephemeral disk)
- Profile photos → `bizmatch/photos/`
- ID documents, pitch decks → `bizmatch/docs/`
- Demo videos → `bizmatch/videos/`
- NDA PDFs (server-generated) → `bizmatch/ndas/`
- Files served directly via Cloudinary CDN URLs

**What's missing / needs work:**
- No file size limits enforced client-side before upload
- NDA PDFs are publicly accessible by URL — no signed URL protection

---

## 9. AI Features (Anthropic Claude)
**Status:** ✅ Complete

**What it should do:** Use AI to explain matches, prepare users for meetings, review pitch decks, and drive feed ranking.

**What's implemented:**
- **Match summary**: Claude Haiku generates a 1-sentence "why you match" explanation after mutual match; stored in `matches.ai_summary`, shown in MatchesScreen and match modal
- **Meeting briefing**: Claude Haiku generates a 5-section JSON report (person summary, match rationale, talking points, questions to ask, watch out for); cached per meeting in `meetings.ai_briefing`
- **AI cost control**: `api_usage` table tracks daily briefing count; configurable `MAX_DAILY_BRIEFINGS` env var; 429 with clear message when limit hit
- **AI-driven feed ranking**: Claude Haiku scores candidate pairs 0–100 in background after first feed load; cached in `ai_match_scores`; used to rerank feed on subsequent loads; invalidated on profile update
- **Pitch deck AI review**: `POST /api/projects/:id/deck-review` accepts a text deck summary → Claude returns overallScore (1–10), strengths, weaknesses, suggestions
- All AI features fail silently when `ANTHROPIC_API_KEY` is missing

**What's missing / needs work:**
- Profile data sent to Claude is not scrubbed of internal IDs before sending

---

## 10. Push Notifications
**Status:** ✅ Complete

**What it should do:** Notify users of new matches and new messages even when the app is backgrounded or closed.

**What's implemented:**
- `push_token` column on `users` table (migration 011)
- `PATCH /api/users/me/push-token` — saves Expo push token to DB
- `notification.service.js` — calls Expo Push API (`https://exp.host/--/api/v2/push/send`)
- Push sent on new mutual match (from `recordSwipe()`)
- Push sent on new text message (from `sendMessage()`)
- App registers for push permissions on startup (`App.js`); token saved to backend automatically

**What's missing / needs work:**
- Only works on real physical devices (not simulators)

---

## 11. Onboarding Tutorial
**Status:** ✅ Complete

**What it should do:** Walk first-time users through the app's core concepts before they reach the main feed.

**What's implemented:**
- `hasSeenOnboarding` flag in authStore, persisted via SecureStore
- `OnboardingScreen.js` — 4-slide walkthrough (Discover, Match, Chat & NDAs, Schedule Meetings)
- Skip button on slides 1–3; "Get Started" on final slide
- Navigation gate in `AppNavigator.js` — shows onboarding if authenticated + role set + not yet seen
- One-time only: flag set on completion or skip; never shown again

**What's missing / needs work:**
- Nothing

---

## 12. Premium System
**Status:** ✅ Complete (demo — no real payment)

**What it should do:** Offer a paid tier with unlimited swipes, Super Like, and "who liked you" visibility.

**What's implemented:**
- `is_premium` + `premium_expires_at` columns on `users` table (migration 012)
- `is_super_like` column on `swipes` table (migration 012)
- Daily swipe limit (20) enforced server-side for free users; 429 + `upgradeRequired: true` returned
- `POST /api/users/me/premium/activate` — activates 30-day free trial (sets `is_premium=1`, `premium_expires_at = NOW() + 30 days`)
- `GET /api/users/me/who-liked-me` — gated behind premium check server-side; returns users who swiped right
- `PremiumScreen.js` — benefits list (Unlimited Swipes, Super Like, Who Liked You) + "Activate Free Trial" button
- "Who Liked Me" section in MatchesScreen — shows bubbles with ★ badge for Super Likes (premium users only)
- Super Like: star button in SwipeScreen wired up; `is_super_like = 1` stored in DB; non-premium users cannot bypass (server-side check)
- "Go Premium" alert shown when free swipe limit hit

**What's missing / needs work:**
- No real payment integration (Stripe / RevenueCat)
- Premium expiry not enforced in real-time (checked on each API call but no cron to downgrade expired users)

---

## Summary Table

| System | Status | Notes |
|--------|--------|-------|
| Authentication | ✅ Complete | Auth persistence fixed via SecureStore |
| User & Profile | ✅ Complete | — |
| Matching & Feed | ✅ Complete | AI-driven background scoring added |
| Project System | ✅ Complete | AI deck review added |
| Messaging | ✅ Complete (polling) | — |
| NDA System | ✅ Complete | PDF view button added |
| Meeting System | ✅ Complete | Rescheduling + AI briefing cost limit added |
| File Storage | ✅ Complete | — |
| AI Features | ✅ Complete | Scoring, briefing, deck review, cost control |
| Push Notifications | ✅ Complete | Real device only |
| Onboarding Tutorial | ✅ Complete | — |
| Premium System | ✅ Complete | Demo free trial, no real payment |
