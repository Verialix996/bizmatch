CREATE TABLE IF NOT EXISTS projects (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  stage           VARCHAR(20) CHECK(stage IN ('idea', 'mvp', 'growth', 'scale')),
  funding_needed  INT,
  industry        TEXT,
  deck_url        TEXT,
  video_url       TEXT,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_projects_user_id ON projects(user_id);

CREATE TABLE IF NOT EXISTS project_swipes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  investor_id INT NOT NULL,
  project_id  INT NOT NULL,
  direction   VARCHAR(10) NOT NULL CHECK(direction IN ('like', 'pass')),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(investor_id, project_id),
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_matches (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  investor_id INT NOT NULL,
  project_id  INT NOT NULL,
  user_id     INT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(investor_id, project_id),
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
