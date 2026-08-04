-- projects: single-owner project listings (team/partners concept cut for MVP).

create table public.projects (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.users(id) on delete cascade,
  title           text not null,
  description     text,
  stage           project_stage,
  funding_needed  integer,
  industry        text,
  icon_url        text,
  deck_url        text,
  video_url       text,
  is_active       boolean not null default true,
  visibility      text not null default 'public',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index projects_user_id_idx on public.projects(user_id);
create index projects_active_idx on public.projects(is_active) where is_active;
