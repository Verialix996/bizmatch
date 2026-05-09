# BizMatch — Manual Testing Guide

## Prerequisites

- Two physical devices (or one device + one simulator for non-push-notification tests)
- Expo Go installed on both devices
- Backend running on Railway (`main-Ai_integrated` branch)
- Two test accounts: **Account A** (investor) and **Account B** (entrepreneur)
- Optional: Railway MySQL query access for DB verification

Start Expo: run `npx expo start` in `frontend/`, scan QR with Expo Go.

---

## 2. Profile Creation & Editing ⚠️ RETEST

### Create Profile (Entrepreneur/Investor) ⚠️ RETEST
> Bug fixed: photo upload was "coming soon". Now uses expo-image-picker → uploads to Cloudinary via POST /users/me/photo.

1. After registration, set role → fill in bio (50+ chars), skills (2+), stage, funding/domain
2. Tap the photo area → **Expected:** device photo library opens
3. Select a photo → **Expected:** photo uploads and appears in the circle immediately
4. Tap "Save Profile"
5. **Expected:** Photo URL starts with `res.cloudinary.com`. Profile saved.

> **Note on completeness score:** 40% with bio + 2 skills only is correct — each field is worth 20pts. Fill all role-specific fields (venture stage + funding needs for entrepreneurs, domain + preferred stage for investors) + photo = 100%.
get photo upload failed please try again error
---

## 3. Swipe Feed & AI-Driven Matching

### Basic Feed
1. Open Discover tab
2. **Expected:** Cards appear sorted by compatibility score (highest first)
3. Swipe right (like) or left (pass)
4. Previously liked users do not reappear. Previously passed users appear at the bottom.

### AI Score Verification
1. Load feed for the first time → note card order (math scores used initially)
2. Wait 15–30 seconds (background Claude Haiku scoring runs in parallel)
3. Pull to refresh or navigate away and back
4. **Expected:** Card order may change — AI scores are now the dominant signal (60 pts) once cached

**DB verification:**
```sql
SELECT * FROM ai_match_scores WHERE user_id = <your_id>;
-- Rows appear with Claude-generated scores 0-100 for each candidate
```

**Railway logs:** Look for Claude API calls firing after the feed response is returned.

### Mode Toggle (Entrepreneur only)
1. On Discover tab, toggle between "Find Investors" and "Find Partners"
2. **Expected:** "Find Investors" shows investor profiles; "Find Partners" shows entrepreneur profiles

### Investor Feed
1. Login as investor
2. **Expected:** Sees project cards (not user profiles)
3. Swipe right on a project → if entrepreneur swipes right on investor → match

---

## 4. Match & Match Modal

1. From Account A, swipe right on Account B
2. From Account B, swipe right on Account A
3. **Expected on Account B's screen:** Match modal appears — "It's a Match!"
4. If AI summary has generated: italic one-sentence explanation appears in modal
5. Tap "Message [Name]" → navigates directly to chat

---

## 5. Chat & Messaging

1. Open a matched conversation from Matches tab
2. Type a message → send
3. On the other device, **Expected:** Message appears within 15 seconds (polling interval)
4. Send a message from the other side → appears on first device

### Unread Message Badge
1. Account B sends a message to Account A while Account A is NOT in that chat
2. On Account A, open the Matches tab
3. **Expected:** A blue unread dot appears on the conversation with Account B
4. Account A opens the chat → reads the messages
5. **Expected:** Blue dot disappears

### Push Notification (real device only)
1. Background Account A's app (don't close, just go to home screen)
2. From Account B, send a text message
3. **Expected:** Account A receives a push notification with sender name + message preview

### Partner Invite (chat flow)
1. From an entrepreneur account, open a chat with a matched entrepreneur
2. Tap the action menu → "Invite to Project" → select a project
3. **Expected:** `partner_invite` card appears in chat with project name and Accept/Decline buttons
4. On the other device, tap "Accept"
5. **Expected:** `partner_invite_response` card shows "accepted". Partner now appears in the project's partners list.
6. Repeat but tap "Decline" → **Expected:** Response card shows "declined"

---

## 6. NDA Signing & PDF

1. In chat, tap the "+" or action menu → "Share Project"
2. Select a project → project card appears in chat for the other user
3. Other user taps "Request NDA" on the project card
4. Original user sees "Sign NDA" button → tap it
5. **Expected:** "NDA Signed ✅" message appears with "View NDA Document →" link
6. Tap "View NDA Document →" → PDF opens in browser

**Expected PDF content:** BizMatch header, both user names, date, NDA body text.

---

## 7. Project Management

### Create Project
1. Go to Projects tab → tap "+"
2. Fill in: title, description, industry, stage, funding needed
3. Set visibility to "Public"
4. Upload pitch deck (PDF) and/or demo video
5. **Expected:** Files upload to Cloudinary (URLs start with `res.cloudinary.com`)

### Edit Project
1. Go to Projects tab → tap an existing project → tap Edit
2. Change the title or description → save
3. **Expected:** Updated details appear on the project card immediately

### Delete Project
1. Go to Projects tab → tap a project → tap Delete (or long-press)
2. Confirm deletion
3. **Expected:** Project disappears from the list. Login as investor — project no longer appears in the investor feed.

### Project Visibility
1. Set project visibility to "Private"
2. Login as investor on another device
3. **Expected:** Private project does NOT appear in investor's project feed

### AI Deck Review
1. Open your own project (must have a deck uploaded)
2. Tap "✦ Get AI Deck Feedback"
3. In the modal, type a description: problem, solution, market, team, funding ask
4. Tap Submit
5. **Expected:** Modal shows Overall Score (1–10), Strengths, Weaknesses, Suggestions

---

## 8. Meeting Scheduling

### Propose a Meeting
1. Open a chat with a match → tap "Schedule Meeting" (header or action menu)
2. Fill in: title, date/time (future date), type (Virtual or In-Person)
3. For Virtual: enter a video link (e.g. Zoom URL)
4. Submit
5. **Expected:** `meeting_proposal` card appears in chat thread

### Confirm a Meeting
1. On the receiver's device, open the chat
2. Tap the meeting proposal card → opens MeetingDetailScreen
3. Tap "Confirm"
4. **Expected:** Meeting status updates to "Confirmed". Both users see it in Meetings tab.

### Cancel a Confirmed Meeting
1. Both users confirm a meeting (status = confirmed)
2. Either user opens the meeting from the Meetings tab → tap Cancel
3. **Expected:** Meeting status updates to "Cancelled". Both users see the updated status. A `meeting_response` card appears in chat.

---

## 9. Meeting Rescheduling

1. Receiver opens a proposed meeting → tap "Decline"
2. **Expected:** Alert appears with three options: Cancel / Just Decline / Suggest New Time
3. Tap "Suggest New Time"
4. **Expected:** ProposeMeeting screen opens, pre-filled with original meeting details
5. Change the date/time → submit
6. **Expected:** Original proposer now sees a new proposal (roles swapped). Chat shows reschedule message.

---

## 10. AI Due Diligence Briefing

1. Open a confirmed meeting (Meetings tab → tap meeting)
2. Tap "Get AI Briefing"
3. **Expected:** Briefing loads with 5 sections:
   - Person Summary
   - Match Rationale
   - Talking Points (3–4 bullets)
   - Questions to Ask (3–4 bullets)
   - Watch Out For (2–3 bullets)
4. Tap "Get AI Briefing" again
5. **Expected:** Returns instantly (cached — no second Claude call)

**DB verification:**
```sql
SELECT ai_briefing FROM meetings WHERE id = <meeting_id>;
-- Should be populated after first call, same value on subsequent calls
```

---

## 11. AI Content Moderation

### Profile Bio Flagged
1. Go to Edit Profile → set bio to something clearly inappropriate (e.g. hate speech or threats)
2. Tap Save
3. **Expected:** Save fails with error "Bio flagged by moderation: <reason>". Profile not updated.

### Clean Bio Accepted
1. Set bio to normal professional content → save
2. **Expected:** Saves successfully. No moderation error.

### Chat Message Flagged
1. In any chat, type a clearly inappropriate message → send
2. **Expected:** Message is rejected with error. Does NOT appear in the chat thread.

### Project Description Flagged
1. Create or edit a project with an inappropriate description → save
2. **Expected:** Save fails with moderation error. Project not created/updated.

### Fallback (no API key)
1. (Railway) Temporarily remove `ANTHROPIC_API_KEY`
2. Submit any content → **Expected:** Content is accepted (fail open — moderation never blocks users when AI is unavailable)
3. Restore the API key

---

## 12. AI Cost Control

1. (DB access required) Insert or update today's usage:
```sql
INSERT INTO api_usage (date, briefing_count) VALUES (CURDATE(), 49)
ON DUPLICATE KEY UPDATE briefing_count = 49;
```
2. Request one briefing → **Expected:** Succeeds (count becomes 50)
3. Request another briefing → **Expected:** 429 error "Daily AI briefing limit reached. Try again tomorrow."

---

## 13. Onboarding Tutorial

### First Launch
1. Fresh install OR clear app data / SecureStore
2. Register and set a role
3. **Expected:** 4-slide onboarding appears before main tabs

### Navigation
- Tap "Next" → advances slides
- Tap "Skip" on any slide → goes directly to main app
- Final slide shows "Get Started" instead of "Next"

### One-Time Only
1. Complete onboarding → use app normally
2. Close and reopen app
3. **Expected:** Onboarding does NOT appear again

---

## 14. Push Notifications

> Must be tested on a **real physical device**. Does not work in simulators.

### New Message Notification
1. Background Account A (home screen, not closed)
2. Account B sends a text message
3. **Expected:** Account A receives push notification: "New message from [Name]" + preview

### New Match Notification
1. Account A swipes right on Account B
2. Account B swipes right on Account A (creating a mutual match)
3. **Expected:** Account B receives "🎉 New Match!" notification with Account A's name

---

## 15. Premium System

### Activate Free Trial
1. Navigate to Premium screen (Profile tab → Go Premium, or from the 429 upgrade prompt)
2. Tap "Activate Free Trial (30 days)"
3. **Expected:** Success alert. "Who Liked Me" section appears in Matches tab.

**DB verification:**
```sql
SELECT is_premium, premium_expires_at FROM users WHERE id = <your_id>;
-- is_premium = 1, premium_expires_at = 30 days from now
```

### Swipe Limit (free account)
1. Use a non-premium account
2. Swipe 20 times in one day
3. On the 21st swipe → **Expected:** Alert "Daily Limit Reached" with "Go Premium" button

### Super Like
1. Activate premium
2. Tap the ★ star button (center action button in feed)
3. **Expected:** Swipe recorded

**DB verification:**
```sql
SELECT is_super_like FROM swipes WHERE swiper_id = <your_id> ORDER BY id DESC LIMIT 1;
-- is_super_like = 1
```

### Who Liked Me
1. From Account B (non-premium), swipe right on Account A
2. On Account A (premium), open Matches tab
3. **Expected:** "WHO LIKED YOU ★ PREMIUM" section shows Account B's name/photo
4. If Account B used Super Like → ★ badge on their bubble

---

## 16. AI Match Scoring (AI-Driven Feed)

### Verify Background Scoring
1. Login fresh (or clear `ai_match_scores` for your user):
```sql
DELETE FROM ai_match_scores WHERE user_id = <your_id>;
```
2. Open Discover tab → feed loads immediately with math scores
3. Wait 20–30 seconds
4. Check DB:
```sql
SELECT * FROM ai_match_scores WHERE user_id = <your_id>;
-- Rows appear with Claude-generated scores 0-100
```
5. Navigate away and back to Discover tab
6. **Expected:** Feed may reorder based on AI scores

### Verify Score Invalidation on Profile Update
1. Note current `ai_match_scores` rows for your user
2. Edit any field in your profile → save
3. Check DB immediately:
```sql
SELECT COUNT(*) FROM ai_match_scores WHERE user_id = <your_id>;
-- Should be 0 (all invalidated)
```
4. Reload feed → background scoring starts again

### Verify Fallback (no API key)
1. (Railway) Temporarily remove `ANTHROPIC_API_KEY` env var
2. Load feed → **Expected:** Still works, math scores used, no errors shown to user
3. Restore the API key

---

## Quick Smoke Test Checklist

Run this before every demo:

- [ ] Login works on both devices
- [ ] Profile photos load (Cloudinary URLs)
- [ ] Profile completeness bar visible and accurate on Profile tab
- [ ] "Verify Account" button works in Account Settings
- [ ] Feed shows cards in sorted order
- [ ] Swiping right on each other creates a match
- [ ] Chat messages appear on both devices
- [ ] Partner invite sent and responded to in chat
- [ ] Meetings tab shows scheduled meetings
- [ ] AI Briefing loads for a confirmed meeting
- [ ] Projects tab shows public projects
- [ ] Premium screen accessible and trial activates
- [ ] Auth persists after closing and reopening app
- [ ] Account deletion removes account and logs out
