-- meetings (ai_briefing column cut for MVP), ai_match_scores (person-to-person
-- background AI scoring only — project scoring cut with the project-swipe
-- backend), notifications (partner_invite type cut for MVP).

create table public.meetings (
  id             bigint generated always as identity primary key,
  match_id       bigint not null references public.matches(id) on delete cascade,
  proposer_id    uuid not null references public.users(id) on delete cascade,
  receiver_id    uuid not null references public.users(id) on delete cascade,
  title          text,
  scheduled_at   timestamptz not null,
  location_type  meeting_location not null,
  video_link     text,
  address        text,
  status         meeting_status not null default 'proposed',
  created_at     timestamptz not null default now()
);

create table public.ai_match_scores (
  user_id       uuid not null references public.users(id) on delete cascade,
  candidate_id  uuid not null references public.users(id) on delete cascade,
  score         smallint not null,
  scored_at     timestamptz not null default now(),
  primary key (user_id, candidate_id)
);

create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  type        notification_type not null,
  ref_id      bigint,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications(user_id, read_at);
