-- Replaces the single recording_url/recording_duration_seconds pair with an array of
-- segments. Reason: "continue recording after a reload" was implemented by fetching the
-- previously-uploaded audio and concatenating it client-side (new Blob([existing, newSegment]))
-- with the new take before re-uploading as one file — the same technique the reference
-- "interview-main" tool uses. Verified against a real recording in this stack: the combined
-- WebM plays back only up to whatever (unreliable, often wrong) duration the browser initially
-- sniffs from the concatenated container, then silently stops — the rest of the audio is
-- present in the uploaded bytes but never reachable through playback. Storing each recording
-- session as its own independently-finalized file sidesteps the problem entirely: nothing is
-- ever byte-concatenated, so every segment's container metadata is always correct.
--
-- recording_url/recording_duration_seconds are left in place (unused going forward) rather than
-- dropped, since there's no real production data yet to migrate.

alter table public.founder_interviews
  add column recording_segments jsonb not null default '[]'::jsonb;
