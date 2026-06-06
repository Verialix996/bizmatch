CREATE TABLE IF NOT EXISTS project_swipes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  investor_id INT NOT NULL,
  project_id  INT NOT NULL,
  direction   VARCHAR(10) NOT NULL CHECK(direction IN ('like', 'pass')),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(investor_id, project_id),
  FOREIGN KEY (investor_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
