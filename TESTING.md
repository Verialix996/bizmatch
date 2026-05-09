# BizMatch — Manual Testing Guide

## Setup

- Expo Go installed on device(s)
- Backend running on Railway (`main-Ai_integrated` branch)
- Run `npx expo start` in `frontend/`, scan QR with Expo Go

### Test Accounts (run `node scripts/demo.js` on Railway to create)

| Account | Email | Password | Role | State |
|---------|-------|----------|------|-------|
| **A** | test.investor@bizmatch.app | Test1234! | Investor | Premium, matched with B (8 messages) |
| **B** | test.entrepreneur@bizmatch.app | Test1234! | Entrepreneur | Project: TeamSync, matched with A + C |
| **C** | test.entrepreneur2@bizmatch.app | Test1234! | Entrepreneur | Project: VitalBand, matched with B |
| **D** | test.investor2@bizmatch.app | Test1234! | Investor | Fresh — no matches |

---

## Section 1 — New Account (Single User Flow)

### 1.1 Registration

1. Open app → tap "Get Started" → tap "Register"
2. Enter name, email → try a weak password (e.g. `abc123`) → submit
3. **Expected:** Error — "Password must be at least 8 characters"
4. Try `abc1234` (7 chars) → **Expected:** same error
5. Enter a valid password (8+ chars, letter + number, e.g. `Pass1234`) → submit
6. **Expected:** "Check your email for the verification code" message appears
7. Repeat with an inappropriate / offensive name → submit
8. **Expected:** Error — "Name flagged by moderation: \<reason\>"
works correctly
### 1.3 Onboarding Tutorial

1. Register a fresh account and verify email
2. Complete role selection and fill in profile → tap "Save Profile"
3. **Expected:** App immediately navigates to the 4-slide onboarding (without requiring a restart)
4. Tap "Next" → advances slides. Tap "Skip" → jumps to main app. Final slide shows "Get Started"
5. Close and reopen app → **Expected:** Onboarding does NOT appear again; goes directly to main tabs
doesn't work still have the bug after creating new profile where pressing create profile leads nowhere
### 1.6 Project Management

#### Deck Download

1. Go to Projects tab → open a project with a deck already uploaded (or upload one)
2. In the project_shared chat card or project detail → tap "View Pitch Deck"
3. **Expected:** Opens a PDF/PPTX file that downloads or previews correctly with the proper file extension (`.pdf`, `.pptx`) — not a file with no extension

#### AI Deck Review

in railway https logs i get this:{
  "requestId": "IyC1ESvJRauijG_h63j4Ww",
  "timestamp": "2026-05-09T17:51:55.983190372Z",
  "method": "POST",
  "path": "/api/projects/5/deck-review",
  "host": "zooming-surprise-production.up.railway.app",
  "httpStatus": 500,
  "upstreamProto": "HTTP/1.1",
  "downstreamProto": "HTTP/2.0",
  "responseDetails": "",
  "totalDuration": 4763,
  "upstreamAddress": "http://[fd12:e2b9:284f:1:5000:df:c5:e589]:8080",
  "clientUa": "Expo/1017756 CFNetwork/3860.400.51 Darwin/25.3.0",
  "upstreamRqDuration": 4763,
  "txBytes": 33,
  "rxBytes": 596,
  "srcIp": "213.57.115.198",
  "edgeRegion": "europe-west4-drams3a",
  "upstreamErrors": ""
}

when trying to send a pdf to ai review

### 1.7 AI Content Moderation

#### Inappropriate name rejected (Account Settings)

1. Account Settings → edit name → set it to clearly hateful/offensive text → save
2. **Expected:** Save fails with "Name flagged by moderation: \<reason\>"

#### Chat message flagged

1. In any chat, type a clearly inappropriate message → send
2. **Expected:** Message is rejected, NOT added to chat, and an alert titled "Message Not Sent" appears with the moderation reason
needs to show in the chat log a red bubble with warning about content moderation and an explanation that the message wasn't sent and the reason
---

## Section 2 — Two Accounts Testing

> Use the pre-seeded accounts. A↔B are already matched with 8 messages. B↔C are matched with 2 messages.

### 2.1 Login

1. Device 1: log in as **Account A** (investor)
2. Device 2: log in as **Account B** (entrepreneur)
3. **Expected:** Both land on main tabs. A sees investor feed (project cards). B sees swipe feed (user cards)

### 2.2 Swipe & Match (fresh)

> Use **Account D** + **Account B** (or any unmatched pair)

1. Log in as D (investor) — Discover tab shows project cards
2. Swipe right on B's TeamSync project
3. Log in as B — swipe right on D
4. **Expected:** Match modal appears on B's screen — "It's a Match!"
5. If AI summary has generated: italic one-sentence explanation in the modal
6. Tap "Message [Name]" → navigates directly to chat

### 2.3 Push Notifications — New Match

1. Background Account B's app (home screen, not closed)
2. From Account D, swipe right on B; then B swipes right on D (or vice versa — whichever creates the match)
3. **Expected:** B receives "🎉 New Match!" push notification with D's name

> Must be tested on a real physical device. Does not work in simulators.

### 2.4 Chat — Text Messaging

> A ↔ B already have 8 messages. Use their existing chat.

1. Device 1 (A): open Matches tab → open chat with B → send a message
2. Device 2 (B): **Expected:** message appears within 15 seconds
3. B replies → **Expected:** appears on A's screen within 15 seconds

### 2.5 Unread Message Badge

1. B sends a message to A while A is NOT in the chat
2. On A, open the Matches tab
3. **Expected:** blue unread dot on B's conversation
4. A opens the chat → **Expected:** dot disappears

### 2.6 Push Notifications — New Message

1. Background Account A (home screen, not closed)
2. From Account B, send a text message
3. **Expected:** A receives push notification: "New message from Alex Rivera" + preview

> Must be tested on a real physical device.

### 2.7 Partner Invite

> Use B ↔ C (both entrepreneurs, already matched)

1. Device 1 (B): open chat with C → action menu → "Invite to Project" → select TeamSync
2. **Expected:** `partner_invite` card appears with project name + Accept / Decline buttons
3. Device 2 (C): tap "Accept"
4. **Expected:** response card shows "accepted". TeamSync's partners list now includes C
5. Repeat from step 1 → tap "Decline" → **Expected:** response card shows "declined"

### 2.8 NDA Signing & PDF

> Use A ↔ B chat

1. Device 2 (B): action menu → "Share Project" → select TeamSync
2. **Expected:** project card appears in chat for A
3. Device 1 (A): tap "Request NDA" on the project card
4. Device 2 (B): tap "Sign NDA"
5. **Expected:** "NDA Signed ✅" message appears with "View NDA Document →" link
6. Tap the link → **Expected:** PDF opens in browser with BizMatch header, both names, date, NDA body

### 2.9 Meeting — Propose & Confirm

> Use A ↔ B chat

1. Device 1 (A): action menu → "Schedule Meeting" → fill title, future date/time, Virtual, video link → submit
2. **Expected:** `meeting_proposal` card appears in chat
3. Device 2 (B): tap the proposal card → MeetingDetailScreen → tap "Confirm"
4. **Expected:** status updates to "Confirmed". Both see it in Meetings tab

### 2.10 Meeting — Cancel

1. From Meetings tab (either device) → open a confirmed meeting → tap Cancel
2. **Expected:** status updates to "Cancelled" on both devices. `meeting_response` card appears in chat

### 2.11 Meeting — Reschedule

1. Device 2 (B): open a proposed meeting → tap "Decline"
2. **Expected:** Alert with three options: Cancel / Just Decline / Suggest New Time
3. Tap "Suggest New Time"
4. **Expected:** ProposeMeeting screen opens pre-filled with original details
5. Change the date/time → submit
6. **Expected:** Device 1 (A) sees a new proposal (roles swapped). Chat shows reschedule message

### 2.12 AI Due Diligence Briefing

1. Either device: Meetings tab → open a confirmed meeting → tap "Get AI Briefing"
2. **Expected:** Briefing loads with 5 sections: Person Summary, Match Rationale, Talking Points (3–4), Questions to Ask (3–4), Watch Out For (2–3)
3. Tap "Get AI Briefing" again → **Expected:** returns instantly (cached, no second Claude call)

**DB verification:**
```sql
SELECT ai_briefing FROM meetings WHERE id = <meeting_id>;
-- populated after first call; same value on second call
```

### 2.13 Premium — Who Liked Me

> Account A is already premium. Use Account D (fresh investor) to like someone.

1. Log in as D → swipe right on B or C
2. Log in as A (premium) → Matches tab
3. **Expected:** "WHO LIKED YOU ★ PREMIUM" section shows D's name/photo

### 2.14 Premium — Super Like

1. Logged in as A (premium) → Discover tab → tap the ★ star button
2. **Expected:** swipe recorded as super like

**DB verification:**
```sql
SELECT is_super_like FROM swipes WHERE swiper_id = <A_id> ORDER BY id DESC LIMIT 1;
-- is_super_like = 1
```

### 2.15 Swipe Limit (free account)

> Account D is non-premium

1. Logged in as D → swipe 20 times
2. On the 21st swipe → **Expected:** "Daily Limit Reached" alert with "Go Premium" button

### 2.16 AI Match Scoring

1. Log in as D → Discover tab loads immediately with math-based scores
2. Wait 20–30 seconds (Claude Haiku runs in background)
3. Navigate away and back → **Expected:** card order may change as AI scores replace math scores

**DB verification:**
```sql
SELECT * FROM ai_match_scores WHERE user_id = <D_id>;
-- rows with Claude-generated scores 0-100 appear after ~30s
```

#### Score invalidation on profile update
1. Edit any profile field → save
2. **Expected:** ai_match_scores rows for that user are deleted → background scoring restarts on next feed load

```sql
SELECT COUNT(*) FROM ai_match_scores WHERE user_id = <your_id>;
-- should be 0 immediately after saving profile
```

### 2.17 AI Cost Control

1. Set today's briefing count to 49 via Railway MySQL:
```sql
INSERT INTO api_usage (date, briefing_count) VALUES (CURDATE(), 49)
ON DUPLICATE KEY UPDATE briefing_count = 49;
```
2. Request one briefing → **Expected:** succeeds (count = 50)
3. Request another → **Expected:** 429 "Daily AI briefing limit reached. Try again tomorrow."

---

## Quick Smoke Test Checklist

Run before every demo:

- [ ] Login works (Account A and B)
- [ ] Profile photos load (Cloudinary URLs)
- [ ] Profile completeness bar accurate on Profile tab
- [ ] Discover tab shows cards in sorted order
- [ ] Swiping right on each other creates a match + modal
- [ ] Chat messages appear on both devices within 15s
- [ ] Partner invite sent and accepted in B↔C chat
- [ ] NDA signed and PDF link opens
- [ ] Meeting proposed, confirmed, visible in Meetings tab
- [ ] AI Briefing loads for a confirmed meeting
- [ ] Projects tab shows public projects
- [ ] Premium trial activates, Who Liked Me section appears
- [ ] Auth persists after closing and reopening app
- [ ] Account deletion removes account and logs out
