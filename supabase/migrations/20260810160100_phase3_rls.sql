-- RLS for the Founder Profile pivot's Phase 3 tables. Same convention as
-- 20260810120300_founder_pivot_rls.sql / 20260810150200_phase2_rls.sql.

alter table public.teams enable row level security;
alter table public.team_founders enable row level security;
alter table public.team_dna_snapshots enable row level security;

create policy teams_admin_full_access on public.teams
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
-- Any authenticated founder can see team rosters exist (name, program) —
-- same pattern as activities/programs; membership detail is gated on
-- team_founders below.
create policy teams_select_authenticated on public.teams
  for select using (auth.uid() is not null);

create policy team_founders_admin_full_access on public.team_founders
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
-- A founder can see their own team's full roster, not just their own row,
-- so their Team Profile view can list teammates.
create policy team_founders_select_own_team on public.team_founders
  for select using (
    team_id in (select tf.team_id from public.team_founders tf where tf.founder_id = auth.uid())
  );

create policy team_dna_snapshots_admin_full_access on public.team_dna_snapshots
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy team_dna_snapshots_select_own_team on public.team_dna_snapshots
  for select using (
    team_id in (select tf.team_id from public.team_founders tf where tf.founder_id = auth.uid())
  );
-- no client insert policy: team_dna_snapshots is always written by the
-- teams Edge Function via service role, matching founder_dna_snapshots
