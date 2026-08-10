-- RLS for the Founder Profile pivot's Phase 1 tables. Same convention as
-- 20260801145138_rls_policies.sql: policies are defense-in-depth, not the
-- sole access-control layer — Edge Functions use the service-role
-- connection and are the primary gate (requireAdmin() etc). Admins get
-- full access; founders get read-only access to their own rows only.
--
-- This file is safe to reference the 'admin' user_role value because it
-- runs in a separate migration/transaction from the one that added it
-- (20260810120000_founder_pivot_enums.sql already committed by the time
-- this applies).

alter table public.programs enable row level security;
alter table public.founder_profiles enable row level security;
alter table public.founder_capabilities enable row level security;
alter table public.partner_requirements enable row level security;
alter table public.deal_breakers enable row level security;
alter table public.scenario_questions enable row level security;
alter table public.scenario_responses enable row level security;
alter table public.evidence enable row level security;
alter table public.evaluator_assessments enable row level security;
alter table public.evaluator_assessment_items enable row level security;
alter table public.founder_dna_snapshots enable row level security;

create policy programs_admin_full_access on public.programs
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy programs_select_authenticated on public.programs
  for select using (auth.uid() is not null);

create policy founder_profiles_admin_full_access on public.founder_profiles
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy founder_profiles_select_own on public.founder_profiles
  for select using (user_id = auth.uid());
-- Founders self-author their own Profile during onboarding (spec sections
-- 20-21) — "read-only" per the product decision means read-only on
-- admin/evaluator-authored content (evidence, DNA, insights), not on a
-- founder's own onboarding data.
create policy founder_profiles_write_own on public.founder_profiles
  for insert with check (user_id = auth.uid());
create policy founder_profiles_update_own on public.founder_profiles
  for update using (user_id = auth.uid());

create policy founder_capabilities_admin_full_access on public.founder_capabilities
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy founder_capabilities_select_own on public.founder_capabilities
  for select using (founder_id = auth.uid());
create policy founder_capabilities_write_own on public.founder_capabilities
  for insert with check (founder_id = auth.uid());
create policy founder_capabilities_update_own on public.founder_capabilities
  for update using (founder_id = auth.uid());
create policy founder_capabilities_delete_own on public.founder_capabilities
  for delete using (founder_id = auth.uid());

create policy partner_requirements_admin_full_access on public.partner_requirements
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy partner_requirements_select_own on public.partner_requirements
  for select using (founder_id = auth.uid());
create policy partner_requirements_write_own on public.partner_requirements
  for insert with check (founder_id = auth.uid());
create policy partner_requirements_update_own on public.partner_requirements
  for update using (founder_id = auth.uid());

create policy deal_breakers_admin_full_access on public.deal_breakers
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy deal_breakers_select_own on public.deal_breakers
  for select using (founder_id = auth.uid());
create policy deal_breakers_write_own on public.deal_breakers
  for insert with check (founder_id = auth.uid());
create policy deal_breakers_delete_own on public.deal_breakers
  for delete using (founder_id = auth.uid());

create policy scenario_questions_admin_write on public.scenario_questions
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy scenario_questions_select_authenticated on public.scenario_questions
  for select using (auth.uid() is not null);

create policy scenario_responses_admin_full_access on public.scenario_responses
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy scenario_responses_select_own on public.scenario_responses
  for select using (founder_id = auth.uid());
-- founders write their own scenario responses directly during onboarding
create policy scenario_responses_write_own on public.scenario_responses
  for insert with check (founder_id = auth.uid());
create policy scenario_responses_update_own on public.scenario_responses
  for update using (founder_id = auth.uid());

create policy evidence_admin_full_access on public.evidence
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy evidence_select_own on public.evidence
  for select using (founder_id = auth.uid());
-- no client insert policy: evidence is always written by an Edge Function
-- via service role (from evaluator_assessments/peer_feedback fan-out or
-- direct admin entry), matching the ai_match_scores precedent

create policy evaluator_assessments_admin_full_access on public.evaluator_assessments
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy evaluator_assessments_select_own on public.evaluator_assessments
  for select using (founder_id = auth.uid());

create policy evaluator_assessment_items_admin_full_access on public.evaluator_assessment_items
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy evaluator_assessment_items_select_own on public.evaluator_assessment_items
  for select using (
    exists (
      select 1 from public.evaluator_assessments a
      where a.id = evaluator_assessment_items.assessment_id and a.founder_id = auth.uid()
    )
  );

create policy founder_dna_snapshots_admin_full_access on public.founder_dna_snapshots
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy founder_dna_snapshots_select_own on public.founder_dna_snapshots
  for select using (founder_id = auth.uid());
