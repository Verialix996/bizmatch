# BizMatch — Testing Checklist

Testing guide for the three bug fixes implemented on 2026-04-09.

---

## Bug 3 — Google Auth Name Displays Correctly

**What was fixed:** Google's mobile OAuth API returns names with `+` as a separator (e.g. `John+Smith`). The backend now strips the `+` and trims whitespace before storing.

### Test Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Sign in with Google on a mobile device (Expo Go / built app) using an account with a multi-word name | Auth completes successfully |
| 2 | Navigate to your profile screen | Name displays as `John Smith` — no `+` character |
| 3 | Open the Matches screen and start a chat | Your name appears correctly in the chat header and conversation list |
| 4 | Create a new account via Google (not previously registered) | Same — name stored and displayed with spaces |
| 5 | Sign in via the web app (if Google web OAuth is enabled) | Name stored correctly from `displayName` field as well |

### Edge Cases
- Name with three words (e.g. `Mary Jane Watson`) — should display all three words with spaces
- Name with no surname — single word name should still work fine

---

## Bug 4 — Profile Form Required Field Validation

**What was fixed:** The profile setup form now blocks submission if Bio is empty (all users) or Skills is empty (entrepreneurs). Error messages appear in red beneath the relevant field.

### Test Steps — Entrepreneur

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Open Edit Profile as an entrepreneur | Form loads normally |
| 2 | Leave Bio empty, tap "Save Profile" | Red error appears under Bio: **"Bio is required"**. Form does not submit. |
| 3 | Fill in Bio, leave Skills empty, tap "Save Profile" | Red error appears under Skills: **"At least one skill is required"**. Form does not submit. |
| 4 | Fill in Bio and add at least one skill, tap "Save Profile" | Profile saves successfully, navigates away |
| 5 | Re-open profile, confirm Bio and skills are persisted | Data displays correctly |

### Test Steps — Investor

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Open Edit Profile as an investor | Form loads normally |
| 2 | Leave Bio empty, tap "Save Profile" | Red error appears under Bio: **"Bio is required"**. Form does not submit. |
| 3 | Leave Skills empty, tap "Save Profile" (after filling Bio) | Form submits successfully — skills are not required for investors |
| 4 | Fill in Bio, tap "Save Profile" | Profile saves successfully |

### Edge Cases
- Bio with only whitespace — should still fail (react-hook-form `required` trims)
- Navigating back without saving — no errors shown, no data lost
- Editing an existing complete profile — form pre-fills and saves without errors

---

## Bug 5 — Partner Invite & NDA Signing via Chat

**What was fixed:** Partner invitations are now sent through chat with an NDA signing prerequisite. The invitee must sign the NDA before they can accept. Direct partner-adding is replaced by the invite flow.

> **Setup required:** You need two accounts — one entrepreneur (Account A) and one investor or entrepreneur (Account B) who have already matched with each other.

---

### 5a — Sending a Partner Invite

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as Account A (entrepreneur with at least one project) | Projects screen is visible |
| 2 | Tap **"+ Add Partner"** on a project | Modal opens showing matched users |
| 3 | Tap on Account B in the list | Modal closes, Alert appears: **"A partner invite has been sent via chat..."** |
| 4 | Navigate to Matches → open chat with Account B | A partner invite card appears in the chat with the project name |
| 5 | Try tapping "Add Partner" for the same person/project again | Error shown: **"Invite already pending"** |

---

### 5b — Receiving and Accepting a Partner Invite (NDA flow)

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as Account B | Navigate to chat with Account A |
| 2 | See the partner invite card | Card shows project name, note about NDA requirement, and two buttons: **"Sign NDA & Accept"** and **"Decline"** |
| 3 | Tap **"Sign NDA & Accept"** | NDA is signed and invite is accepted in one step. A new message appears: **"Partner invite accepted! Welcome to the team."** Buttons disappear from the invite card. |
| 4 | Log in as Account A, check the project's Team section | Account B now appears as a partner |

---

### 5c — Declining a Partner Invite

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as Account B, open chat with Account A | Partner invite card visible |
| 2 | Tap **"Decline"** | A message appears: **"Partner invite declined."** Buttons disappear from the card. |
| 3 | Log in as Account A, check the project's Team section | Account B is NOT listed as a partner |
| 4 | Account A can send a new invite to Account B after a decline | New invite card appears in chat |

---

### 5d — NDA Request Flow (Investor requesting project access)

> This flow is triggered from the chat — the investor sends a request and the entrepreneur signs it.

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Log in as investor (Account B), open chat with entrepreneur (Account A) | Chat visible |
| 2 | Send an NDA request (via `requestNda` API — can test via Postman/curl: `POST /api/messages/:matchId/nda-request { projectId }`) | An **"NDA Requested"** card appears in chat showing the project name |
| 3 | Log in as Account A (entrepreneur), open the same chat | NDA request card is visible with a **"Sign NDA"** button |
| 4 | Tap **"Sign NDA"** | Button disappears, a new message appears: **"NDA signed. You now have access to the full project details."** |
| 5 | Repeat tap (sign again) | Silently handled — `INSERT IGNORE` prevents duplicates |

---

### 5e — Backend Enforcement: Cannot Accept Without NDA

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Call `POST /api/messages/:matchId/invite/:invitationId/respond` with `{ accepted: true }` for a user who has NOT signed the NDA (via Postman/curl) | Response: **403** `"You must sign the NDA before accepting"` |
| 2 | Sign the NDA first (`POST /api/messages/:matchId/nda-sign { projectId }`), then respond with `{ accepted: true }` | Response: **200**, partner is added |

---

### 5f — Message Rendering Edge Cases

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Sender (Account A) views the invite card they sent | No Accept/Decline buttons visible. Status shows **"Awaiting response"** |
| 2 | After invite is responded to, reopen chat | Invite card shows **"Responded"** status, buttons gone |
| 3 | Invite card with a very long project name | Text wraps cleanly within the card |
| 4 | NDA request card viewed by the sender (investor) | No "Sign NDA" button shown. Status shows **"Awaiting signature"** |
| 5 | After NDA signed, reopen chat | NDA card shows **"NDA signed"** status |

---

## General Regression Tests

After all fixes, verify nothing existing is broken:

| # | Area | Check |
|---|------|-------|
| 1 | Regular text chat | Sending and receiving plain text messages still works |
| 2 | Message polling | New messages appear within ~3 seconds without refresh |
| 3 | Profile save (all fields filled) | Saves correctly, no regression from validation changes |
| 4 | Email/password login | Unaffected by Google auth fix |
| 5 | Remove partner (long-press) | Still works — this flow was not changed |
| 6 | Project CRUD | Create, edit, delete projects unaffected |
| 7 | Swipe feed | Investor swipe feed unaffected |

---

## API Quick Reference (Postman / curl)

```
# Send partner invite
POST /api/messages/:matchId/invite
Body: { "projectId": 1 }

# Respond to invite
POST /api/messages/:matchId/invite/:invitationId/respond
Body: { "accepted": true }

# Request NDA
POST /api/messages/:matchId/nda-request
Body: { "projectId": 1 }

# Sign NDA
POST /api/messages/:matchId/nda-sign
Body: { "projectId": 1 }
```

All endpoints require `Authorization: Bearer <token>` header.
