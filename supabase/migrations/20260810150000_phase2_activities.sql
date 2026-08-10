-- Founder Profile pivot Phase 2: Activities (spec screens 5-6 in the
-- reconciled MVP doc — hackathons/workshops/interviews/team challenges/
-- work trials that founders participate in and evaluators assess).
--
-- activity_type is a brand-new enum type, not an added value on an
-- existing type, so it can be created and used (as a column type) in the
-- same transaction/file — the "can't use a freshly added value in the same
-- transaction" restriction only applies to `alter type ... add value`.
create type activity_type as enum
  ('hackathon', 'workshop', 'interview', 'team_challenge', 'work_trial');

create table public.activities (
  id           bigint generated always as identity primary key,
  program_id   bigint references public.programs(id) on delete set null,
  type         activity_type not null,
  title        text not null,
  description  text,
  scheduled_at timestamptz,
  status       text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed')),
  team_id      bigint, -- Phase 3: FK to not-yet-created `teams`, added once that table exists
  created_at   timestamptz not null default now()
);
create index activities_program_idx on public.activities(program_id);
create index activities_scheduled_idx on public.activities(scheduled_at);

create table public.activity_participants (
  activity_id bigint not null references public.activities(id) on delete cascade,
  founder_id  uuid not null references public.users(id) on delete cascade,
  primary key (activity_id, founder_id)
);

create table public.activity_evaluators (
  activity_id  bigint not null references public.activities(id) on delete cascade,
  evaluator_id uuid not null references public.users(id) on delete cascade,
  primary key (activity_id, evaluator_id)
);

-- Backfill the FK on evidence.activity_id / evaluator_assessments.activity_id
-- that Phase 1 (20260810120200_evidence_and_assessments.sql) deliberately
-- left as a plain bigint, now that `activities` exists.
alter table public.evidence
  add constraint evidence_activity_id_fkey
  foreign key (activity_id) references public.activities(id) on delete set null;

alter table public.evaluator_assessments
  add constraint evaluator_assessments_activity_id_fkey
  foreign key (activity_id) references public.activities(id) on delete set null;
