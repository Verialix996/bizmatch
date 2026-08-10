-- Drops the swipe/matching-era schema, superseded by the Founder Profile
-- pivot (evidence-based profiling + admin-driven matching, see
-- 20260810120000 onward). The Edge Functions that used these tables
-- (match, messages, meetings, profile, projects) are already gone from
-- this branch.
--
-- Follows the style of 20260804140000_drop_challenges_teams_offers.sql:
-- explain why, leave now-unused enum values in place — Postgres can't
-- cheaply drop individual enum values, and unused values are harmless.
-- Left behind: swipe_direction, message_type (incl. its
-- partner_invite/partner_invite_response additions), meeting_location,
-- meeting_status, notification_type's now-dead 'match'/'super_like'/
-- 'partner_invite' values (notifications itself is kept, repurposed with
-- new type strings — evidence_added/assessment_requested/match_ready/
-- deal_breaker_flagged — that aren't in the enum since notifications.type
-- was never constrained to it at the column level).
--
-- investor_profiles is dropped too: the pivot has no investor persona
-- (admins/evaluators + founders only, per the pivot's confirmed decisions).
--
-- user_activity.swipe_count/swipe_count_date are swipe-specific; dropped
-- alongside. push_token/last_active_at/has_seen_onboarding stay — the
-- onboarding-wizard-completion flag and push token are still in use.

drop table if exists public.partner_invitations;
drop table if exists public.project_partners;
drop table if exists public.ai_project_scores;
drop table if exists public.project_matches;
drop table if exists public.project_swipes;
drop table if exists public.projects;

drop table if exists public.meetings;
drop table if exists public.ai_match_scores;
drop table if exists public.messages;
drop table if exists public.matches;
drop table if exists public.swipes;

drop table if exists public.investor_profiles;

alter table public.user_activity drop column if exists swipe_count;
alter table public.user_activity drop column if exists swipe_count_date;
