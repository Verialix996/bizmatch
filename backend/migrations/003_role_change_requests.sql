CREATE TABLE IF NOT EXISTS role_change_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  project_id     INT NOT NULL,
  match_id       INT NOT NULL,
  requester_id   INT NOT NULL,
  target_user_id INT NOT NULL,
  new_role       VARCHAR(100) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rcr_target (target_user_id, status),
  FOREIGN KEY (project_id)     REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id)       REFERENCES matches(id)  ON DELETE CASCADE,
  FOREIGN KEY (requester_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id)    ON DELETE CASCADE
);
