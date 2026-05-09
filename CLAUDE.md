# BizMatch — Claude Code Context

## Project
Tinder-style matchmaking platform for entrepreneurs & investors. College project (Accelerator Program - Innovation 2B).

- **Frontend:** React Native (Expo) — `frontend/`
- **Backend:** Node.js + Express — `backend/`
- **DB:** MySQL on Railway
- **File storage:** Cloudinary (photos, decks, videos, NDA PDFs)
- **AI:** Anthropic Claude API (`claude-haiku-4-5-20251001`)
- **Deploy:** Railway, branch `main-Ai_integrated` (DO NOT touch `master`)

## Active Branch
`main-Ai_integrated` — Railway auto-deploys from this branch. Never push to `master`.

## What's Done (Phase 1 — complete)
- Cloudinary file storage replacing Railway disk (`backend/src/config/cloudinary.js`, `backend/src/middleware/upload.js`)
- Project visibility enforcement in investor feed
- 2FA frontend screen (`frontend/src/screens/auth/Verify2FAScreen.js`)
- Upgraded matching algorithm (graduated scoring + Jaccard similarity) — `backend/src/models/match.model.js`
- AI match summary — Claude generates 1-sentence summary on mutual match, stored in `matches.ai_summary`
- NDA PDF generation via pdfkit + Cloudinary upload — `backend/src/controllers/message.controller.js`
- Full meeting system — `backend/src/models/meeting.model.js`, `backend/src/controllers/meeting.controller.js`, `backend/src/routes/meeting.routes.js`, `frontend/src/screens/meeting/`
- AI due diligence briefing — `GET /api/meetings/:id/briefing` → Claude Haiku JSON report
- Migrations 008 (matches.ai_summary), 009 (project_ndas.document_url), 010 (meetings table) — already run on Railway

## What's Done (Phase 2 — quick wins complete)
- NDA "View PDF" button — added to `nda_signed` chat card in `ChatScreen.js`
- AI match summary — added `ai_summary` to conversations query (`message.model.js`); shown in `MatchesScreen.js` for new matches
- Auto-open chat on match — was already implemented in `SwipeScreen.js` `onMessage` handler
- `FEATURE_STATUS.md` — created at project root covering all 12 systems

## What's Left (Phase 2 — remaining)
Priority order:
1. **AI cost control** — `backend/src/controllers/meeting.controller.js` `briefing()`: add daily limit counter via `api_usage` table + `MAX_DAILY_BRIEFINGS` env var
2. **Pitch deck AI review** — `POST /api/projects/:id/deck-review { deckSummary }` → Claude Haiku JSON feedback (strengths, weaknesses, suggestions, overallScore)
3. **Push notifications** — migration 011 (`users.push_token`), `PATCH /api/users/me/push-token`, `notification.service.js`, Expo push API calls from `recordSwipe()` + `sendMessage()`
4. **Meeting rescheduling** — `PATCH /api/meetings/:id/reschedule` backend + "Suggest New Time" UI in `MeetingDetailScreen.js`
5. **Onboarding tutorial** — `frontend/src/screens/onboarding/OnboardingScreen.js`, `hasSeenOnboarding` in authStore, gate in `AppNavigator.js`
6. **Premium system** — swipe limits, Super Like, who-liked-you (demo: free trial button, no real payment)

## Key Files
| File | Purpose |
|------|---------|
| `backend/src/models/match.model.js` | Scoring algorithm + AI match summary |
| `backend/src/controllers/meeting.controller.js` | Meeting CRUD + AI briefing |
| `backend/src/controllers/message.controller.js` | NDA PDF generation + partner invites |
| `frontend/src/screens/match/SwipeScreen.js` | Swipe feed + match modal |
| `frontend/src/screens/match/ChatScreen.js` | Chat UI + message type renderers |
| `frontend/src/navigation/AppNavigator.js` | All screen registrations + tabs |
| `backend/src/middleware/upload.js` | Centralized multer-Cloudinary middleware |
| `backend/migrations/` | SQL migrations 001–010 |

## Critical Notes
- `upload` in `profile.routes.js` is already a pre-configured middleware — do NOT call `.single()` on it again (caused a production crash)
- All migrations must be run manually on Railway MySQL after deploy
- AI features fail silently when `ANTHROPIC_API_KEY` is missing — check Railway env vars
- `systems.md` at project root has full system documentation
- `docs/` folder is gitignored — academic Excel/PDF files live there
