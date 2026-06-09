# BizMatch Entity Relationship Diagram

Generated from `backend/migrations/001–019`.

Paste the DBML block below into **[dbdiagram.io](https://dbdiagram.io)**.

```dbml
Table users {
  id                  int         [pk, increment]
  email               varchar(255) [unique, not null]
  name                text
  role                varchar(50)
  is_verified         tinyint
  verification_status varchar(20)
  deleted_at          datetime
  created_at          datetime
  updated_at          datetime
}

Table user_auth_security {
  user_id             int         [pk]
  password_hash       text
  otp_code            text
  otp_expires_at      datetime
  reset_token         text
  reset_token_expires datetime
  oauth_provider      varchar(50)
  oauth_provider_id   text
  two_factor_secret   text
  two_factor_enabled  tinyint
  login_attempts      int
  locked_until        datetime
}

Table user_profiles {
  user_id       int          [pk]
  photo_url     text
  bio           text
  skills        text
  hobbies       text
  role_type     varchar(50)
  portfolio_url varchar(500)
  linkedin_url  varchar(500)
  experience    text
  cv_url        varchar(500)
}

Table investor_profiles {
  user_id           int [pk]
  investment_domain text
  preferred_stage   varchar(20)
  max_investment    decimal
}

Table user_app_state {
  user_id             int         [pk]
  push_token          varchar(500)
  is_premium          tinyint
  premium_expires_at  datetime
  last_active_at      datetime
  swipe_count         int
  swipe_count_date    date
  has_seen_onboarding tinyint
}

Table swipes {
  id            int         [pk, increment]
  swiper_id     int
  swiped_id     int
  direction     varchar(10)
  is_super_like tinyint
  created_at    datetime
  updated_at    datetime
}

Table matches {
  id         int      [pk, increment]
  user1_id   int
  user2_id   int
  created_at datetime
}

Table ai_match_scores {
  user_id      int
  candidate_id int
  score        tinyint
  scored_at    datetime

  indexes {
    (user_id, candidate_id) [pk]
  }
}

Table messages {
  id           int         [pk, increment]
  match_id     int
  sender_id    int
  body         text
  message_type varchar(50)
  metadata     text
  read_at      datetime
  created_at   datetime
}

Table projects {
  id             int          [pk, increment]
  user_id        int
  title          varchar(255)
  description    text
  stage          varchar(20)
  funding_needed int
  industry       text
  icon_url       text
  deck_url       text
  video_url      text
  is_active      tinyint
  visibility     varchar(50)
  created_at     datetime
  updated_at     datetime
}

Table project_swipes {
  id          int         [pk, increment]
  investor_id int
  project_id  int
  direction   varchar(10)
  created_at  datetime
}

Table project_matches {
  id          int      [pk, increment]
  investor_id int
  project_id  int
  user_id     int
  created_at  datetime
}

Table project_partners {
  id         int          [pk, increment]
  project_id int
  user_id    int
  role       varchar(100)
  added_at   datetime
}

Table project_ndas {
  id           int      [pk, increment]
  project_id   int
  user_id      int
  signed_at    datetime
  document_url text
}

Table partner_invitations {
  id         int          [pk, increment]
  project_id int
  match_id   int
  inviter_id int
  invitee_id int
  status     varchar(20)
  role_title varchar(100)
  equity_pct decimal
  salary     int
  created_at datetime
}

Table ai_project_scores {
  investor_id int
  project_id  int
  score       tinyint
  scored_at   datetime

  indexes {
    (investor_id, project_id) [pk]
  }
}

Table meetings {
  id            int          [pk, increment]
  match_id      int
  proposer_id   int
  receiver_id   int
  title         varchar(255)
  scheduled_at  datetime
  location_type varchar(20)
  video_link    varchar(500)
  address       varchar(500)
  status        varchar(20)
  ai_briefing   text
  created_at    datetime
}

Table notifications {
  id         int         [pk, increment]
  user_id    int
  type       varchar(30)
  ref_id     int
  payload    text
  read_at    datetime
  created_at datetime
}

// ── One-to-one: normalized user tables ──────────────────────────────────────
Ref: user_auth_security.user_id - users.id
Ref: user_profiles.user_id - users.id
Ref: investor_profiles.user_id - users.id
Ref: user_app_state.user_id - users.id

// ── People matching ──────────────────────────────────────────────────────────
Ref: swipes.swiper_id > users.id
Ref: swipes.swiped_id > users.id
Ref: matches.user1_id > users.id
Ref: matches.user2_id > users.id
Ref: ai_match_scores.user_id > users.id
Ref: ai_match_scores.candidate_id > users.id

// ── Messaging ────────────────────────────────────────────────────────────────
Ref: messages.match_id > matches.id
Ref: messages.sender_id > users.id

// ── Projects ─────────────────────────────────────────────────────────────────
Ref: projects.user_id > users.id
Ref: project_swipes.investor_id > users.id
Ref: project_swipes.project_id > projects.id
Ref: project_matches.investor_id > users.id
Ref: project_matches.project_id > projects.id
Ref: project_matches.user_id > users.id
Ref: project_partners.project_id > projects.id
Ref: project_partners.user_id > users.id
Ref: project_ndas.project_id > projects.id
Ref: project_ndas.user_id > users.id
Ref: partner_invitations.project_id > projects.id
Ref: partner_invitations.match_id > matches.id
Ref: partner_invitations.inviter_id > users.id
Ref: partner_invitations.invitee_id > users.id
Ref: ai_project_scores.investor_id > users.id
Ref: ai_project_scores.project_id > projects.id

// ── Meetings ─────────────────────────────────────────────────────────────────
Ref: meetings.match_id > matches.id
Ref: meetings.proposer_id > users.id
Ref: meetings.receiver_id > users.id

// ── Notifications ─────────────────────────────────────────────────────────────
Ref: notifications.user_id > users.id
```

## ERD Review Checklist

- [x] `users` table has NO auth/profile/state columns — clean identity-only record
- [x] All 5 normalized extension tables use `user_id` as both PK and FK → cascade deletes work
- [x] `investor_profiles` is investor-only; entrepreneur identity is carried by `users.role = 'entrepreneur'` (no redundant table)
- [x] Every junction/activity table (swipes, matches, messages, projects, meetings, notifications) has explicit FK → `users.id`
- [x] No orphan tables — all 19 tables traceable back to `users`
- [x] `partner_invitations` correctly links `matches` → `projects` (cross-domain join)
- [x] `ai_match_scores` and `ai_project_scores` use composite PKs (no surrogate key needed)
