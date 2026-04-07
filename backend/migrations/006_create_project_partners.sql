CREATE TABLE IF NOT EXISTS project_partners (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  added_at    TEXT DEFAULT (datetime('now')),

  UNIQUE(project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_partners_project ON project_partners(project_id);
