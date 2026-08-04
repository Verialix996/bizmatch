-- Extensions and shared enum types for the BizMatch MVP schema.

create extension if not exists "pgcrypto";

create type user_role           as enum ('entrepreneur', 'investor');
create type verification_status as enum ('none', 'pending', 'verified', 'rejected');
create type project_stage       as enum ('idea', 'mvp', 'growth', 'scale');
create type swipe_direction     as enum ('like', 'pass');
create type message_type        as enum ('text', 'project_shared', 'meeting_proposal', 'meeting_response');
create type meeting_location    as enum ('virtual', 'in_person');
create type meeting_status      as enum ('proposed', 'confirmed', 'declined', 'cancelled');
create type notification_type   as enum ('match', 'meeting', 'super_like', 'message');
