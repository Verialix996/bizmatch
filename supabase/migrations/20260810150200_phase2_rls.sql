-- RLS for the Founder Profile pivot's Phase 2 tables. Same convention as
-- 20260810120300_founder_pivot_rls.sql: defense-in-depth, Edge Functions
-- using the service-role connection are the primary authorization layer.

alter table public.activities enable row level security;
alter table public.activity_participants enable row level security;
alter table public.activity_evaluators enable row level security;
alter table public.peer_feedback enable row level security;
alter table public.founder_compatibility enable row level security;

create policy activities_admin_full_access on public.activities
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
-- Any authenticated founder can see the activity roster (schedule, type,
-- status) — same pattern as programs/scenario_questions. Participant-level
-- detail is still gated per-row on activity_participants/activity_evaluators.
create policy activities_select_authenticated on public.activities
  for select using (auth.uid() is not null);

create policy activity_participants_admin_full_access on public.activity_participants
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy activity_participants_select_own on public.activity_participants
  for select using (founder_id = auth.uid());

create policy activity_evaluators_admin_full_access on public.activity_evaluators
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy activity_evaluators_select_own on public.activity_evaluators
  for select using (evaluator_id = auth.uid());

create policy peer_feedback_admin_full_access on public.peer_feedback
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy peer_feedback_select_own on public.peer_feedback
  for select using (founder_id = auth.uid() or author_id = auth.uid());
-- founders submit feedback about peers directly (screen 5/Phase 2 flow),
-- authored as themselves only
create policy peer_feedback_write_own on public.peer_feedback
  for insert with check (author_id = auth.uid());

create policy founder_compatibility_admin_full_access on public.founder_compatibility
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy founder_compatibility_select_own on public.founder_compatibility
  for select using (founder_a_id = auth.uid() or founder_b_id = auth.uid());
-- no client insert/update policy: compatibility rows are always written by
-- the matches Edge Function via service role (background recompute),
-- matching the evidence/ai_match_scores precedent
