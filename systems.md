# BizMatch — System Overview

## Stack
- **Frontend:** React Native (Expo) — `frontend/`
- **Backend:** Node.js + Express — `backend/`
- **Database:** MySQL (hosted on Railway)
- **File Storage:** Cloudinary (photos, decks, videos, NDA PDFs)
- **AI:** Anthropic Claude API (match summaries, meeting briefings)

---

## Authentication System
**Files:** `backend/src/routes/auth.routes.js`, `backend/src/controllers/auth.controller.js`

Handles all identity and session management:
- **Email/password** with bcrypt hashing
- **OTP email verification** — new users must verify before logging in (Gmail API via `backend/src/services/email.service.js`)
- **JWT sessions** — 7-day tokens, stored in Zustand on the frontend (`frontend/src/store/authStore.js`)
- **Google OAuth** — web popup flow + React Native mobile flow (`backend/src/config/passport.js`)
- **LinkedIn OAuth** — same flow as Google
- **2FA (TOTP)** — speakeasy-based; setup returns a QR code, verify sets the flag. Frontend: `frontend/src/screens/auth/Verify2FAScreen.js`
- **Password reset** — token-based email link, expires in 1 hour
- **Account deletion** — hard delete via `DELETE /api/users/me`

---

## User & Profile System
**Files:** `backend/src/routes/user.routes.js`, `backend/src/routes/profile.routes.js`

Two-layer identity:
- **users table** — core identity (email, name, role, photo, oauth fields, 2FA)
- **profiles table** — role-specific professional data:
  - Entrepreneur: bio, skills (JSON array), hobbies, venture_stage, funding_needs
  - Investor: bio, investment_domain, preferred_stage, max_investment
- **Role switching** — `PATCH /api/users/me/role` (entrepreneur ↔ investor)
- **Profile photo** — uploaded to Cloudinary via `POST /api/users/me/photo`
- **ID verification** — user uploads document → status set to 'pending' (`POST /api/profile/upload-id`)

---

## Matching & Feed System
**Files:** `backend/src/models/match.model.js`, `backend/src/controllers/match.controller.js`

The core "Tinder" mechanic:

**Feed modes:**
- Investor → sees entrepreneurs (scored by investor-entrepreneur algorithm)
- Entrepreneur (Find Investors) → sees investors
- Entrepreneur (Find Partners) → sees other entrepreneurs

**Scoring algorithm (investor↔entrepreneur, 0–110 pts max):**
| Factor | Max Points | Logic |
|--------|-----------|-------|
| Stage alignment | 40 | Graduated: exact=40, 1 step=20, 2 steps=5 |
| Budget fit | 30 | Graduated: ≥100%=30, ≥75%=20, ≥50%=10 |
| Domain overlap | 30 | Jaccard similarity between investment_domain and entrepreneur bio+skills |
| Profile completeness | 10 | +3 photo, +4 bio>50chars, +3 skills≥2 |

**Entrepreneur↔entrepreneur scoring:**
- Shared hobbies: +20 each
- Complementary skills (what B has that A lacks): +10 each
- Profile completeness: +10

**Deduplication:** Already-liked users are excluded from feed. Already-passed users are shown at the bottom (re-queued). Re-swiping updates the existing record.

**Mutual match:** When both users like each other → row inserted in `matches` table → Claude AI generates a 1-sentence match summary (async, stored in `matches.ai_summary`).

---

## Project System
**Files:** `backend/src/models/project.model.js`, `backend/src/controllers/project.controller.js`

Entrepreneurs create project cards that investors can browse and swipe on — separate from person-to-person matching.

- **CRUD:** Create, edit, delete, toggle active
- **Visibility:** `public` (appears in investor feed) vs `private` (hidden)
- **Uploads:** pitch deck (PDF/PPTX via Cloudinary), demo video (MP4/MOV via Cloudinary)
- **Project feed scoring (investor side, 0–100 pts):**
  - Stage match: graduated (same as above)
  - Budget fit: graduated
  - Industry↔domain overlap: Jaccard
  - Deck present: +10, Video present: +10
- **Partners:** Entrepreneurs can add/remove partners from a project (`project_partners` table)

---

## Messaging System
**Files:** `backend/src/models/message.model.js`, `backend/src/controllers/message.controller.js`

Real-time-like chat per match (polling-based, 15s interval):

**Message types:**
| type | Description |
|------|-------------|
| `text` | Normal chat message |
| `partner_invite` | Entrepreneur invites investor to join a project |
| `partner_invite_response` | Accepted or declined |
| `nda_request` | Investor requests NDA signing for a project |
| `nda_signed` | Signer confirmed; PDF link included |
| `project_shared` | Full project details shared after NDA |
| `meeting_proposal` | Meeting proposed via the meeting system |
| `meeting_response` | Confirmed / declined / cancelled |

---

## NDA System
**Files:** `backend/src/controllers/message.controller.js` (requestNda, signNda)

Lightweight legal flow within a chat:
1. Entrepreneur requests NDA → `POST /api/messages/:matchId/nda-request { projectId }`
2. Other party signs → `POST /api/messages/:matchId/nda-sign { projectId }`
   - Backend generates a PDF NDA using `pdfkit` (names, project title, date, standard clauses)
   - PDF uploaded to Cloudinary (`bizmatch/ndas/`)
   - `document_url` stored in `project_ndas` table
   - Signed NDA message sent to chat with downloadable PDF link
3. After NDA signed, project details are automatically shared in chat

---

## Meeting System (New)
**Files:** `backend/src/models/meeting.model.js`, `backend/src/controllers/meeting.controller.js`, `backend/src/routes/meeting.routes.js`
**Frontend:** `frontend/src/screens/meeting/`

Enables either party in a match to schedule a meeting:

**Types:** Virtual (video link) or In-Person (address, Google Maps link)

**Flow:**
1. Tap the 📅 button in any chat → `ProposeMeetingScreen`
2. Fill in title, date/time, type (virtual/in-person), link or address
3. A `meeting_proposal` card appears in chat; other party gets a notification card
4. Receiver confirms or declines from `MeetingDetailScreen`
5. Status updates propagate back to chat as a `meeting_response` card

**AI Due Diligence Briefing:**
- Available from `MeetingDetailScreen` → "Get AI Briefing" button
- Calls `GET /api/meetings/:id/briefing`
- Claude (Haiku model) generates a JSON report:
  - Person summary
  - Match rationale
  - Talking points (3–4 items)
  - Questions to ask (3–4 items)
  - Watch out for (2–3 items)
- Result cached in `meetings.ai_briefing` — only generated once per meeting

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

## AI System (Anthropic Claude)
**Used in:**
- `backend/src/models/match.model.js` — `generateMatchSummary()` — runs on mutual match
- `backend/src/controllers/meeting.controller.js` — `briefing()` — runs on demand

Both use the `claude-haiku-4-5-20251001` model for cost efficiency. The `ANTHROPIC_API_KEY` env var must be set. If it's not set, both features silently skip (no crash).

---

## Database Migrations
Located in `backend/migrations/` — run in order (001 → 010):

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
