-- Founder Profile pivot: core founder-domain tables (spec section 25's
-- Core Data Architecture: PROGRAM -> FOUNDERS -> {PROFILE, CAPABILITIES,
-- VALUES, PREFERENCES, DEAL BREAKERS}). public.users stays the root
-- identity row; founder_profiles is the new 1:1 domain object everything
-- else hangs off, mirroring the existing investor_profiles sparse-table
-- pattern rather than further bloating users.

create table public.programs (
  id           bigint generated always as identity primary key,
  name         text not null,
  cohort_label text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.founder_profiles (
  user_id                 uuid primary key references public.users(id) on delete cascade,
  current_role            text,
  venture_name            text,
  industry                text,
  location                text,
  current_stage           project_stage,
  commitment_hours        integer,
  commitment_type         text,
  commitment_risk_appetite text,
  program_id              bigint references public.programs(id) on delete set null,
  status                  founder_status not null default 'active',
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index founder_profiles_program_idx on public.founder_profiles(program_id);

-- The 13-item capability list (Engineering, Product, UX/UI, Sales, GTM,
-- Marketing, Operations, Finance, Fundraising, Domain Expertise, Community,
-- Network/Introductions, Leadership) is intentionally a shared frontend/
-- edge-function code constant, not a DB enum — the spec frames it as
-- tunable product config, and a plain text column avoids the "can't use a
-- freshly added enum value in the same transaction" friction for a list
-- likely to change during the pilot.
create table public.founder_capabilities (
  id           bigint generated always as identity primary key,
  founder_id   uuid not null references public.users(id) on delete cascade,
  kind         capability_kind not null,
  capability   text not null,
  score        smallint not null check (score between 0 and 100),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (founder_id, kind, capability)
);
create index founder_capabilities_founder_idx on public.founder_capabilities(founder_id);

create table public.partner_requirements (
  founder_id         uuid primary key references public.users(id) on delete cascade,
  role_wanted        text,
  must_provide       jsonb not null default '[]'::jsonb,
  commitment_required text,
  ambition_required   text,
  preferred_traits    jsonb not null default '[]'::jsonb,
  updated_at          timestamptz not null default now()
);

-- Deal breakers are deliberately a normalized table, not a JSONB array on
-- partner_requirements: the Phase 2 match engine's Deal Breaker Engine
-- needs to reason over (and flag) individual deal breakers, one at a time.
create table public.deal_breakers (
  id           bigint generated always as identity primary key,
  founder_id   uuid not null references public.users(id) on delete cascade,
  label        text not null,
  created_at   timestamptz not null default now(),
  unique (founder_id, label)
);

-- Content-driven Values/Conflict/Work-Style scenario question bank
-- (spec sections 22-23). The per-option -> dimension weight mapping is a
-- code constant for Phase 1 (see supabase/functions/_shared/founderScoring.ts);
-- promote to a table only if it needs live tuning by program staff.
create table public.scenario_questions (
  id              bigint generated always as identity primary key,
  kind            scenario_kind not null,
  prompt          text not null,
  options         jsonb not null default '[]'::jsonb,
  allow_free_text boolean not null default false,
  is_active       boolean not null default true,
  sort_order      integer not null default 0
);

create table public.scenario_responses (
  id            bigint generated always as identity primary key,
  founder_id    uuid not null references public.users(id) on delete cascade,
  question_id   bigint not null references public.scenario_questions(id) on delete cascade,
  selected_key  text,
  free_text     text,
  created_at    timestamptz not null default now(),
  unique (founder_id, question_id)
);
