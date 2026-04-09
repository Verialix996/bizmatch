ALTER TABLE projects ADD COLUMN visibility VARCHAR(50) NOT NULL DEFAULT 'public';

CREATE TABLE IF NOT EXISTS project_ndas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  user_id     INT NOT NULL,
  signed_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE messages ADD COLUMN message_type VARCHAR(50) NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN metadata TEXT;

CREATE TABLE IF NOT EXISTS partner_invitations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  match_id    INT NOT NULL,
  inviter_id  INT NOT NULL,
  invitee_id  INT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, invitee_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id)   REFERENCES matches(id)  ON DELETE CASCADE,
  FOREIGN KEY (inviter_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (invitee_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
