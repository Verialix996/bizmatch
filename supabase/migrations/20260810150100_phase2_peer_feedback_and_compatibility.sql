-- Founder Profile pivot Phase 2: Peer Feedback (fans out into `evidence` at
-- weight 0.8, same shape as evaluator_assessments' fan-out at weight 1.0)
-- and Founder Compatibility (the Matching screen's computed/cached output,
-- replacing the old ai_match_scores table with an explanation- and
-- deal-breaker-aware shape).

create table public.peer_feedback (
  id           bigint generated always as identity primary key,
  founder_id   uuid not null references public.users(id) on delete cascade, -- subject of the feedback
  author_id    uuid not null references public.users(id) on delete cascade, -- peer giving it
  activity_id  bigint references public.activities(id) on delete set null,
  dimension    evidence_dimension not null,
  score        smallint not null check (score between 1 and 100),
  observation  text,
  created_at   timestamptz not null default now(),
  check (founder_id <> author_id)
);
create index peer_feedback_founder_idx on public.peer_feedback(founder_id);

-- Cached compatibility between two founders. (founder_a_id, founder_b_id)
-- is always stored in canonical order (a < b, compared as text) so a pair
-- has exactly one row regardless of lookup direction.
create table public.founder_compatibility (
  founder_a_id          uuid not null references public.users(id) on delete cascade,
  founder_b_id          uuid not null references public.users(id) on delete cascade,
  score                 smallint not null check (score between 0 and 100),
  dimension_breakdown   jsonb not null default '{}'::jsonb,
  -- { positives: string[], risks: string[] }
  explanation           jsonb not null default '{"positives": [], "risks": []}'::jsonb,
  deal_breaker_flags    jsonb not null default '[]'::jsonb,
  requires_admin_review boolean not null default false,
  computed_at           timestamptz not null default now(),
  primary key (founder_a_id, founder_b_id),
  check (founder_a_id < founder_b_id)
);
create index founder_compatibility_score_idx on public.founder_compatibility(score desc);
