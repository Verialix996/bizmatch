-- Removes the Teams/Challenges/Investment Offers feature and its tables,
-- reversing 20260801180000_challenges_teams_offers.sql now that Projects
-- (with partner invitations and an investor swipe feed) is back as the
-- venture-team mechanism instead. The Edge Function (supabase/functions/
-- challenges/) is already gone from this branch.
--
-- Enum values added by that migration (notification_type/message_type) are
-- left in place — Postgres can't cheaply drop individual enum values, and
-- unused values are harmless.

drop table if exists public.investment_offers;
drop table if exists public.challenge_signups;
drop table if exists public.challenges;
drop table if exists public.team_members cascade;
drop table if exists public.teams cascade;

drop type if exists offer_direction;
drop type if exists offer_status;
drop type if exists signup_status;
drop type if exists challenge_type;
drop type if exists challenge_status;
drop type if exists team_member_status;
