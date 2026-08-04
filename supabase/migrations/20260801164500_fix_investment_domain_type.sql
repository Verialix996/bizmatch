-- investor_profiles.investment_domain was mistakenly typed jsonb in the
-- initial schema; every read/write site (profile.model.js, match.model.js,
-- match.controller.js, profile.controller.js, and the frontend's plain text
-- input in EditProfileScreen) treats it as a free-text string, matching the
-- original schema. Fix the column type before any real data depends on it.
alter table public.investor_profiles
  alter column investment_domain type text using investment_domain::text;

alter table public.investor_profiles
  alter column investment_domain drop default;
