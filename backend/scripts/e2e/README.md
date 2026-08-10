# BizMatch live E2E runners

These scripts test the deployed Netlify/Supabase application. They read
`backend/.env` at runtime and never print or write the publishable key or
access tokens.

## Founder Profile pivot (current)

`run-api-founders.mjs` tests the `founder-profile-pivot` branch's API surface
(`founders`, `evidence`, `assessments`, `founder-dna`) against the
`bizmatch-pivot` Supabase project. Requires seed data from
`node backend/scripts/seed-founders.mjs` to already exist (one admin +
Sarah/Marcus/Alex/Mia founders).

```bash
node backend/scripts/e2e/run-api-founders.mjs --mutating
```

Same `--mutating` convention as below: the default run is read-only and
rejected-write checks; `--mutating` adds the stateful cases (profile/
capability/status writes, evidence, assessments), restoring seeded values in
`finally` blocks. Mia is deliberately kept mostly evidence-free across runs to
exercise the "not enough evidence yet" empty state (case 6.2) — don't add
assessments for her outside test 5.1's own execution/ego evidence.

## Swipe-app suite (superseded)

`run-api.mjs`, `run-browser.mjs`, `verify-*.mjs`, and `docs/E2E_TEST_PLAN.md`
test the old swipe/matching app (match, messages, meetings, projects,
premium). Those Edge Functions were deleted in the founder-profile pivot —
**`run-api.mjs` will now fail entirely** if run with `backend/.env` pointed at
`bizmatch-pivot` (it always was; nothing here still targets the original
`supabase-full` project). Keep for reference against that branch; don't run
against `bizmatch-pivot`.

Run the (superseded) swipe-app API pass from the repository root:

```bash
node backend/scripts/e2e/run-api.mjs --mutating --auth-rate-limit --large-uploads
```

The default run performs read-only and rejected-write checks. `--mutating`
enables the stateful cases explicitly required by the plan (swipes, messages,
meetings, premium changes, and disposable test projects). Temporary changes to
seeded names, roles, and profile fields are restored in `finally` blocks.

`--auth-rate-limit` deliberately calls `precheck-name` until the first 429 and
stops immediately. Run it last because the limit applies to the caller IP for
the remainder of the fixed 15-minute window.

`--large-uploads` sends one 21 MiB PDF and one 101 MiB video to distinguish the
application limit from the Edge platform request-size limit. It never retries.

The 3000-request global production limit is implemented behind
`--global-rate-limit`. This is intentionally opt-in separately from
`--mutating`; it stops at the first 429 and never retries. Prefer staging.

If case 4.12 needs to be repeated without rerunning the entire suite, the full
pass leaves the disposable project id in its evidence:

```bash
node backend/scripts/e2e/verify-deck-review.mjs
```

Case 11.9 also has a focused rerun which first turns Mia's swipe on Alex into a
pass so the candidate recycles into a non-empty feed:

```bash
node backend/scripts/e2e/verify-background-scoring.mjs
```

Browser checks use an already-running W3C WebDriver (Firefox/GeckoDriver works):

```bash
geckodriver --port 4444
node backend/scripts/e2e/run-browser.mjs
```

JSON evidence and PNG screenshots go to `backend/scripts/e2e/artifacts/`, which
is ignored. The dated Markdown report in this directory is the reviewed test
record.
