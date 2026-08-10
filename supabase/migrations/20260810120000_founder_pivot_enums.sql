-- Founder Profile pivot: new enum values + new enum types.
--
-- `user_role` gets two new values (`admin`, `founder`) rather than a new
-- table/boolean — this activates the already-written-but-dead
-- requireAdmin() check in supabase/functions/_shared/auth.ts, and matches
-- the existing single-role-column pattern used throughout the frontend
-- (AppNavigator.js / appStore.js branch on `user.role`).
--
-- Per Postgres rules, a newly added enum value cannot be used (compared,
-- cast, inserted) in the same transaction that adds it. This file only adds
-- values/types and never references them — safe to combine here. Any
-- migration that filters/inserts on 'admin' or 'founder' must live in a
-- later, separate migration file (see 20260810120100 onward).

alter type user_role add value 'admin';
alter type user_role add value 'founder';

create type founder_status     as enum ('active', 'inactive', 'dropped');
create type capability_kind    as enum ('provide', 'need');
create type scenario_kind      as enum ('values', 'conflict', 'work_style');
create type evidence_source    as enum
  ('self', 'peer', 'evaluator', 'interview', 'activity', 'work_trial', 'reference');
create type evidence_dimension as enum
  ('execution', 'integrity', 'commitment', 'communication', 'conflict', 'resilience', 'ego', 'values');
