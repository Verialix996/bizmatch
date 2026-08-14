-- Activities: a start/end date range that drives lifecycle status automatically, instead of an
-- admin manually toggling a status chip. `status` stays a stored column (kept for activities
-- created before this migration, which have no date range and fall back to it), but every
-- activity created going forward is required to have both `starts_at` and `ends_at`, and its
-- status is computed at read time from `now()` vs that range:
--   now() < starts_at        -> 'upcoming'
--   starts_at <= now() <= ends_at -> 'active'
--   now() > ends_at          -> 'completed'
-- See supabase/functions/activities/model.ts's STATUS_SQL for the shared expression used by
-- every query that reads status.
alter table public.activities
  add column starts_at timestamptz,
  add column ends_at   timestamptz;

alter table public.activities
  add constraint activities_date_range_chk
  check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and ends_at >= starts_at)
  );

create index activities_starts_at_idx on public.activities(starts_at);
