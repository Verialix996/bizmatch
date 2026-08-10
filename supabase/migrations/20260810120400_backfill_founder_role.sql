-- Backfill existing users onto the new role model now that 'founder' is a
-- committed enum value (added in 20260810120000, a prior/separate
-- transaction — safe to use here). Every existing entrepreneur/investor
-- becomes a founder; there is no investor persona in the pivot. Promote
-- specific accounts to 'admin' manually afterward (this migration
-- intentionally does not guess who the program admin is).

update public.users
set role = 'founder'
where role in ('entrepreneur', 'investor');
