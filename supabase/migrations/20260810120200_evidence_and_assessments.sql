-- Founder Profile pivot: the Evidence object (spec section 9) and the
-- structured Interview/Evaluation submission form that feeds it (spec
-- screen 6 in the reconciled MVP doc).
--
-- evidence.activity_id is a plain bigint here (no FK yet) because
-- `activities` is a Phase 2 table — the FK constraint gets added in the
-- Phase 2 migration once that table exists, keeping each phase's schema
-- change independently applicable.

create table public.evidence (
  id             bigint generated always as identity primary key,
  founder_id     uuid not null references public.users(id) on delete cascade,
  source_type    evidence_source not null,
  activity_id    bigint,
  evaluator_id   uuid references public.users(id) on delete set null,
  dimension      evidence_dimension not null,
  signal         text,
  score          smallint not null check (score between 1 and 100),
  confidence     text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  observation    text,
  is_negative    boolean not null default false,
  -- Snapshot of the section-27 source-type weight at write time. Never
  -- retroactively rewritten if weights are re-tuned later, so Profile
  -- Evolution history (section 11) stays accurate to what was believed at
  -- the time, not what the current weighting config says in hindsight.
  weight         numeric(4, 2) not null default 1.0,
  created_at     timestamptz not null default now()
);
create index evidence_founder_dimension_idx on public.evidence(founder_id, dimension);
create index evidence_founder_created_idx on public.evidence(founder_id, created_at desc);

-- Interview/Evaluation form (MVP screen 6): broader than a raw per-dimension
-- score, since the form supports mixed open questions, 1-5 scales, yes/no,
-- and tags. A mapping step in founderScoring.ts translates answered items
-- into evidence rows at weight = 1.0.
create table public.evaluator_assessments (
  id            bigint generated always as identity primary key,
  founder_id    uuid not null references public.users(id) on delete cascade,
  evaluator_id  uuid not null references public.users(id) on delete cascade,
  activity_id   bigint,
  notes         text,
  submitted_at  timestamptz not null default now()
);
create index evaluator_assessments_founder_idx on public.evaluator_assessments(founder_id);

create table public.evaluator_assessment_items (
  id             bigint generated always as identity primary key,
  assessment_id  bigint not null references public.evaluator_assessments(id) on delete cascade,
  question_text  text not null,
  answer_type    text not null check (answer_type in ('open_text', 'scale_1_5', 'yes_no', 'tags')),
  answer         jsonb not null default 'null'::jsonb,
  criteria_tag   evidence_dimension,
  notes          text
);
create index evaluator_assessment_items_assessment_idx on public.evaluator_assessment_items(assessment_id);

-- Append-only computed DNA snapshots. "Current DNA" for a founder is the
-- latest snapshot per (founder_id, dimension) — never overwritten in place,
-- so this same table doubles as the Phase 3 Profile Evolution history.
-- score is nullable: null means "no evidence yet" (spec section 11/30) —
-- never fabricate a 0.
create table public.founder_dna_snapshots (
  id                   bigint generated always as identity primary key,
  founder_id           uuid not null references public.users(id) on delete cascade,
  dimension            evidence_dimension not null,
  score                smallint,
  confidence           text check (confidence in ('low', 'medium', 'high')),
  evidence_count       integer not null default 0,
  computed_at          timestamptz not null default now(),
  trigger_evidence_id  bigint references public.evidence(id) on delete set null
);
create index founder_dna_snapshots_lookup_idx on public.founder_dna_snapshots(founder_id, dimension, computed_at desc);
