# BizMatch — Revision Notes

Notes collected during system review. Apply all after finishing the review pass.

---

## System 1 — Authentication

- [ ] Add ability to disable 2FA in the settings menu (Account Settings screen). Currently `POST /api/auth/2fa/setup` + `POST /api/auth/2fa/verify` enable it, but there is no disable endpoint or UI toggle. Need: `POST /api/auth/2fa/disable` (auth-required, verify TOTP once before disabling), and a toggle button in `AccountSettings.js`.

---

## System 2 — User & Profile

- [ ] `PATCH /api/users/:id/verification` has no admin guard — any authenticated user can change any user's (including their own) verification status via the URL param. Add an admin-only middleware check to this route, or at minimum block users from changing their own status through it (they already have `verify-self` for that).

## System 3 — Matching & Feed

- [ ] When tapping a profile/project card to open the full detail view (`ProfileDetail` screen), show an AI-generated compatibility breakdown: a compatibility score (%), a list of pros for swiping right, and a list of cons. This should be fetched on demand (not pre-loaded in the feed) and cached so it isn't re-generated on every open. Use Claude Haiku, same pattern as the existing AI scoring prompt but with structured output (score, pros[], cons[]).

## System 4 — Project

- [ ] Remove the manual "DECK URL" and "VIDEO URL" text inputs from `ProjectForm` in `ProjectsScreen.js` (lines 509–530). They are stale leftovers from before the BLOB migration. If a user clears the deck URL field and saves, it sets `deck_url = null` in the DB, breaking the deck badge and proxy endpoint even though the binary still exists in `deck_data`.

## System 5 — Messaging

- [ ] Update `FEATURE_STATUS.md` and `systems.md` to reflect that chat polling is every **3 seconds** (not 15s as documented). Code: `ChatScreen.js:145`.

## System 6 — NDA

- [ ] Show the NDA terms to the user before they sign. Currently tapping "Sign NDA" immediately signs server-side with no preview or confirmation. Add a modal that displays the key clauses (confidentiality, non-use, 2-year duration, governing law) and requires the user to explicitly confirm before `signNda()` is called.

## System 7 — Meeting

- [ ] **Bug: proposer cancel silently fails.** `updateMeetingStatus` in `meeting.model.js:44` always uses `AND receiver_id = ?` in the WHERE clause. When the proposer calls cancel, `userId` is the proposer's ID so the UPDATE matches no rows — the meeting stays `proposed` with no error returned. Fix: use `WHERE id = ?` only (the controller already validated the role).
- [ ] **Bug: AI briefing section title renders literally.** `MeetingDetailScreen.js:174` has `title="About {otherName}"` — a plain JSX string, not a template literal. Always shows `About {otherName}` instead of the person's name. Fix: change to `title={\`About ${otherName}\`}`.

## System 8 — File Storage

- [ ] Remove dead code left over from before the BLOB migration: `uploadNda` and `uploadDeck` (Cloudinary path) from `upload.js`, and `ndaStorage` from `cloudinary.js`. None are imported or used anywhere — NDA uses `upload_stream()` directly and deck upload uses `uploadDeckMemory`.

## System 9 — AI Features

## System 10 — Push Notifications

## System 11 — Onboarding

## System 12 — Premium

- [ ] **Better premium UI** — redesign the Premium screen with a more polished look (gradients, crown icon, feature comparison table, etc.).
- [ ] **Premium badge on profile** — show a visible premium tag/badge on the profile card and profile detail view so other users can see who is premium.
- [ ] **Meeting limit for non-premium** — enforce a cap on how many meetings a non-premium user can propose (e.g. 3 active proposed meetings max). Premium users get unlimited.

---

## System 13 — Investor ↔ Project Match Flow

- [ ] **Match popup for investor after project swipe** — when an investor swipes right on a project and a mutual match is created immediately, show a "It's a Match!" popup (same as the entrepreneur-to-entrepreneur match modal). Currently the match is created silently on the investor side with no UI feedback.
- [ ] **NDA gate on project detail** — when an investor opens a matched project's full detail view, require a signed NDA before showing sensitive content (deck, video, full description). If no NDA exists yet, prompt to sign one inline.
- [ ] **Investor interest notification (no match yet)** — if an investor swipes right on a project but the entrepreneur has not yet swiped back (one-sided), the investor should receive a push/in-app notification confirming their interest was registered (e.g. "Your interest in [Project] was sent!"), mirroring the feedback entrepreneurs get.

---

## System 14 — Video Playback

- [ ] **Play video with built-in player instead of downloading** — tapping the video URL/button currently triggers a download or browser open. Replace with an in-app video player (e.g. `expo-av` `Video` component) so the video plays inline without leaving the app.

---

## System 15 — Swipe UX

- [ ] **"LIKE" overlay on right swipe** — swiping left already shows a "PASS" stamp overlay on the card. Add a matching "LIKE" stamp overlay (green, mirrored position) when swiping right, for visual consistency.

---

## System 16 — Job Proposal (Entrepreneur ↔ Entrepreneur)

- [ ] **Job offer message type between entrepreneurs** — add a structured `job_offer` message type so one entrepreneur can formally propose a role/collaboration to another entrepreneur through chat. Should include: role title, description, and accept/decline actions (similar to `partner_invite` flow).

---

## System 17 — NDA Form

- [ ] **Improve NDA template** — review and update the NDA PDF template generated by pdfkit. Ensure it includes: party names, project name, effective date, confidentiality clause, non-use clause, duration (2 years), governing law, and signature line with timestamp.

---

## System 18 — Meetings (Additional)

- [ ] Review meeting system for any remaining UX gaps after applying System 7 bug fixes.

---

## Final Pass — Codebase Cleanup

- [ ] Go through the entire codebase and remove all unnecessary code: unused imports, dead functions, commented-out blocks, stale TODO comments, unreachable routes, unused variables, and any leftover scaffolding from pre-migration or pre-refactor work. Apply after all other revise.md items are done.
