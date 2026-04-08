-- Project visibility: 'public' = appears in investor feed, 'private' = hidden
ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';

-- Track which users have signed an NDA for a given project
CREATE TABLE IF NOT EXISTS project_ndas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  signed_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, user_id)
);

-- Typed messages: 'text' (default) or 'partner_invite'
ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text';
-- JSON metadata blob (e.g. { invitationId, projectId, projectTitle } for partner invites)
ALTER TABLE messages ADD COLUMN metadata TEXT;

-- Partner invitations sent through chat
CREATE TABLE IF NOT EXISTS partner_invitations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  match_id    INTEGER NOT NULL REFERENCES matches(id)  ON DELETE CASCADE,
  inviter_id  INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  invitee_id  INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  status      TEXT    NOT NULL DEFAULT 'pending',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, invitee_id)
);
