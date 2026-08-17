-- Audio recording + per-question bookmarks for founder interviews (ported
-- from the standalone "interview-main" tool). recording_bookmarks ties a
-- timestamp in the recording to the question being asked at that moment,
-- same shape as the reference app's RecordingBookmark.
--
-- The "interview-recordings" public Storage bucket (matching how "photos"/
-- "cvs" were provisioned — not tracked in a migration) was created directly
-- against the project on 2026-08-17 via the Storage REST API, so
-- BUCKETS.recording (supabase/functions/_shared/storage.ts) resolves.

alter table public.founder_interviews
  add column recording_url text,
  add column recording_duration_seconds integer,
  add column recording_bookmarks jsonb not null default '[]'::jsonb;
