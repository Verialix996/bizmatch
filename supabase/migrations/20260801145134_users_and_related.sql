-- users (merged with the old user_profiles — always 1:1 joined), investor_profiles
-- (kept separate, sparse/investor-only), user_activity (kept separate, isolates
-- high-write-frequency columns from the profile row), and auth.users provisioning
-- triggers that replace the old 4-table non-atomic registration insert chain.

create table public.users (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null unique,
  name                 text,
  role                 user_role,
  is_verified          boolean not null default false,
  verification_status  verification_status not null default 'none',
  -- merged from the old user_profiles table
  photo_url            text,
  bio                  text,
  skills               jsonb not null default '[]'::jsonb,
  hobbies              jsonb not null default '[]'::jsonb,
  portfolio_url        text,
  linkedin_url         text,
  experience           text,
  cv_url               text,
  -- premium is low write-frequency, fine to co-locate on the profile row
  is_premium           boolean not null default false,
  premium_expires_at   timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index users_role_idx on public.users(role) where deleted_at is null;

create table public.investor_profiles (
  user_id             uuid primary key references public.users(id) on delete cascade,
  investment_domain   jsonb default '[]'::jsonb,
  preferred_stage     project_stage,
  max_investment      numeric(15,2)
);

create table public.user_activity (
  user_id               uuid primary key references public.users(id) on delete cascade,
  push_token            text,
  last_active_at        timestamptz,
  swipe_count           integer not null default 0,
  swipe_count_date      date,
  has_seen_onboarding   boolean not null default false
);

-- Auto-provision public.users + public.user_activity when Supabase Auth creates
-- an auth.users row (i.e. on supabase.auth.signUp / OAuth sign-in). Reads
-- name/role from the signUp call's raw_user_meta_data. Runs as security definer
-- since it must write to public.users on behalf of the system, not the acting user.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, role, is_verified)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', null),
    nullif(new.raw_user_meta_data ->> 'role', '')::user_role,
    coalesce(new.email_confirmed_at is not null, false)
  )
  on conflict (id) do nothing;

  insert into public.user_activity (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep is_verified in sync if a user confirms their email after the row already
-- exists (e.g. OTP verification lands after initial provisioning).
create function public.handle_auth_user_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.users set is_verified = true, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.handle_auth_user_verified();
