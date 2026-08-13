-- Founder DNA self-assessment: 5 open-ended questions per evidence dimension
-- (40 total, see supabase/functions/_shared/dnaQuestions.ts), answered once
-- from onboarding (or later from the profile page) and scored by Gemini into
-- one evidence row per dimension (source_type = 'self', see SOURCE_WEIGHTS.self
-- in founderScoring.ts). Deliberately a separate mechanism from the unused
-- scenario_questions/scenario_responses tables in founder_profile_core.sql,
-- which model closed multiple-choice scenarios for a narrower 3-kind
-- (values/conflict/work_style) mapping — this covers open text across all 8
-- evidence dimensions, evaluated by LLM rather than a fixed option->weight
-- table.

alter table public.founder_profiles
  add column dna_self_assessment_completed_at timestamptz;

create table public.dna_self_assessment_responses (
  id             bigint generated always as identity primary key,
  founder_id     uuid not null references public.users(id) on delete cascade,
  dimension      evidence_dimension not null,
  question_index smallint not null check (question_index between 1 and 5),
  question       text not null,
  answer         text not null,
  created_at     timestamptz not null default now(),
  unique (founder_id, dimension, question_index)
);
create index dna_self_assessment_responses_founder_idx on public.dna_self_assessment_responses(founder_id);
