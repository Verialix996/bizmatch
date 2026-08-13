-- Activity registration: founders no longer just get bulk-assigned by an
-- admin — they can request to join an upcoming activity themselves, and an
-- admin approves/rejects the request. `status` defaults to 'approved' so
-- existing rows (all admin-assigned via the old bulk-replace endpoint) don't
-- retroactively vanish from anyone's view.
alter table public.activity_participants
  add column status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  add column requested_at timestamptz not null default now(),
  add column decided_at timestamptz;
