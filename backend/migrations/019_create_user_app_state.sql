CREATE TABLE IF NOT EXISTS user_app_state (
  user_id               INT PRIMARY KEY,
  push_token            VARCHAR(500),
  is_premium            BOOLEAN DEFAULT 0,
  premium_expires_at    DATETIME,
  last_active_at        DATETIME NULL DEFAULT NULL,
  swipe_count           INT DEFAULT 0,
  swipe_count_date      DATE NULL,
  has_seen_onboarding   TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
