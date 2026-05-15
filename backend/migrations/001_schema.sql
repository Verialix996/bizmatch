-- BizMatch — Complete schema (single source of truth)
-- All tables in dependency order. Every column reflects the final production state.

CREATE TABLE IF NOT EXISTS users (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  email                VARCHAR(255) UNIQUE NOT NULL,
  password_hash        TEXT,
  name                 TEXT,
  photo_url            TEXT,
  role                 VARCHAR(50) CHECK(role IN ('entrepreneur', 'investor')),
  is_verified          TINYINT(1) DEFAULT 0,
  otp_code             TEXT,
  otp_expires_at       DATETIME NULL,
  reset_token          TEXT,
  reset_token_expires  DATETIME NULL,
  oauth_provider       VARCHAR(50) CHECK(oauth_provider IN ('google', 'linkedin')),
  oauth_provider_id    TEXT,
  two_factor_secret    TEXT,
  two_factor_enabled   TINYINT(1) DEFAULT 0,
  verification_status  VARCHAR(20) DEFAULT 'none' CHECK(verification_status IN ('none','pending','verified','rejected')),
  deleted_at           DATETIME NULL,
  push_token           VARCHAR(500),
  is_premium           BOOLEAN DEFAULT 0,
  premium_expires_at   DATETIME,
  login_attempts       INT DEFAULT 0,
  locked_until         DATETIME NULL,
  last_active_at       DATETIME NULL DEFAULT NULL,
  swipe_count          INT DEFAULT 0,
  swipe_count_date     DATE NULL,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Investor fields: investment_domain, preferred_stage, max_investment
-- Entrepreneur fields: bio, skills, hobbies
-- venture_stage and funding_needs live on projects, not profiles
CREATE TABLE IF NOT EXISTS profiles (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  user_id            INT NOT NULL UNIQUE,
  bio                TEXT,
  skills             TEXT,
  hobbies            TEXT,
  role_type          VARCHAR(50) CHECK(role_type IN ('entrepreneur', 'investor')),
  investment_domain  TEXT,
  preferred_stage    VARCHAR(20) CHECK(preferred_stage IN ('idea','mvp','growth','scale')),
  max_investment     DECIMAL(15,2),
  portfolio_url      VARCHAR(500),
  linkedin_url       VARCHAR(500),
  experience         TEXT,
  cv_url             VARCHAR(500),
  cv_data            LONGBLOB,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS swipes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  swiper_id    INT NOT NULL,
  swiped_id    INT NOT NULL,
  direction    VARCHAR(10) NOT NULL CHECK(direction IN ('like', 'pass')),
  is_super_like BOOLEAN DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(swiper_id, swiped_id),
  FOREIGN KEY (swiper_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (swiped_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matches (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user1_id   INT NOT NULL,
  user2_id   INT NOT NULL,
  ai_summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id),
  FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  match_id     INT NOT NULL,
  sender_id    INT NOT NULL,
  body         TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text',
  metadata     TEXT,
  read_at      DATETIME NULL DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_match_id (match_id),
  FOREIGN KEY (match_id)  REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- deck_data stores pitch deck as BLOB (not Cloudinary)
-- lat/lng removed — location stored as address string only
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
  deck_data      LONGBLOB,
  deck_mime      VARCHAR(100) NULL DEFAULT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_projects_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS project_matches (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  investor_id INT NOT NULL,
  project_id  INT NOT NULL,
  user_id     INT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(investor_id, project_id),
  FOREIGN KEY (investor_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_partners (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id    INT NOT NULL,
  added_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id),
  INDEX idx_project_partners_project (project_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_ndas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  user_id      INT NOT NULL,
  signed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  document_url TEXT,
  UNIQUE(project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- lat/lng removed; address field covers location
CREATE TABLE IF NOT EXISTS meetings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  match_id      INT NOT NULL,
  proposer_id   INT NOT NULL,
  receiver_id   INT NOT NULL,
  title         VARCHAR(255),
  scheduled_at  DATETIME NOT NULL,
  location_type ENUM('virtual', 'in_person') NOT NULL,
  video_link    VARCHAR(500),
  address       VARCHAR(500),
  status        ENUM('proposed','confirmed','declined','cancelled') NOT NULL DEFAULT 'proposed',
  ai_briefing   TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id)    REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (proposer_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_usage (
  date           DATE PRIMARY KEY,
  briefing_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_match_scores (
  user_id      INT NOT NULL,
  candidate_id INT NOT NULL,
  score        TINYINT NOT NULL,
  scored_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, candidate_id),
  FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_compatibility_breakdowns (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  viewer_id  INT NOT NULL,
  target_id  INT NOT NULL,
  score      TINYINT NOT NULL,
  pros       JSON NOT NULL,
  cons       JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pair (viewer_id, target_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  type       ENUM('match','meeting','super_like','partner_invite') NOT NULL,
  ref_id     INT,
  payload    JSON,
  read_at    DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
