CREATE TABLE IF NOT EXISTS projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  stage           TEXT CHECK(stage IN ('idea', 'mvp', 'growth', 'scale')),
  funding_needed  INTEGER,
  industry        TEXT,
  deck_url        TEXT,
  video_url       TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Project swipes (investors swiping on projects)
CREATE TABLE IF NOT EXISTS project_swipes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  investor_id INTEGER NOT NULL,
  project_id  INTEGER NOT NULL,
  direction   TEXT NOT NULL CHECK(direction IN ('like', 'pass')),
  created_at  TEXT DEFAULT (datetime('now')),

  UNIQUE(investor_id, project_id),
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE
);

-- Project matches (investor liked a project)
CREATE TABLE IF NOT EXISTS project_matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  investor_id INTEGER NOT NULL,
  project_id  INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,  -- entrepreneur (owner of project)
  created_at  TEXT DEFAULT (datetime('now')),

  UNIQUE(investor_id, project_id),
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE
);
