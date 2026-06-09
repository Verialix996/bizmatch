# User Table Normalization Plan

## Goal

Split the original wide `users` table into smaller responsibility-based tables while keeping the app behavior the same.

The old `users` table mixed identity, authentication, profile fields, investor preferences, premium state, push tokens, activity, and swipe counters. The new schema separates those concerns.

## New Table Structure

### `users`

Core identity only:

- `id`
- `email`
- `name`
- `role`
- `is_verified`
- `verification_status`
- `deleted_at`
- `created_at`
- `updated_at`

### `user_auth_security`

Authentication and account-security data:

- `user_id`
- `password_hash`
- `otp_code`
- `otp_expires_at`
- `reset_token`
- `reset_token_expires`
- `oauth_provider`
- `oauth_provider_id`
- `two_factor_secret`
- `two_factor_enabled`
- `login_attempts`
- `locked_until`

### `user_profiles`

Shared profile data:

- `user_id`
- `photo_url`
- `bio`
- `skills`
- `hobbies`
- `role_type`
- `portfolio_url`
- `linkedin_url`
- `experience`
- `cv_url`

### `investor_profiles`

Investor-specific matching preferences:

- `user_id`
- `investment_domain`
- `preferred_stage`
- `max_investment`

### `entrepreneur_profiles`

Entrepreneur-specific profile expansion table:

- `user_id`

Currently this table only stores the key, but it exists so future entrepreneur-only fields do not get pushed back into `users` or `user_profiles`.

### `user_app_state`

App state and monetization data:

- `user_id`
- `push_token`
- `is_premium`
- `premium_expires_at`
- `last_active_at`
- `swipe_count`
- `swipe_count_date`
- `has_seen_onboarding`

## Migrations

The migrations should build the normalized schema from scratch. They should not backfill or preserve old wide-table data.

Expected migration layout:

- `001_create_users.sql` creates only the slim identity `users` table.
- `015_create_user_auth_security.sql` creates `user_auth_security`.
- `016_create_user_profiles.sql` creates `user_profiles`.
- `017_create_investor_profiles.sql` creates `investor_profiles`.
- `018_create_entrepreneur_profiles.sql` creates `entrepreneur_profiles`.
- `019_create_user_app_state.sql` creates `user_app_state`.
- `020_create_user_full_view.sql` creates the `user_full` compatibility view.

There should be no duplicate create/drop migrations for these tables. Do not add backfill, `DROP COLUMN`, or legacy wide-table conversion logic.

## `user_full` View

`user_full` is a read convenience view. It joins the normalized user tables back into the old combined shape.

Purpose:

- Keep existing backend read paths simple.
- Avoid repeating long joins everywhere.
- Preserve API response shape while the physical schema is normalized.

Important:

- `user_full` is not a table.
- Do not write to `user_full`.
- Writes must go to the correct physical table.

Use `user_full` only when a flow genuinely needs many user fields at once, such as auth payloads, profile cards, matching, or AI prompts.

## Backend Update Guidelines For Claude Code

When updating code, follow these ownership rules.

### Reads

Use the narrowest source that satisfies the feature:

- Identity-only reads: `users`
- Auth/security reads: `user_auth_security` joined to `users` if identity fields are needed
- Profile reads: `user_profiles` joined to `users`
- Investor matching reads: `investor_profiles` joined to `users` and `user_profiles`
- Premium/swipe/push/onboarding/activity reads: `user_app_state`
- Full card/auth/matching reads: `user_full`

### Writes

Never write moved fields to `users`.

Write to:

- `users`: `email`, `name`, `role`, `is_verified`, `verification_status`, `deleted_at`
- `user_auth_security`: password, OTP, reset token, OAuth provider, 2FA, login attempts, lockout
- `user_profiles`: photo, bio, skills, hobbies, shared profile links, experience, CV
- `investor_profiles`: investment domain, preferred stage, max investment
- `entrepreneur_profiles`: entrepreneur-only fields when added
- `user_app_state`: push token, premium, last active, swipe counters, onboarding

### User Creation

Every new user must create rows in the relevant normalized tables:

1. Insert core row into `users`.
2. Insert default row into `user_auth_security`.
3. Insert default row into `user_profiles`.
4. Insert default row into `user_app_state`.
5. Insert role-specific row:
   - `investor_profiles` for investors.
   - `entrepreneur_profiles` for entrepreneurs.

OAuth users still need `user_auth_security`, `user_profiles`, and `user_app_state` rows even if they do not have a password.

### Role Changes

When a user changes role:

- Update `users.role`.
- Update `user_profiles.role_type`.
- Create the new role-specific row.
- Remove or ignore stale data in the opposite role table.

Recommended behavior:

- Switching to investor: ensure `investor_profiles` row exists and remove `entrepreneur_profiles` row.
- Switching to entrepreneur: ensure `entrepreneur_profiles` row exists and remove `investor_profiles` row.

### Seed Script

The demo seed must insert into all normalized tables directly.

Investor seed flow:

1. Insert into `users`.
2. Insert password into `user_auth_security`.
3. Insert shared profile into `user_profiles`.
4. Insert investor preferences into `investor_profiles`.
5. Insert onboarding state into `user_app_state`.

Entrepreneur seed flow:

1. Insert into `users`.
2. Insert password into `user_auth_security`.
3. Insert shared profile into `user_profiles`.
4. Insert row into `entrepreneur_profiles`.
5. Insert onboarding state into `user_app_state`.

## Validation Checklist

After changes, verify:

- Fresh migrations create all expected tables.
- There are no old profile/auth/premium columns left on `users`.
- `user_full` exists and returns the old combined field shape.
- Demo seed creates usable investor and entrepreneur accounts.
- Login works.
- Email verification / OTP fields work.
- Google OAuth user creation works.
- 2FA works.
- Profile create/update works.
- Photo and CV upload update `user_profiles`.
- Premium activation/cancel updates `user_app_state`.
- Swipe limit updates `user_app_state`.
- Feed ranking still sees profile and investor fields.
- Project feed still sees owner profile fields and investor preferences.
- Chat/conversation screens still get names and photos.
- Meeting briefing still receives profile/investor fields.

## Video Explanation

Use this short explanation:

> Originally, `users` was a wide table with identity, authentication, profile, premium, and matching fields. I normalized it into smaller one-to-one tables. `users` now stores only identity. Auth security, shared profile data, investor preferences, entrepreneur expansion data, and app state each have their own table. `user_full` is only a read view that joins them for places where the backend needs the complete user object.
