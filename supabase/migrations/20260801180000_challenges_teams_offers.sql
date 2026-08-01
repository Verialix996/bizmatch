-- Replaces the "Projects" feature with Teams + Challenges (hackathon-style,
-- investor-posted) + Investment Offers. Also introduces a system-generated
-- "cohesion test" challenge type: the moment a team reaches 2 accepted
-- members, an AI-generated private exercise is created for that team, and
-- completing it is a prerequisite for applying to any real investor
-- hackathon (see supabase/functions/challenges/).
--
-- Does NOT touch the existing `projects` table or its Storage data — it is
-- simply no longer read/written by the app going forward.

-- Enum value additions must be their own leading statements: some Postgres/
-- Supabase migration runners disallow using a freshly-added enum value in
-- the same transaction as the ALTER TYPE that added it.
alter type notification_type add value 'team_invite';
alter type notification_type add value 'challenge_won';
alter type notification_type add value 'investment_offer';
alter type notification_type add value 'challenge_signup';
alter type notification_type add value 'submission_received';
alter type message_type add value 'submission_shared';

create type team_member_status as enum ('invited', 'accepted', 'declined');
create type challenge_status   as enum ('open', 'closed', 'winner_selected', 'cancelled');
create type challenge_type     as enum ('cohesion_test', 'hackathon');
create type signup_status      as enum ('signed_up', 'submitted');
create type offer_status       as enum ('pending', 'countered', 'accepted', 'declined');
create type offer_direction    as enum ('investor', 'team');

-- Teams carry the venture-profile fields that used to live on `projects`
-- (stage/industry/funding_needed) — a team is now the durable "venture
-- identity"; challenge_signups below are lightweight per-challenge entries.
create table public.teams (
  id             bigint generated always as identity primary key,
  name           text not null,
  creator_id     uuid not null references public.users(id) on delete cascade,
  stage          project_stage,
  industry       text,
  funding_needed integer,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index teams_creator_idx on public.teams(creator_id);

-- Creator row is inserted as 'accepted' at team-creation time. Every other
-- row starts 'invited' and requires the invitee's own accept/decline action.
create table public.team_members (
  id            bigint generated always as identity primary key,
  team_id       bigint not null references public.teams(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  invited_by_id uuid not null references public.users(id) on delete cascade,
  status        team_member_status not null default 'invited',
  match_id      bigint references public.matches(id) on delete set null,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (team_id, user_id)
);
create index team_members_user_idx on public.team_members(user_id, status);
create index team_members_team_idx on public.team_members(team_id, status);

create table public.challenges (
  id                  bigint generated always as identity primary key,
  investor_id         uuid references public.users(id) on delete cascade,
  type                challenge_type not null default 'hackathon',
  team_id             bigint references public.teams(id) on delete cascade,
  title               text not null,
  description         text,
  judging_criteria    text,
  investment_teaser   text,
  submission_deadline timestamptz not null,
  status              challenge_status not null default 'open',
  winning_team_id     bigint references public.teams(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint challenges_hackathon_has_investor
    check (type = 'cohesion_test' or investor_id is not null),
  constraint challenges_cohesion_has_team
    check (type = 'hackathon' or team_id is not null)
);
create index challenges_investor_idx on public.challenges(investor_id);
create index challenges_open_idx on public.challenges(status) where status = 'open' and type = 'hackathon';
create index challenges_cohesion_team_idx on public.challenges(team_id) where type = 'cohesion_test';

create table public.challenge_signups (
  id           bigint generated always as identity primary key,
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  team_id      bigint not null references public.teams(id) on delete cascade,
  status       signup_status not null default 'signed_up',
  deck_url     text,
  video_url    text,
  description  text,
  ai_review    jsonb,
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (challenge_id, team_id)
);
create index challenge_signups_challenge_idx on public.challenge_signups(challenge_id);
create index challenge_signups_team_idx on public.challenge_signups(team_id);

-- Append-only negotiation rounds (matches the messages/ai_match_scores
-- convention of simple rows over mutable JSONB history). Only the highest
-- `round` for a (challenge_id, team_id) pair is "live".
create table public.investment_offers (
  id             bigint generated always as identity primary key,
  challenge_id   bigint not null references public.challenges(id) on delete cascade,
  team_id        bigint not null references public.teams(id) on delete cascade,
  round          integer not null default 1,
  direction      offer_direction not null,
  amount         numeric(14,2) not null,
  equity_percent numeric(5,2) not null,
  valuation      numeric(14,2),
  terms          text,
  status         offer_status not null default 'pending',
  proposed_by_id uuid not null references public.users(id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index investment_offers_challenge_team_idx on public.investment_offers(challenge_id, team_id, round);

-- RLS: service role (used by all Edge Functions) bypasses RLS — these
-- policies are defense-in-depth, mirroring 20260801145138_rls_policies.sql.
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_signups enable row level security;
alter table public.investment_offers enable row level security;

create policy teams_select_member on public.teams for select using (
  creator_id = auth.uid()
  or exists (select 1 from public.team_members tm where tm.team_id = teams.id and tm.user_id = auth.uid() and tm.status = 'accepted'));
create policy teams_write_creator on public.teams for all using (creator_id = auth.uid()) with check (creator_id = auth.uid());

create policy team_members_select on public.team_members for select using (
  user_id = auth.uid()
  or exists (select 1 from public.team_members tm2 where tm2.team_id = team_members.team_id and tm2.user_id = auth.uid() and tm2.status = 'accepted'));
create policy team_members_update_self on public.team_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Hackathons are public; cohesion tests are private to the owning team.
create policy challenges_select on public.challenges for select using (
  type = 'hackathon'
  or exists (select 1 from public.team_members tm where tm.team_id = challenges.team_id and tm.user_id = auth.uid() and tm.status = 'accepted'));
create policy challenges_write_owner on public.challenges for all using (investor_id = auth.uid()) with check (investor_id = auth.uid());

create policy challenge_signups_select on public.challenge_signups for select using (
  exists (select 1 from public.challenges c where c.id = challenge_signups.challenge_id and c.investor_id = auth.uid())
  or exists (select 1 from public.team_members tm where tm.team_id = challenge_signups.team_id and tm.user_id = auth.uid() and tm.status = 'accepted'));
create policy challenge_signups_write_team on public.challenge_signups for all using (
  exists (select 1 from public.team_members tm where tm.team_id = challenge_signups.team_id and tm.user_id = auth.uid() and tm.status = 'accepted')
) with check (
  exists (select 1 from public.team_members tm where tm.team_id = challenge_signups.team_id and tm.user_id = auth.uid() and tm.status = 'accepted'));

create policy investment_offers_select on public.investment_offers for select using (
  exists (select 1 from public.challenges c where c.id = investment_offers.challenge_id and c.investor_id = auth.uid())
  or exists (select 1 from public.team_members tm where tm.team_id = investment_offers.team_id and tm.user_id = auth.uid() and tm.status = 'accepted'));
-- no client insert/update policy on investment_offers — service role only, matching notifications' pattern
