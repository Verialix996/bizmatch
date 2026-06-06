CREATE TABLE IF NOT EXISTS projects (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  stage          VARCHAR(20) CHECK(stage IN ('idea', 'mvp', 'growth', 'scale')),
  funding_needed INT,
  industry       TEXT,
  deck_url       TEXT,
  video_url      TEXT,
  is_active      TINYINT(1) DEFAULT 1,
  visibility     VARCHAR(50) NOT NULL DEFAULT 'public',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_projects_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
