-- Restores the investor project-swipe feed, AI investor-fit scoring, and
-- partner invitations that were cut when this schema was first ported to
-- Supabase (see 20260801145136_projects.sql's "team/partners concept cut
-- for MVP" comment). Ported from the pre-Supabase Express/MySQL schema
-- (backend/migrations/006,007,008,010,014), NDA (project_ndas) intentionally
-- excluded — partner-invite acceptance no longer requires a signed NDA.

alter type notification_type add value 'partner_invite';
alter type message_type add value 'partner_invite';
alter type message_type add value 'partner_invite_response';

create table public.project_swipes (
  id          bigint generated always as identity primary key,
  investor_id uuid not null references public.users(id) on delete cascade,
  project_id  bigint not null references public.projects(id) on delete cascade,
  direction   swipe_direction not null,
  created_at  timestamptz not null default now(),
  unique (investor_id, project_id)
);
create index project_swipes_investor_idx on public.project_swipes(investor_id);

create table public.project_matches (
  id          bigint generated always as identity primary key,
  investor_id uuid not null references public.users(id) on delete cascade,
  project_id  bigint not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (investor_id, project_id)
);
create index project_matches_investor_idx on public.project_matches(investor_id);
create index project_matches_user_idx on public.project_matches(user_id);

create table public.ai_project_scores (
  investor_id uuid not null references public.users(id) on delete cascade,
  project_id  bigint not null references public.projects(id) on delete cascade,
  score       smallint not null,
  scored_at   timestamptz not null default now(),
  primary key (investor_id, project_id)
);

create table public.project_partners (
  id         bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null default 'member',
  added_at   timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_partners_user_idx on public.project_partners(user_id);

create table public.partner_invitations (
  id          bigint generated always as identity primary key,
  project_id  bigint not null references public.projects(id) on delete cascade,
  match_id    bigint not null references public.matches(id) on delete cascade,
  inviter_id  uuid not null references public.users(id) on delete cascade,
  invitee_id  uuid not null references public.users(id) on delete cascade,
  status      text not null default 'pending',
  role_title  text,
  equity_pct  numeric(5,2),
  salary      integer,
  created_at  timestamptz not null default now(),
  unique (project_id, invitee_id)
);
create index partner_invitations_invitee_idx on public.partner_invitations(invitee_id, status);

alter table public.project_swipes enable row level security;
alter table public.project_matches enable row level security;
alter table public.ai_project_scores enable row level security;
alter table public.project_partners enable row level security;
alter table public.partner_invitations enable row level security;

create policy project_swipes_owner on public.project_swipes for all
  using (investor_id = auth.uid()) with check (investor_id = auth.uid());

create policy project_matches_select on public.project_matches for select using (
  investor_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = project_matches.project_id and p.user_id = auth.uid()));

create policy ai_project_scores_select on public.ai_project_scores for select using (investor_id = auth.uid());
-- no client insert/update policy — service role only, mirroring ai_match_scores

create policy project_partners_select on public.project_partners for select using (
  user_id = auth.uid()
  or exists (select 1 from public.projects p where p.id = project_partners.project_id and p.user_id = auth.uid()));
create policy project_partners_write_owner on public.project_partners for all using (
  exists (select 1 from public.projects p where p.id = project_partners.project_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from public.projects p where p.id = project_partners.project_id and p.user_id = auth.uid()));

create policy partner_invitations_select on public.partner_invitations for select using (
  inviter_id = auth.uid() or invitee_id = auth.uid());
create policy partner_invitations_respond on public.partner_invitations for update using (
  invitee_id = auth.uid()) with check (invitee_id = auth.uid());
-- no client insert policy — service role only (sendInvite runs with the
-- service-role DB connection after its own auth/ownership checks)
