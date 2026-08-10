-- Founder Profile pivot Phase 3: Teams (spec screens 9-10 — Team Creation
-- and Team Profile). Narrowly scoped per the reconciled plan's own lesson
-- from the reverted `20260801180000_challenges_teams_offers.sql` attempt:
-- founder membership + computed Team DNA only, no pitch/negotiation
-- workflow re-absorbed into this concept.

create table public.teams (
  id           bigint generated always as identity primary key,
  program_id   bigint references public.programs(id) on delete set null,
  name         text not null,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index teams_program_idx on public.teams(program_id);

create table public.team_founders (
  team_id    bigint not null references public.teams(id) on delete cascade,
  founder_id uuid not null references public.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (team_id, founder_id),
  unique (founder_id) -- a founder is on at most one team at a time (MVP scope)
);

-- Append-only, mirrors founder_dna_snapshots: "current" Team DNA is the
-- latest snapshot per (team_id, dimension). score nullable — never
-- fabricate a 0 for a dimension no member has evidence on yet.
create table public.team_dna_snapshots (
  id           bigint generated always as identity primary key,
  team_id      bigint not null references public.teams(id) on delete cascade,
  dimension    evidence_dimension not null,
  score        smallint,
  confidence   text check (confidence in ('low', 'medium', 'high')),
  computed_at  timestamptz not null default now()
);
create index team_dna_snapshots_lookup_idx on public.team_dna_snapshots(team_id, dimension, computed_at desc);

-- Team Challenges (activity_type='team_challenge') reuse the existing
-- activity mechanism instead of a parallel table, per the Phase 2 plan.
-- activities.team_id already exists as a plain bigint (added in
-- 20260810150000_phase2_activities.sql, deliberately left FK-less since
-- `teams` didn't exist yet) — backfill the FK now that it does.
alter table public.activities
  add constraint activities_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;
