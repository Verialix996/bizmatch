# BizMatch — Feature Status

Each system is described with its intended behavior and current implementation state.

---

## 1. Authentication System
**Status:** ✅ Complete

**What's implemented:**
- Email/password registration with bcrypt hashing
- OTP email verification (Gmail API) — new users must verify before logging in
- JWT sessions (7-day tokens), stored via Zustand + SecureStore; persists across app restarts
- Password reset via token-based email link (expires 1 hour)
- Google OAuth (web popup + React Native mobile flow)
- 2FA (TOTP) — speakeasy-based; setup in AccountSettings (`POST /api/auth/2fa/setup` + `POST /api/auth/2fa/verify`); login-time TOTP via `POST /api/auth/2fa/login` (unauthenticated, returns JWT)
- Account deletion (hard delete via `DELETE /api/users/me`)
- Auth persistence: `restoreAuth()` on app mount reads token/user from SecureStore; `isRestoring` state prevents Welcome screen flash
- **has_profile flag** — all auth responses include `has_profile: boolean`; AppNavigator forces profile creation before main tabs
- **Account lockout**: 5 failed login attempts → account locked for 15 minutes; counter resets on success (migration 014)

---

## 2. User & Profile System
**Status:** ✅ Complete

**What's implemented:**
- `users` table: email, name, role, photo, OAuth fields, 2FA, push_token, is_premium, premium_expires_at, login_attempts, locked_until, verification_status
- `profiles` table: role-specific data (entrepreneur: bio, skills, hobbies, venture_stage, funding_needs; investor: bio, investment_domain, preferred_stage, max_investment)
- Role switching (`PATCH /api/users/me/role`)
- Profile photo upload to Cloudinary (`POST /api/users/me/photo`) — accepts base64 data URI JSON; Cloudinary SDK uploads directly (no multer)
- **ID verification bypass**: "Verify Account" button in Account Settings → `POST /api/users/me/verify-self` instantly sets `verification_status = 'verified'` (no admin review needed for demo)
- **Profile completeness score**: progress bar on ProfileScreen (0–100%) calculated from photo, bio length, skills count, and role-specific fields; colour-coded with hints

---

## 3. Matching & Feed System
**Status:** ✅ Complete

**What's implemented:**
- Investor feed: sees entrepreneurs; Entrepreneur "Find Investors": sees investors; Entrepreneur "Find Partners": sees other entrepreneurs
- **AI-primary scoring**: when Claude AI score is cached, it accounts for 60 pts (dominant); stage alignment 0–20 pts + budget fit 0–10 pts as secondary signals; completeness 0–10 pts
- Math-only fallback (no AI score yet): stage 0–40, budget 0–30, Jaccard domain overlap 0–30, completeness 0–10
- **AI background scoring**: Claude Haiku scores each candidate pair 0–100 after first feed load; cached in `ai_match_scores`; feed reranks on next load; cache invalidated on profile update
- Deduplication: liked users excluded; passed users re-queued at bottom
- Mutual match → `matches` row + AI 1-sentence summary + push notification to matched user
- Match modal: "It's a Match!" + AI summary + "Message" button
- Super Like: ★ button sends `is_super_like = 1`; badge shown in "Who Liked Me"
- Daily swipe limit (20 for free users); 429 + `upgradeRequired: true`

---

## 4. Project System
**Status:** ✅ Complete

**What's implemented:**
- CRUD: create, edit, delete, toggle active
- Visibility: `public` (investor feed) vs `private` (hidden)
- Pitch deck upload (PDF only) — stored as `LONGBLOB` in MySQL (`deck_data` column, migration 015); `deck_url` set to sentinel value `'stored'` to preserve UI truthiness checks
- Demo video upload (MP4/MOV) via Cloudinary
- Pitch deck served via backend proxy (`GET /api/projects/:id/deck?token=JWT`) — JWT accepted in query param for direct browser navigation; sets `Content-Type: application/pdf; Content-Disposition: inline`
- Project feed scoring for investors: stage match + budget fit + industry/domain Jaccard + deck/video bonuses
- Partner system: add/remove partners (`project_partners` table)
- **AI Deck Review**: `POST /api/projects/:id/deck-review` → reads PDF bytes from `deck_data` BLOB, base64-encodes, sends to Claude Haiku as a document; returns overallScore (1–10), strengths, weaknesses, suggestions

---

## 5. Messaging System
**Status:** ✅ Complete (polling-based)

**What's implemented:**
- Text messaging between matched users; 15-second polling
- Unread message badge counter; read timestamps per match
- Structured message types: `partner_invite`, `partner_invite_response`, `nda_request`, `nda_signed`, `project_shared`, `meeting_proposal`, `meeting_response`
- Push notification to recipient on new text message

**Known limitation:** Up to 15s message delay (polling, no WebSocket)

---

## 6. NDA System
**Status:** ✅ Complete

**What's implemented:**
- Entrepreneur requests NDA → `nda_request` card in chat
- Investor signs → pdfkit generates real PDF (names, project title, date, standard clauses)
- PDF uploaded to Cloudinary (`bizmatch/ndas/`); `document_url` stored in `project_ndas`
- `nda_signed` card with "View NDA Document →" button (`Linking.openURL`)
- Project details auto-shared in chat after NDA signed

---

## 7. Meeting System
**Status:** ✅ Complete

**What's implemented:**
- Propose a meeting from any chat (📅 button) → `ProposeMeetingScreen`; virtual or in-person
- `meeting_proposal` card in chat; receiver can confirm, decline, or suggest a new time
- **Rescheduling**: "Suggest New Time" → pre-filled form → new proposal with roles swapped (`PATCH /api/meetings/:id/reschedule`)
- `MeetingDetailScreen`: full info, Google Maps link (in-person), "Join Call" (virtual)
- **AI Due Diligence Briefing**: Claude Haiku generates 5-section report (personSummary, matchRationale, talkingPoints, questionsToAsk, watchOutFor); cached per meeting
- **Daily cost limit**: `api_usage` table; 429 when `MAX_DAILY_BRIEFINGS` exceeded

---

## 8. File Storage System
**Status:** ✅ Complete

**What's implemented:**
- Profile photos → Cloudinary (`bizmatch/photos/`), served via CDN URL
- Demo videos → Cloudinary (`bizmatch/videos/`), served via CDN URL
- NDA PDFs → Cloudinary (`bizmatch/ndas/`), served via CDN URL
- **Pitch decks (PDF)** → stored as `LONGBLOB` in MySQL (`projects.deck_data`); Cloudinary free tier blocks raw file CDN delivery; backend proxy endpoint serves bytes directly to browser
- ID documents → Cloudinary (`bizmatch/docs/`), served via CDN URL

---

## 9. AI Features (Anthropic Claude)
**Status:** ✅ Complete

**What's implemented:**
- **Feed ranking**: Claude Haiku scores candidate pairs 0–100 in background; 60-pt primary signal when cached; falls back to math when not yet scored
- **Match summary**: 1-sentence "why you match" on mutual match; shown in match modal and Matches tab
- **Meeting briefing**: 5-section due diligence report; cached per meeting; daily usage limit
- **Deck review**: PDF bytes read from MySQL BLOB, base64-encoded, sent to Claude Haiku as a document; returns structured feedback (overallScore 1–10, strengths, weaknesses, suggestions); handles non-pitch documents by setting score to 1
- **Content moderation**: Claude Haiku screens profile bios, chat messages, and project descriptions for inappropriate content before saving; returns 400 with reason if flagged; fails open when API key missing
- All AI features fail silently when `ANTHROPIC_API_KEY` is missing

---

## 10. Push Notifications
**Status:** ✅ Complete

**What's implemented:**
- Expo push token registered on app startup; saved via `PATCH /api/users/me/push-token`
- Push sent on: new mutual match, new text message
- `notification.service.js` calls Expo Push API

**Known limitation:** Real physical device required (not simulators)

---

## 11. Onboarding Tutorial
**Status:** ✅ Complete

**What's implemented:**
- 4-slide walkthrough shown once after role is set
- Skip on any slide; "Get Started" on final slide
- `hasSeenOnboarding` persisted in SecureStore; never shown again after completion

---

## 12. Premium System
**Status:** ✅ Complete (demo — no real payment)

**What's implemented:**
- 30-day free trial (`POST /api/users/me/premium/activate`)
- Daily swipe limit (20) for free users; "Go Premium" alert on 429
- Super Like (★): `is_super_like = 1` stored; non-premium blocked server-side
- Who Liked Me (`GET /api/users/me/who-liked-me`): premium-gated; ★ badge for super likes
- `PremiumScreen.js`: benefits list + activate button
- "WHO LIKED YOU ★ PREMIUM" section in MatchesScreen

**Known limitation:** No real payment (Stripe/RevenueCat not integrated)

---

## Summary Table

| System | Status |
|--------|--------|
| Authentication | ✅ Complete — lockout after 5 failed attempts |
| User & Profile | ✅ Complete — verify button + completeness score |
| Matching & Feed | ✅ Complete — AI is primary ranking signal (60 pts) |
| Project System | ✅ Complete — PDF in MySQL BLOB, backend proxy, AI deck review |
| Messaging | ✅ Complete — polling (15s delay) |
| NDA System | ✅ Complete |
| Meeting System | ✅ Complete — rescheduling + AI briefing |
| File Storage | ✅ Complete — pitch decks in MySQL, all other files on Cloudinary |
| AI Features | ✅ Complete — scoring, briefing, deck review, moderation, cost control |
| Push Notifications | ✅ Complete — real device only |
| Onboarding Tutorial | ✅ Complete |
| Premium System | ✅ Complete — demo free trial |
