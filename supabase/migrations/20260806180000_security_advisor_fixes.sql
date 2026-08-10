-- Resolves Supabase Security Advisor findings:
-- 1. RLS disabled on public.rate_limits — table is only ever read/written by
--    Edge Functions via the service_role key (which bypasses RLS), so enabling
--    RLS with no policies locks out anon/authenticated access without breaking
--    anything.
-- 2. handle_new_auth_user / handle_auth_user_verified are SECURITY DEFINER
--    trigger functions with EXECUTE still granted to PUBLIC (Postgres's
--    default). Triggers invoke them regardless of caller privileges, so
--    revoking EXECUTE from anon/authenticated closes the direct-call surface
--    without affecting the auth.users triggers.

alter table public.rate_limits enable row level security;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_verified() from public, anon, authenticated;
