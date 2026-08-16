-- DNA self-assessment v2: 8 questions (1/dimension) replacing the original
-- 40 (5/dimension) — see BizMatch_Interview_Grounded_Onboarding_Spec and
-- supabase/functions/_shared/dnaQuestions.ts. v1's question_index-keyed rows
-- are never deleted; v2 rows key on a stable question_id instead, scoped by
-- assessment_version so re-submitting under v2 can never collide with or
-- overwrite a founder's original v1 answers.

alter table public.dna_self_assessment_responses
  add column assessment_version smallint not null default 1,
  add column question_id text;

-- Backfill existing (v1) rows with a synthesized id so the new unique
-- constraint is well-formed for them too — harmless, these rows are
-- historical and never written to again under v1.
update public.dna_self_assessment_responses
  set question_id = dimension::text || '_v1_q' || question_index
  where question_id is null;

alter table public.dna_self_assessment_responses
  drop constraint dna_self_assessment_responses_founder_id_dimension_question_key,
  add constraint dna_self_assessment_responses_v2_key
    unique (founder_id, assessment_version, dimension, question_id);

-- Tracks the background-scoring pipeline's status for a founder's most
-- recent submission, so a slow/failed Gemini call never blocks onboarding —
-- answers are saved and this flips to 'pending' before scoring is attempted;
-- the frontend can show a retry affordance on 'failed' instead of erroring
-- the whole onboarding flow.
alter table public.founder_profiles
  add column dna_scoring_status text not null default 'unscored'
    check (dna_scoring_status in ('unscored', 'pending', 'scored', 'failed'));

-- Compatibility "Provisional" labeling: a pair's score can look deceptively
-- complete when it's actually only backed by capability complementarity
-- (no DNA evidence on either side yet) — see founderScoring.ts's coverage
-- field. Persisted here so the Matching/Team Profile screens don't need to
-- recompute coverage themselves to decide whether to show the label.
alter table public.founder_compatibility
  add column is_provisional boolean not null default false;
