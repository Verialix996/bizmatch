-- swipes, matches, messages: core swipe/match/chat tables.

create table public.swipes (
  id             bigint generated always as identity primary key,
  swiper_id      uuid not null references public.users(id) on delete cascade,
  swiped_id      uuid not null references public.users(id) on delete cascade,
  direction      swipe_direction not null,
  is_super_like  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (swiper_id, swiped_id)
);

create table public.matches (
  id          bigint generated always as identity primary key,
  user1_id    uuid not null references public.users(id) on delete cascade,
  user2_id    uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user1_id, user2_id)
);

-- message_type is narrowed to ('text','project_shared','meeting_proposal',
-- 'meeting_response') as part of the MVP trim: partner_invite/nda_*/job_offer
-- message kinds no longer exist.
create table public.messages (
  id            bigint generated always as identity primary key,
  match_id      bigint not null references public.matches(id) on delete cascade,
  sender_id     uuid not null references public.users(id) on delete cascade,
  body          text not null,
  message_type  message_type not null default 'text',
  metadata      jsonb,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index messages_match_id_created_idx on public.messages(match_id, created_at);
