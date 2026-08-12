-- Founder Interview tool (ported from the standalone "interview-main" app):
-- structured, evaluator-run interviews using a fixed question tree, stored
-- as answers/meta JSON rather than forced into the scored evidence
-- pipeline — this tree is a market/problem-validation interview, not a
-- character assessment, so its content doesn't honestly map to the 8
-- evidence dimensions. It's surfaced on the founder profile as its own
-- section instead of fabricating dimension scores from it.

create table public.founder_interviews (
  id             uuid primary key default gen_random_uuid(),
  founder_id     uuid not null references public.users(id) on delete cascade,
  interviewer_id uuid references public.users(id) on delete set null,
  status         text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  meta           jsonb not null default '{}'::jsonb,
  answers        jsonb not null default '{}'::jsonb,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index founder_interviews_founder_idx on public.founder_interviews(founder_id);
create index founder_interviews_interviewer_idx on public.founder_interviews(interviewer_id);

-- Evaluators can create a placeholder founder (a real public.users +
-- founder_profiles row, via the Auth admin API with an unconfirmed email
-- and no password) for someone not registered yet, so an interview can be
-- attached before that person ever signs up. They "claim" the account
-- later via a password-reset/invite flow using the same email. This flag
-- is purely informational — it never needs to flip back.
alter table public.founder_profiles
  add column is_prospect boolean not null default false;
