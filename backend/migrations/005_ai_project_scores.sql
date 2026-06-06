-- 005: AI scoring cache for investor-project pairs

CREATE TABLE IF NOT EXISTS ai_project_scores (
  investor_id INT NOT NULL,
  project_id  INT NOT NULL,
  score       TINYINT NOT NULL,
  scored_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (investor_id, project_id),
  FOREIGN KEY (investor_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE
);
