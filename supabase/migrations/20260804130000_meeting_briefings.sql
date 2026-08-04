-- Restores the AI meeting-briefing cache column cut in
-- 20260801145137_meetings_scores_notifications.sql ("ai_briefing column cut
-- for MVP"). Nullable — populated lazily on first GET .../briefing request,
-- then served from cache on subsequent requests.

alter table public.meetings add column briefing jsonb;
