-- Row Level Security policies. The Express backend uses the service-role
-- Postgres connection for all of today's queries (bypasses RLS, matching
-- current app-level-only enforcement), so these policies are defense-in-depth
-- and groundwork for any future direct-from-client Supabase usage (e.g.
-- Realtime chat subscriptions), not the sole access-control layer yet.
--
-- Not enforceable via RLS alone (stays service-role, in Express):
--   - daily swipe-limit counting (atomic conditional upsert tied to premium gating)
--   - ai_match_scores background scoring (writes arbitrary user pairs)
--   - moderation / Cloudinary / push-notification orchestration
--   - the registration auto-provision trigger (runs security definer by design)

alter table public.users enable row level security;
alter table public.investor_profiles enable row level security;
alter table public.user_activity enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.projects enable row level security;
alter table public.meetings enable row level security;
alter table public.ai_match_scores enable row level security;
alter table public.notifications enable row level security;

create policy users_select_self on public.users
  for select using (id = auth.uid());
create policy users_select_public on public.users
  for select using (deleted_at is null);
create policy users_update_self on public.users
  for update using (id = auth.uid());

create policy investor_profiles_select_public on public.investor_profiles
  for select using (true);
create policy investor_profiles_write_self on public.investor_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_activity_self_only on public.user_activity
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy swipes_select_own on public.swipes
  for select using (swiper_id = auth.uid());
create policy swipes_insert_own on public.swipes
  for insert with check (swiper_id = auth.uid());

create policy matches_select_participant on public.matches
  for select using (auth.uid() in (user1_id, user2_id));

create policy messages_select_participant on public.messages
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = messages.match_id and auth.uid() in (m.user1_id, m.user2_id)
    )
  );
create policy messages_insert_participant on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id and auth.uid() in (m.user1_id, m.user2_id)
    )
  );

create policy projects_select_public on public.projects
  for select using (is_active or user_id = auth.uid());
create policy projects_write_owner on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy meetings_select_participant on public.meetings
  for select using (auth.uid() in (proposer_id, receiver_id));
create policy meetings_write_participant on public.meetings
  for all using (auth.uid() in (proposer_id, receiver_id)) with check (auth.uid() in (proposer_id, receiver_id));

create policy ai_match_scores_select_self on public.ai_match_scores
  for select using (user_id = auth.uid());
-- no client insert policy: only the background scoring job writes, via service role

create policy notifications_select_self on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update_self on public.notifications
  for update using (user_id = auth.uid());
-- no client insert policy: emitNotification always runs server-side via service role
