# BizMatch — Feature Status

Each system is described with its intended behavior, what's currently built, and what still needs work.

---

## 1. Authentication System
**Status:** ✅ Complete

**What it should do:** Manage user identity — registration, login, sessions, and account security.

**What's implemented:**
- Email/password registration with bcrypt hashing
- OTP email verification (Gmail API) — new users must verify before logging in
- JWT sessions (7-day tokens), stored via Zustand on the frontend
- Password reset via token-based email link (expires 1 hour)
- Google OAuth (web popup + React Native mobile flow)
- LinkedIn OAuth (routes and passport strategy defined)
- 2FA (TOTP) — speakeasy-based; QR code setup, verification screen (`Verify2FAScreen.js`)
- Account deletion (hard delete via `DELETE /api/users/me`)

**What's missing / needs work:**
- LinkedIn OAuth is untested end-to-end (no live credentials verified)
- No account lockout after failed login attempts

---

## 2. User & Profile System
**Status:** ✅ Complete

**What it should do:** Store and display professional identity for each user, separated by role.

**What's implemented:**
- `users` table: core identity (email, name, role, photo, OAuth fields, 2FA flag)
- `profiles` table: role-specific data (entrepreneur: bio, skills, hobbies, venture_stage, funding_needs; investor: bio, investment_domain, preferred_stage, max_investment)
- Role switching (`PATCH /api/users/me/role`)
- Profile photo upload to Cloudinary (`POST /api/users/me/photo`)
- ID verification — user uploads document, status set to `pending`

**What's missing / needs work:**
- ID verification has no admin review UI — documents sit in `pending` forever
- No profile completeness score shown to the user

---

## 3. Matching & Feed System
**Status:** ✅ Complete

**What it should do:** Show a ranked, deduplicated feed of potential matches based on compatibility, and detect mutual likes.

**What's implemented:**
- Investor feed: sees entrepreneurs, scored by stage alignment (40 pts, graduated), budget fit (30 pts, graduated), domain overlap (30 pts, Jaccard similarity), profile completeness (10 pts)
- Entrepreneur "Find Investors" mode: sees investors
- Entrepreneur "Find Partners" mode: sees other entrepreneurs (shared hobbies +20 each, complementary skills +10 each)
- Deduplication: already-liked users excluded; already-passed users re-queued at bottom
- Mutual match detection: creates row in `matches` table
- AI match summary: Claude generates a 1-sentence "why you match" explanation stored in `matches.ai_summary`; displayed in MatchesScreen
- Match modal on swipe right (shows match, navigates to chat on "Message" tap)

**What's missing / needs work:**
- Scoring weights are hardcoded — they don't adapt based on user swipe behavior
- No "Super Like" feature yet (button exists in UI but does nothing)
- AI summary is generated async — may not appear immediately in match modal

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

**What's missing / needs work:**
- No AI pitch deck review (planned — see AI Features section)
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

**What's missing / needs work:**
- True real-time (WebSocket or Server-Sent Events) — polling creates up to 15s delay
- No typing indicators

---

## 6. NDA System
**Status:** ⚠️ Partial

**What it should do:** Let investors request and sign an NDA before getting access to full project details, with a real signed PDF generated and stored.

**What's implemented:**
- Entrepreneur requests NDA via chat → `nda_request` message card appears
- Investor signs NDA → pdfkit generates a real PDF (names, project title, standard clauses, date)
- PDF uploaded to Cloudinary (`bizmatch/ndas/`)
- `document_url` stored in `project_ndas` table
- `nda_signed` message card sent to chat with downloadable PDF link
- After NDA signed, project details automatically shared in chat

**What's missing / needs work:**
- ~~"View NDA Document" button missing from `nda_signed` chat card~~ — **Fixed:** button now appears in nda_signed card, opens PDF via `Linking.openURL`
- No NDA expiry or revocation mechanism

---

## 7. Meeting System
**Status:** ⚠️ Partial

**What it should do:** Allow either party in a match to propose, confirm, or decline a meeting (virtual or in-person), with AI-generated due diligence preparation.

**What's implemented:**
- Meeting proposal via 📅 button in chat → `ProposeMeetingScreen`
- Date/time picker, virtual (video link) or in-person (address) type
- `meeting_proposal` card in chat; other party sees confirm/decline
- Status: proposed → confirmed / declined / cancelled
- `MeetingDetailScreen`: full meeting info, confirm/decline buttons, Google Maps link for in-person, "Join Call" for virtual
- AI Due Diligence Briefing: `GET /api/meetings/:id/briefing` → Claude Haiku generates JSON report (personSummary, matchRationale, talkingPoints, questionsToAsk, watchOutFor); cached per meeting

**What's missing / needs work:**
- Meeting rescheduling — receiver can only confirm or decline; cannot counter-propose a new time
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
- No file size limits enforced (Cloudinary has limits but app doesn't validate before upload)
- NDA PDFs are publicly accessible by URL — no signed URL protection

---

## 9. AI Features (Anthropic Claude)
**Status:** ⚠️ Partial

**What it should do:** Use AI to explain matches, prepare users for meetings, and review pitch decks.

**What's implemented:**
- **Match summary**: Claude Haiku generates a 1-sentence "why you match" explanation after mutual match; stored in `matches.ai_summary`, shown in MatchesScreen
- **Meeting briefing**: Claude Haiku generates a 5-section JSON report (person summary, match rationale, talking points, questions to ask, watch out for); cached per meeting in `meetings.ai_briefing`
- Both features fail silently when `ANTHROPIC_API_KEY` is missing

**What's missing / needs work:**
- **Pitch deck AI review**: No endpoint to submit a deck summary and get structured feedback (planned: `POST /api/projects/:id/deck-review`)
- **AI cost control**: No daily rate limit on briefing generation — a user could spam the endpoint and rack up API costs
- **Data sanitization**: Profile data sent to Claude is not scrubbed of internal IDs or other sensitive fields before sending

---

## 10. Push Notifications
**Status:** ❌ Not Built

**What it should do:** Notify users of new matches and new messages even when the app is backgrounded or closed.

**What's implemented:**
- In-app badge counter (incremented in MatchesScreen polling loop)

**What's missing / needs work:**
- No push token collection or storage
- No backend notification service
- No Expo push API integration
- **To build:** Register `users.push_token` column (migration 011), add `PATCH /api/users/me/push-token` route, create `notification.service.js` calling Expo Push API, call from `recordSwipe()` (on match) and `sendMessage()` (on new message)

---

## 11. Onboarding Tutorial
**Status:** ❌ Not Built

**What it should do:** Walk first-time users through the app's core concepts (swiping, matching, chat, NDA, meetings) before they reach the main feed.

**What's implemented:**
- Nothing

**What's missing / needs work:**
- `hasSeenOnboarding` flag in authStore (persisted via AsyncStorage)
- `OnboardingScreen.js` — 4–5 slide walkthrough with skip/next/get-started
- Navigation gate in `AppNavigator.js` — show onboarding if authenticated but not seen

---

## 12. Premium System
**Status:** ❌ Not Built

**What it should do:** Offer a paid tier with unlimited swipes, Super Like, and "who liked you" visibility.

**What's implemented:**
- Star button exists in SwipeScreen UI but does nothing

**What's missing / needs work:**
- `is_premium` + `premium_expires_at` columns on `users` table
- `is_super_like` column on `swipes` table
- Daily swipe limit (20 for free users) enforced in `match.controller.js`
- `POST /api/users/me/premium/activate` — demo free trial (no real payment)
- `GET /api/users/me/who-liked-me` — gated behind premium
- `PremiumScreen.js` — benefits list + activate button
- "Upgrade to Premium" banner when swipe limit is hit
- Super Like logic wired to the star button

---

## Summary Table

| System | Status | Priority |
|--------|--------|----------|
| Authentication | ✅ Complete | — |
| User & Profile | ✅ Complete | — |
| Matching & Feed | ✅ Complete | — |
| Project System | ✅ Complete | — |
| Messaging | ✅ Complete (polling) | — |
| NDA System | ✅ Complete | — |
| Meeting System | ⚠️ No rescheduling | Medium |
| File Storage | ✅ Complete | — |
| AI Features | ⚠️ No deck review, no rate limit | Medium |
| Push Notifications | ❌ Not built | High |
| Onboarding Tutorial | ❌ Not built | Medium |
| Premium System | ❌ Not built | Low (demo) |
