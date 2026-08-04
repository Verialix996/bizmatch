# BizMatch Live E2E Results — 2026-08-01

**Summary: 101 PASS / 3 FAIL / 14 BLOCKED / 1 SKIPPED — 119 total.**

Targeted the live Netlify app and Supabase project `luuhaczovcphtqvvwvkv`. API coverage used all four seeded end-user accounts; UI coverage used headless Firefox 153 through GeckoDriver. No service-role key was used. Seeded email/name/role/profile changes were restored; Sarah remains Premium as required by the plan.

## Regression summary

Three observed behaviors contradict the plan/README feature claims:

- **1.2 Duplicate registration:** raw Supabase signup returned 200 with `identities: []`; the frontend checks only `error`, so it proceeds to OTP rather than rejecting the existing email.
- **8.5 Super-like notification:** the premium mutual super-like returned `matched: true`, but Alex never received a `super_like` notification. Source inspection is consistent with a UUID being supplied to bigint `notifications.ref_id`.
- **9.3 Onboarding persistence:** Skip works for the current session, but onboarding returns after a fresh login/reload. The flag is stored in `user_activity`, while `GET /users/me` returns only the `users` row.

The initial 4.12 and 5.8 harness failures were not product regressions: a proper eight-slide deck scored 7/10, and project metadata was present as serialized JSONB that the chat UI parses. The focused chat rerun also rendered history/read receipts and observed the three-second polling update.

Blocked items require an inbox/OTP or Google identity, a disposable account, backend redeploy, a genuinely expired signed JWT, or DB/admin visibility. 11.7 was deliberately skipped on production: the included runner supports `--global-rate-limit` and stops at the first 429, but sending 3001 requests would degrade the live service. Native push delivery is a documented non-goal and was not assessed; notification-row creation was assessed.

## 1. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 1.1 | Register — happy path | BLOCKED (requires a disposable inbox and real OTP delivery) | — |
| 1.2 | Register — duplicate email | FAIL | existing Sarah email returned 200 with identities=[] instead of a registration rejection |
| 1.3 | Register — weak password | PASS | weak password is rejected by Supabase Auth; browser rendering also passed |
| 1.4 | Register — name flagged by moderation | PASS | moderation rejects a flagged registration name; browser rendering also passed |
| 1.5 | Register — empty name | PASS | empty registration name is rejected; browser rendering also passed |
| 1.6 | OTP verify — happy path | BLOCKED (requires a disposable inbox and real OTP) | — |
| 1.7 | OTP verify — wrong code | BLOCKED (requires an unverified disposable signup to exercise signup OTP rejection) | — |
| 1.8 | OTP resend | BLOCKED (requires inbox access to compare old and resent OTPs) | — |
| 1.9 | Login — happy path | PASS | seeded Sarah login succeeds; browser rendering also passed |
| 1.10 | Login — wrong password | PASS | wrong password creates no session |
| 1.11 | Login — nonexistent email | PASS | nonexistent email creates no session |
| 1.12 | Forgot / reset password | BLOCKED (requires a disposable inbox and password-reset link) | — |
| 1.13 | Google OAuth | BLOCKED (Google control reached accounts.google.com, but no interactive Google test identity was available to complete the session) | — |
| 1.14 | Session persistence | PASS | session survives a full page reload |
| 1.15 | **`precheck-name` rate limit** | PASS | precheck-name stops at first 429 after the fixed-window allowance |
| 1.16 | Logout | PASS | logout clears session and returns to Welcome |

## 2. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 2.1 | Create profile — entrepreneur | BLOCKED (requires a disposable newly registered entrepreneur; update/background timing is covered by 11.9) | — |
| 2.2 | Create profile — investor | BLOCKED (requires a disposable newly registered investor) | — |
| 2.3 | Edit profile fields | PASS | profile fields persist and are restored |
| 2.4 | Bio flagged by moderation | PASS | flagged bio is rejected and not saved |
| 2.5 | Skills flagged by moderation | PASS | flagged skill is rejected and not saved |
| 2.6 | Profile completeness score | PASS | Profile screen visibly renders completeness percentage/progress |
| 2.7 | Photo upload — happy path | BLOCKED (successful upload would irreversibly replace a seeded photo; no disposable account/inbox was supplied) | — |
| 2.8 | Photo upload — bad format | PASS | non-image photo payload is rejected |
| 2.9 | CV upload — happy path | PASS | PDF CV uploads under 20 MiB; the web CV control opened a PDF file input |
| 2.10 | CV upload — oversized | PASS | CV over 20 MiB is rejected |
| 2.11 | CV view | PASS | CV streams via token query parameter as PDF |
| 2.12 | One-click self-verification | PASS | self-verification endpoint reports verified |
| 2.13 | Change role | PASS | role switch persists and seeded role is restored |
| 2.14 | View another user's public profile | PASS | public profile returns only the documented safe shape |
| 2.15 | View public profile — nonexistent user | PASS | bogus public-profile UUID returns 404 |

## 3. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 3.1 | Feed loads — investor | PASS | investor feed contains entrepreneurs only; browser rendering also passed |
| 3.2 | Feed loads — entrepreneur | PASS | entrepreneur feed contains other entrepreneurs only |
| 3.3 | Swipe pass | PASS | pass is recorded and candidate moves into the passed portion |
| 3.4 | Swipe like — no mutual match yet | PASS | one-sided like returns matched false |
| 3.5 | Mutual match | PASS | mutual likes create or return a Marcus–Mia match |
| 3.6 | Swipe on self | PASS | self swipe is rejected |
| 3.7 | Swipe with invalid direction | PASS | invalid direction is rejected |
| 3.8 | Re-swipe same target | PASS | re-swipe updates direction without an API error |
| 3.9 | Free daily swipe limit | PASS | free daily swipe limit returns first 429 without retries |
| 3.10 | Premium unlimited swipes | PASS | premium Sarah exceeds 20 swipes without daily-limit 429 |
| 3.11 | Super Like — free user | PASS | free-user super-like request is accepted only as a normal swipe |
| 3.12 | Super Like — premium user | PASS | premium super-like on a mutual swipe emits API match result |
| 3.13 | AI feed ranking | PASS | feed ranking returns bounded scores and remains stable enough to reload |
| 3.14 | AI unavailable fallback | PASS | feed responds using fallback when scores are absent or delayed |
| 3.15 | Compatibility score | PASS | compatibility returns score/pros/cons shape |
| 3.16 | Compatibility — AI unavailable | BLOCKED (requires backend redeploy with GEMINI_API_KEY unset/invalid) | — |
| 3.17 | Compatibility — nonexistent target | PASS | compatibility bogus target returns 404 when AI is configured |

## 4. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 4.1 | Create project — entrepreneur | PASS | entrepreneur creates a disposable test project; live project card/upload controls rendered in Firefox |
| 4.2 | Create project — investor blocked | PASS | investor project creation is blocked |
| 4.3 | Title/description moderation | PASS | project title and description moderation reject writes |
| 4.4 | Edit project | PASS | project edit persists |
| 4.5 | Delete (soft-delete) project | PASS | soft-delete hides project from mine but direct GET still returns inactive row |
| 4.6 | Visibility toggle | PASS | private visibility persists and remains readable (display-only) |
| 4.7 | Pitch deck upload | PASS | pitch deck PDF uploads under 20 MiB; live project card/upload controls rendered in Firefox |
| 4.8 | Pitch deck upload — oversized | PASS | deck over 20 MiB is rejected |
| 4.9 | Demo video upload | PASS | small demo video uploads; live project card/upload controls rendered in Firefox |
| 4.10 | Demo video — oversized | PASS | video over 100 MiB is rejected once without retry |
| 4.11 | Serve deck via token | PASS | matched viewer streams deck via token query |
| 4.12 | AI Deck Review — happy path | PASS | proper 8-slide deck returned score 7/10 and all review arrays |
| 4.13 | AI Deck Review — no deck uploaded | PASS | deck review without upload is rejected |
| 4.14 | AI Deck Review — non-pitch-deck PDF | PASS | unrelated PDF is classified with score 1 |
| 4.15 | AI Deck Review — AI unavailable | BLOCKED (requires backend redeploy with GEMINI_API_KEY missing) | — |
| 4.16 | Get project by id — nonexistent | PASS | nonexistent numeric project id returns 404 |
| 4.17 | Get project by id — non-numeric id | PASS | non-numeric project id returns 404, not 500 |
| 4.18 | Cross-user edit/delete blocked | PASS | cross-user edit and delete affect no owner row |

## 5. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 5.1 | View conversations list | PASS | Messages UI renders Sarah–Alex conversation card |
| 5.2 | View message history | PASS | Chat UI renders seeded/new message history |
| 5.3 | Send message — happy path | PASS | new message is saved with sender and timestamp |
| 5.4 | Send message — moderation flagged | PASS | flagged message is rejected |
| 5.5 | Send to a match you're not part of | PASS | nonparticipant cannot post to Sarah–Alex match |
| 5.6 | Mark read | PASS | receiver marks incoming message read |
| 5.7 | Read receipts — free vs premium | PASS | premium Sarah chat visibly renders read receipts |
| 5.8 | Share project in chat | PASS | 201 project_shared message contained full TeamSync metadata; JSONB arrived serialized and the UI parser handles it |
| 5.9 | Share a project you don't own | PASS | sharing another user's project is blocked |
| 5.10 | Pagination / `after` param | PASS | after parameter returns only higher ids in ascending order |
| 5.11 | Polling updates | PASS | open chat polls and renders a message sent from Alex's second session |

## 6. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 6.1 | Propose — free user blocked | PASS | free matched user cannot propose a meeting |
| 6.2 | Propose — virtual, happy path | PASS | premium proposer creates virtual meeting and chat card |
| 6.3 | Propose — in-person, happy path | PASS | premium proposer creates in-person meeting |
| 6.4 | Propose — virtual missing video link | PASS | virtual proposal requires videoLink |
| 6.5 | Propose — in-person missing address | PASS | in-person proposal requires address |
| 6.6 | Propose — not part of match | PASS | nonparticipant cannot propose against another match |
| 6.7 | Confirm — as receiver | PASS | receiver confirms proposed meeting |
| 6.8 | Confirm — as proposer (should fail) | PASS | proposer cannot confirm own proposal |
| 6.9 | Decline — as receiver | PASS | receiver declines proposed meeting |
| 6.10 | Cancel — as proposer, any status | PASS | proposer cancels a confirmed meeting |
| 6.11 | Cancel — as receiver, only if confirmed | PASS | receiver cannot cancel still-proposed meeting |
| 6.12 | Cancel — as receiver, confirmed | PASS | receiver cancels a confirmed meeting |
| 6.13 | Reschedule — as receiver of a proposed meeting | PASS | receiver reschedules proposal and swaps roles |
| 6.14 | Reschedule — wrong status | PASS | declined meeting cannot be rescheduled |
| 6.15 | List meetings | PASS | meeting list excludes cancelled and is sorted; browser rendering also passed |

## 7. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 7.1 | Activate free trial | PASS | 30-day premium trial activates |
| 7.2 | Cancel premium | PASS | premium cancellation clears state and can be restored |
| 7.3 | Who liked me — premium | PASS | premium who-liked-me returns an array with super-like flags |
| 7.4 | Who liked me — free user blocked | PASS | free user is blocked from who-liked-me |

## 8. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 8.1 | List notifications | PASS | notifications list is capped, newest first |
| 8.2 | Notification created — match | PASS | mutual match creates match notification |
| 8.3 | Notification created — meeting proposed | PASS | meeting proposal creates receiver notification |
| 8.4 | Notification created — message | PASS | message creates at most one unread notification per match |
| 8.5 | Notification created — super like | FAIL | premium super-like creates a super_like notification: no super_like notification observed for Alex |
| 8.6 | Mark read — by ids | PASS | mark-read by ids changes only selected notifications |
| 8.7 | Mark read — by types | PASS | mark-read by type changes message notifications only |

## 9. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 9.1 | First-time walkthrough | PASS | first-time seeded Marcus session shows four-slide walkthrough |
| 9.2 | Skip | PASS | Skip dismisses onboarding and persists the seen flag |
| 9.3 | Not shown again | FAIL | onboarding is not shown after logout-like storage reset and fresh login: onboarding reappeared at https://bizmatchapp.netlify.app/Onboarding |

## 10. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 10.1 | Update display name | PASS | display name persists, moderation rejects, original name restored |
| 10.2 | Delete account | BLOCKED (requires a disposable inbox-backed account; seeded identities must never be deleted) | — |
| 10.3 | Admin-only verification override | PASS | non-admin verification override is blocked |

## 11. Results

| # | Case | Status | Evidence |
|---|---|---|---|
| 11.1 | Missing auth token | PASS | protected endpoint rejects missing Authorization |
| 11.2 | Invalid/malformed token | PASS | protected endpoint rejects malformed token |
| 11.3 | Expired token | BLOCKED (no genuinely expired signed end-user JWT is available; a fabricated JWT would only duplicate malformed-token coverage) | — |
| 11.4 | CORS — allowed origin | PASS | CORS allows https://bizmatchapp.netlify.app |
| 11.5 | CORS — Netlify deploy-preview origin | PASS | CORS allows https://abc123--bizmatchapp.netlify.app |
| 11.6 | CORS — disallowed origin | PASS | CORS rejects https://evil.example.com |
| 11.7 | Global rate limit | SKIPPED (not run against production: 3001 requests would degrade service; runner supports --global-rate-limit and stops on first 429) | — |
| 11.8 | Each function reachable | PASS | all eight deployed Edge Functions are reachable |
| 11.9 | Background scoring doesn't block response | PASS | profile update returned in 6516ms; later feed exposed populated AI score 75 |
| 11.10 | `last_active_at` updates | BLOCKED (requires DB access/admin activity view; no end-user endpoint exposes last_active_at) | — |

## Failure details

### 1.2 — duplicate email was not rejected

Expected: Supabase/Auth client rejects Sarah's already-registered email and the UI remains on registration.

Actual request:
```json
{
  "method": "POST",
  "url": "https://luuhaczovcphtqvvwvkv.supabase.co/auth/v1/signup",
  "headers": {
    "apikey": "<redacted>",
    "Content-Type": "application/json"
  },
  "body": "{\"email\":\"sarah.chen@bizmatch.app\",\"password\":\"<redacted>\",\"data\":{\"name\":\"Duplicate Sarah\",\"role\":\"investor\"}}"
}
```

Actual response:
```json
{
  "status": 200,
  "headers": {
    "alt-svc": "h3=\":443\"; ma=86400",
    "cf-cache-status": "DYNAMIC",
    "cf-ray": "a246be6b29e07d9a-TLV",
    "connection": "keep-alive",
    "content-encoding": "gzip",
    "content-type": "application/json",
    "date": "Sat, 01 Aug 2026 18:00:41 GMT",
    "sb-gateway-version": "1",
    "sb-project-ref": "luuhaczovcphtqvvwvkv",
    "sb-request-id": "019fbe7c-3f04-7b1a-9614-8363a5b943c0",
    "server": "cloudflare",
    "set-cookie": "__cf_bm=pVaSbiMh5UZsM5o_659O3Y7Yvg3PQyAc0QR40Mb0Ehs-1785607241.469777-1.0.1.1-XCwk59RgY8SqYZX8wiEcWq0c5FNpVKBIvKuLltGeX_Mphaby4z_hygFASn5X_NWDTrct6sI5BujmdACdyXrS5S6FZ_8tXVxpRNpr5JlAScrOauMZHLZ3mmtiqrSGX0My; HttpOnly; SameSite=None; Secure; Path=/; Domain=supabase.co; Expires=Sat, 01 Aug 2026 18:30:41 GMT",
    "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
    "transfer-encoding": "chunked",
    "vary": "Origin, Accept-Encoding",
    "x-content-type-options": "nosniff",
    "x-envoy-attempt-count": "1",
    "x-envoy-upstream-service-time": "37"
  },
  "body": {
    "id": "9f0aab29-501a-4a55-803d-5f832ce407ca",
    "aud": "authenticated",
    "role": "",
    "email": "sarah.chen@bizmatch.app",
    "phone": "",
    "confirmation_sent_at": "2026-08-01T18:00:41.7823606Z",
    "app_metadata": {
      "provider": "email",
      "providers": [
        "email"
      ]
    },
    "user_metadata": {
      "name": "Duplicate Sarah",
      "role": "investor"
    },
    "identities": [],
    "created_at": "2026-08-01T18:00:41.7823606Z",
    "updated_at": "2026-08-01T18:00:41.7823606Z",
    "is_anonymous": false
  },
  "elapsedMs": 617
}
```

The 200 response includes an empty `identities` array, but the frontend registration service checks only the SDK `error` value.

### 8.5 — super-like notification missing

Expected: a premium super-like completing a mutual match creates both `match` and `super_like` notifications.

Super-like request/response:
```json
{
  "label": "POST /match/swipe",
  "request": {
    "method": "POST",
    "url": "https://luuhaczovcphtqvvwvkv.supabase.co/functions/v1/match/swipe",
    "headers": {
      "apikey": "<redacted>",
      "Authorization": "<redacted>",
      "Content-Type": "application/json"
    },
    "body": "{\"targetUserId\":\"ecc3e865-7d8d-4aa8-9861-3febe8eb4fbe\",\"direction\":\"like\",\"superLike\":true}"
  },
  "response": {
    "status": 200,
    "headers": {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-origin": "*",
      "alt-svc": "h3=\":443\"; ma=86400",
      "cf-cache-status": "DYNAMIC",
      "cf-ray": "a246ca6d6ab07da0-TLV",
      "connection": "keep-alive",
      "content-encoding": "gzip",
      "content-length": "45",
      "content-type": "application/json",
      "date": "Sat, 01 Aug 2026 18:09:00 GMT",
      "endpoint-load-metrics": "application_utilization:6,named_metrics.queue_depth:6",
      "sb-gateway-version": "1",
      "sb-project-ref": "luuhaczovcphtqvvwvkv",
      "sb-request-id": "019fbe83-c06d-7239-a467-01d7c9a5e3d1",
      "server": "cloudflare",
      "set-cookie": "__cf_bm=q34C7SgYHF9G5RM3uxj.ce9DEom81SJBmuvDwnRt2HM-1785607733.3504643-1.0.1.1-Qy7vP7dyMzTvbOT2WKTUFeBh0nHXDgAiVMngx2e2PgaYCxv8AncpAMZQJsJXzb_zLve0UPqk9BsRjjPg8ehdY8Kyx14pVySkZA5lk23oOD9k22MWI9fs0zv_lQ7lrCnG; HttpOnly; SameSite=None; Secure; Path=/; Domain=supabase.co; Expires=Sat, 01 Aug 2026 18:39:00 GMT",
      "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
      "vary": "Accept-Encoding",
      "x-deno-execution-id": "d9f6895a-3e97-48f4-ae8e-483e165a2248",
      "x-sb-edge-region": "eu-central-2",
      "x-served-by": "supabase-edge-runtime"
    },
    "body": {
      "matched": true,
      "matchId": "1"
    },
    "elapsedMs": 7509
  }
}
```

Notification-list request/response after background work:
```json
{
  "request": {
    "method": "GET",
    "url": "https://luuhaczovcphtqvvwvkv.supabase.co/functions/v1/notifications",
    "headers": {
      "apikey": "<redacted>",
      "Authorization": "<redacted>"
    },
    "body": null
  },
  "response": {
    "status": 200,
    "headers": {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-origin": "*",
      "alt-svc": "h3=\":443\"; ma=86400",
      "cf-cache-status": "DYNAMIC",
      "cf-ray": "a246d6bacdd8fc6b-TLV",
      "connection": "keep-alive",
      "content-encoding": "gzip",
      "content-length": "441",
      "content-type": "application/json",
      "date": "Sat, 01 Aug 2026 18:17:23 GMT",
      "endpoint-load-metrics": "application_utilization:7,named_metrics.queue_depth:7",
      "sb-gateway-version": "1",
      "sb-project-ref": "luuhaczovcphtqvvwvkv",
      "sb-request-id": "019fbe8b-70bb-7871-b8f8-945b81725f76",
      "server": "cloudflare",
      "set-cookie": "__cf_bm=aLztzrXELRigwMNnZW7teiTuVO7FjhAA6ywaUMoBGm4-1785608237.2415607-1.0.1.1-QaJ2UKLrOehsAYkv7yfGMW8o2xIdrwawHDlbH5sBnhD2kyVUZGKrWT1nH5rFtTCXjFfdTvYHk.iWbDRpYKEzDcUPty9ixPR1dGTdiNWb3jjRyGCyHfQ10Bn4J9ehrfGC; HttpOnly; SameSite=None; Secure; Path=/; Domain=supabase.co; Expires=Sat, 01 Aug 2026 18:47:23 GMT",
      "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
      "vary": "Accept-Encoding",
      "x-content-type-options": "nosniff",
      "x-deno-execution-id": "4f036f25-ac34-49da-9682-f03e32b7b897",
      "x-sb-edge-region": "eu-central-2",
      "x-served-by": "supabase-edge-runtime"
    },
    "body": [
      {
        "id": "13",
        "type": "meeting",
        "refId": "5",
        "payload": "{\"title\":\"E2E virtual meeting\",\"matchId\":\"1\"}",
        "readAt": null,
        "createdAt": "2026-08-01T18:15:52.984Z"
      },
      {
        "id": "12",
        "type": "meeting",
        "refId": "4",
        "payload": "{\"title\":\"E2E virtual meeting\",\"matchId\":\"1\"}",
        "readAt": null,
        "createdAt": "2026-08-01T18:15:28.985Z"
      },
      {
        "id": "11",
        "type": "meeting",
        "refId": "3",
        "payload": "{\"title\":\"E2E virtual meeting\",\"matchId\":\"1\"}",
        "readAt": null,
        "createdAt": "2026-08-01T18:15:05.504Z"
      },
      {
        "id": "10",
        "type": "meeting",
        "refId": "2",
        "payload": "{\"title\":\"E2E in_person meeting\",\"matchId\":\"1\"}",
        "readAt": null,
        "createdAt": "2026-08-01T18:14:49.469Z"
      },
      {
        "id": "9",
        "type": "meeting",
        "refId": "1",
        "payload": "{\"title\":\"E2E virtual meeting\",\"matchId\":\"1\"}",
        "readAt": null,
        "createdAt": "2026-08-01T18:14:19.203Z"
      },
      {
        "id": "8",
        "type": "match",
        "refId": "1",
        "payload": "{\"matchId\":\"1\",\"name\":\"Sarah Chen\"}",
        "readAt": null,
        "createdAt": "2026-08-01T18:09:01.833Z"
      },
      {
        "id": "5",
        "type": "match",
        "refId": "1",
        "payload": "{\"matchId\":\"1\",\"name\":\"Sarah Chen\"}",
        "readAt": null,
        "createdAt": "2026-08-01T17:12:59.762Z"
      },
      {
        "id": "4",
        "type": "match",
        "refId": "1",
        "payload": {
          "name": "Sarah Chen",
          "matchId": "1"
        },
        "readAt": null,
        "createdAt": "2026-08-01T16:24:00.600Z"
      },
      {
        "id": "3",
        "type": "match",
        "refId": "1",
        "payload": {
          "name": "Sarah Chen",
          "matchId": "1"
        },
        "readAt": null,
        "createdAt": "2026-08-01T16:22:07.471Z"
      },
      {
        "id": "2",
        "type": "message",
        "refId": "1",
        "payload": {
          "matchId": "1",
          "fromName": "Sarah Chen"
        },
        "readAt": null,
        "createdAt": "2026-08-01T16:21:40.013Z"
      },
      {
        "id": "1",
        "type": "match",
        "refId": "1",
        "payload": {
          "name": "Sarah Chen",
          "matchId": "1"
        },
        "readAt": null,
        "createdAt": "2026-08-01T16:21:34.790Z"
      }
    ],
    "elapsedMs": 14451
  },
  "expected": "no super_like notification observed for Alex"
}
```

Actual: match notifications were present, but no item had `type: "super_like"`.

### 9.3 — onboarding shown again

Expected: after Skip marks onboarding seen, a fresh login goes directly to Main/Discover.

Actual browser observation:
```json
{
  "title": "Onboarding",
  "url": "https://bizmatchapp.netlify.app/Onboarding",
  "text": "Skip\n🔍\nDiscover\nBrowse investors and fellow entrepreneurs. Swipe right to connect, left to pass.\nNext\nBIZMATCH\n✕\n🔔",
  "inputs": []
}
```

The browser landed on `/Onboarding` again with the first slide visible.

## Artifacts and reproducibility

- `run-api.mjs`: full API pass with opt-in stateful/rate/large-upload controls.
- `run-browser.mjs`: Firefox UI pass plus focused `--chat-only` mode.
- `verify-deck-review.mjs`: focused 4.12 rerun with a real eight-slide PDF.
- `verify-background-scoring.mjs`: focused 11.9 rerun with a recycled feed candidate.
- Runtime JSON/screenshots are under ignored `backend/scripts/e2e/artifacts/`.
