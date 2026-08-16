-- COPY-02: onboarding/edit-profile forced picking at least one deal breaker,
-- with no way to say "I genuinely have none" — the validation couldn't tell
-- "not filled in yet" from "deliberately none" apart from this flag.
alter table public.founder_profiles
  add column no_deal_breakers_declared boolean not null default false;
