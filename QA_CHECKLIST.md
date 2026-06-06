# BizMatch — Pre-Recording QA Checklist

**All seed account password: `Demo1234!`**
**Reset DB if data gets messy:** `DATABASE_URL="..." node backend/scripts/seed.js`

---

## Seed Accounts Reference

### Investors
| Email | Name | Focus | Pre-matched with |
|-------|------|-------|-----------------|
| sarah.chen@bizmatch.app | Sarah Chen | SaaS / B2B | alex.rivera ← **best demo account** |
| marcus.webb@bizmatch.app | Marcus Webb | FinTech / Payments | mia.johnson |
| lena.fischer@bizmatch.app | Lena Fischer | HealthTech / MedTech | jordan.lee |
| david.okafor@bizmatch.app | David Okafor | Marketplace / eCommerce | ethan.park |
| priya.nair@bizmatch.app | Priya Nair | EdTech / Future of Work | zara.ahmed |

### Entrepreneurs
| Email | Name | Startup | Industry | Pre-matched with |
|-------|------|---------|----------|-----------------|
| alex.rivera@bizmatch.app | Alex Rivera | TeamSync | SaaS | sarah.chen |
| mia.johnson@bizmatch.app | Mia Johnson | CashBridge | FinTech | marcus.webb |
| jordan.lee@bizmatch.app | Jordan Lee | VitalBand | HealthTech | lena.fischer |
| zara.ahmed@bizmatch.app | Zara Ahmed | LearnArc | EdTech | priya.nair |
| ethan.park@bizmatch.app | Ethan Park | ArtisanRoute | Marketplace | david.okafor |

> All 5 pairs have a pre-seeded 4-message chat history. `sarah.chen ↔ alex.rivera` is the best demo pair.

---

## ✅ Flow 1 — Authentication — Complete
## ✅ Flow 2 — Profile Setup — Complete
## ✅ Flow 3 — Onboarding Tutorial — Complete

---

## Flow 4 — Discovery & Swiping

- [ ] Daily swipe limit shown correctly for free users (20/day) — *needs more profiles to verify*

---

## ✅ Flow 5 — Mutual Match — Complete
## ✅ Flow 6 — Chat & Messaging — Complete

---

## Flow 7 — NDA in Chat
**Accounts:** `sarah.chen@bizmatch.app` (investor) **sends** NDA request → `alex.rivera@bizmatch.app` (entrepreneur) **receives and agrees**

- [ ] Investor taps "Request NDA" → picks project → NDA terms modal appears with "Sign & Send Request" button
- [ ] After investor signs: chat shows "You've signed. Waiting for Alex Rivera to agree." (no Download PDF link, no action buttons)
- [ ] Entrepreneur receives NDA card with inline terms (Confidentiality, Non-Use, Duration, Governing Law) and "I Agree" button — no Download PDF link shown
- [ ] After entrepreneur taps "I Agree": AI generates the NDA contract, "NDA Agreed" card appears for both parties
- [ ] "View NDA Document →" link on the signed card opens the AI-generated PDF for both investor and entrepreneur
---

## Flow 8 — Project Sharing in Chat
**Accounts:** `sarah.chen@bizmatch.app` (investor) ↔ `alex.rivera@bizmatch.app` (has **TeamSync** project)

- [ ] Share project action visible in chat
- [ ] Project selection list loads (TeamSync should appear for Alex)
- [ ] Selected project appears as a card in chat
- [ ] Investor side can view the project card

---

## Flow 9 — Partner Invite in Chat
**Accounts:** Any matched entrepreneur pair, e.g. `alex.rivera@bizmatch.app` inviting `ethan.park@bizmatch.app` — requires them to be matched first

- [ ] "Invite as Partner" action visible
- [ ] Project selection for invite works
- [ ] Invite message appears in chat
- [ ] Receiver can accept the invite
- [ ] Accepted partner appears in the project's partner list

---

## Flow 10 — Project Management
**Accounts:** `alex.rivera@bizmatch.app` (has **TeamSync** project pre-seeded)
*(Also test with `mia.johnson` → CashBridge, `jordan.lee` → VitalBand, `zara.ahmed` → LearnArc, `ethan.park` → ArtisanRoute)*

- [ ] Projects tab loads "My Projects" and "Joined Projects" sections
- [ ] TeamSync project appears in "My Projects"
- [ ] Create new project: name, description, stage → saves correctly
- [ ] Newly created project appears in list
- [ ] Edit project: changes save and display correctly
- [ ] Delete project: confirmation dialog → removed from list
- [ ] Upload pitch deck (PDF): progress shown, saved with version number
- [ ] Upload pitch video: progress shown, playable after upload
- [ ] Manage partners: list shows all partners with roles
- [ ] Change partner role: dropdown works and saves
- [ ] AI feedback on deck displays (requires investor to have reviewed the deck)

---

## Flow 11 — Meetings
**Accounts:** `marcus.webb@bizmatch.app` ↔ `mia.johnson@bizmatch.app`

- [ ] ProposeMeetingScreen: title, Virtual/In-Person toggle, date picker, time picker all work
- [ ] Virtual meeting: video link field shown and saves correctly
- [ ] In-Person meeting: address autocomplete works (Nominatim OSM), address saves
- [ ] Proposed meeting appears in MeetingScreen with "Proposed" status for marcus.webb
- [ ] mia.johnson sees the proposal in her MeetingScreen
- [ ] mia.johnson can Confirm → status changes to "Confirmed" on both sides
- [ ] mia.johnson can Decline → status changes to "Declined"
- [ ] marcus.webb can Cancel → status changes to "Cancelled"
- [ ] Reschedule: ProposeMeetingScreen opens with pre-filled data
- [ ] Free tier: 4th active meeting shows limit error
- [ ] MeetingDetailScreen: all details display correctly

---

## Flow 12 — AI Meeting Briefing
**Accounts:** `marcus.webb@bizmatch.app` — use the confirmed meeting from Flow 11

- [ ] "Generate Briefing" button visible on a confirmed meeting
- [ ] Loading state shown while generating (~2–3s)
- [ ] Briefing displays: skills match, investment thesis, compatibility notes, discussion points
- [ ] No crash or timeout during generation

---

## Flow 13 — Premium
**Accounts:** `priya.nair@bizmatch.app` or `zara.ahmed@bizmatch.app`

- [ ] PremiumScreen loads with correct benefits table
- [ ] "Activate" button shows 30-day free trial messaging
- [ ] Activation works → premium badge appears on profile
- [ ] Expiry date shown for active subscribers
- [ ] Cancel subscription: confirmation dialog → cancelled
- [ ] Unlimited swipes active after activation (no 20/day cap message)
- [ ] "Who Liked You" section visible on Discover after activation
- [ ] Meeting limit removed after activation

---

## Flow 14 — Account Settings
**Accounts:** `david.okafor@bizmatch.app`

- [ ] AccountSettings loads without errors
- [ ] Edit name: change saves and reflects on ProfileScreen
- [ ] Dark Mode toggle: theme changes immediately across all tabs
- [ ] Dark Mode toggle: can be turned off, reverts correctly
- [ ] Enable 2FA: QR code renders, correct code enables 2FA
- [ ] Disable 2FA: requires current code to disable
- [ ] Referral code: displays and copy-to-clipboard works
- [ ] Logout: clears session, returns to WelcomeScreen
- [ ] Delete account: confirmation dialog → account deleted, returns to WelcomeScreen

---

## Flow 15 — Login with 2FA
**Accounts:** Account with 2FA enabled from Flow 14 (`david.okafor@bizmatch.app`)

- [ ] Login on 2FA-enabled account → Verify2FAScreen appears
- [ ] Correct authenticator code → navigates to main app
- [ ] Wrong code → shows error
- [ ] Google OAuth on 2FA account → Verify2FAScreen appears after OAuth

---

## General

- [ ] Bottom tab navigation works between all 4 tabs
- [ ] App header renders correctly (investor mode toggle visible on Discover only)
- [ ] Investor mode toggle changes theme correctly
- [ ] Back navigation never causes a blank or stuck screen
- [ ] No red Expo error screens during any flow
- [ ] No console warnings about unhandled navigation actions
- [ ] App resumes correctly after backgrounding and foregrounding
- [ ] Deep link for password reset (`bizmatch://reset-password`) works on device

---

## Bug Log

| # | Flow | Description | Status |
|---|------|-------------|--------|
| 1 | Flow 2 | "Onboarding not found" on profile submit — stale `has_seen_onboarding` in SecureStore from previous user on same device | ✅ Fixed |
| 2 | Flow 4 | Deck loaded immediately without AI scores — profiles appeared with low/wrong scores before AI had a chance to run | ✅ Fixed |
| 3 | Flow 4 | Score on swipe card differed from AI score shown in ProfileDetailScreen | ✅ Fixed |
| 4 | Flow 5 | After matching with an entrepreneur, their project cards still appeared in the investor's project deck | ✅ Fixed |
| 5 | Flow 6 | Tapping profile avatar/name in chat header did nothing — no navigation to ProfileDetailScreen | ✅ Fixed |
| 6 | Flow 6 | ProfileDetailScreen opened from chat header showed empty profile — only AI compatibility loaded, no bio/skills/role data | ✅ Fixed |
| 7 | Flow 7 | NDA receiver saw "Awaiting signature" instead of Sign/Download buttons — condition was inverted | ✅ Fixed |
| 8 | Flow 7 | NDA document only named the entrepreneur — investor (receiving party) was missing from the document | ✅ Fixed |
