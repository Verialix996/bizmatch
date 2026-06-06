CREATE TABLE IF NOT EXISTS partner_invitations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  match_id    INT NOT NULL,
  inviter_id  INT NOT NULL,
  invitee_id  INT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  role_title  VARCHAR(100) NULL,
  equity_pct  DECIMAL(5,2) NULL,
  salary      INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, invitee_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id)   REFERENCES matches(id)  ON DELETE CASCADE,
  FOREIGN KEY (inviter_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (invitee_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
