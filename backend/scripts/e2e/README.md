# BizMatch live E2E runners

These scripts test the deployed Netlify/Supabase application described in
`docs/E2E_TEST_PLAN.md`. They read `backend/.env` at runtime and never print or
write the publishable key or access tokens.

Run the API pass from the repository root:

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
