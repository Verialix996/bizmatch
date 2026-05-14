CREATE TABLE IF NOT EXISTS project_partners (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  user_id     INT NOT NULL,
  added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_id, user_id),
  INDEX idx_project_partners_project (project_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
