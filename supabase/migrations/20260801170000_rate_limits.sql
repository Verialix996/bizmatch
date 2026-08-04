-- Fixed-window rate limiting for Edge Functions (stateless — no in-memory store
-- like express-rate-limit had). Keyed by "scope:ip" (e.g. "api:1.2.3.4").
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 1,
  primary key (key, window_start)
);

-- Old windows accumulate forever otherwise; prune anything more than a day stale.
create index rate_limits_window_start_idx on public.rate_limits(window_start);
