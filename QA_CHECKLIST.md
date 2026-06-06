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
## ✅ Flow 7 — NDA in Chat — Complete
## ✅ Flow 8 — Project Sharing in Chat — Complete
## ✅ Flow 9 — Partner Invite in Chat — Complete

---

## ✅ Flow 10 — Project Management — Complete

---

## Flow 11 — Meetings
**Accounts:** `marcus.webb@bizmatch.app` ↔ `mia.johnson@bizmatch.app`

- [ ] Reschedule: "Reschedule" button visible on proposed (receiver) and confirmed meetings
- [ ] Reschedule: ProposeMeetingScreen opens with pre-filled title, type, link/address
- [ ] Reschedule: submitting updates meeting and navigates back to list with new time

---

## ✅ Flow 12 — AI Meeting Briefing — Complete

---

## ✅ Flow 13 — Premium — Complete

---

## ✅ Flow 14 — Account Settings — Complete

---

## ✅ Flow 15 — Login with 2FA — Complete

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
