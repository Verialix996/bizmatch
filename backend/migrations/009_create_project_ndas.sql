CREATE TABLE IF NOT EXISTS project_ndas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  user_id      INT NOT NULL,
  signed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  document_url TEXT,
  pdf_data     LONGBLOB,
  UNIQUE(project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
