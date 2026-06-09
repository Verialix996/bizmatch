CREATE TABLE IF NOT EXISTS user_profiles (
  user_id        INT PRIMARY KEY,
  photo_url      TEXT,
  bio            TEXT,
  skills         TEXT,
  hobbies        TEXT,
  role_type      VARCHAR(50),
  portfolio_url  VARCHAR(500),
  linkedin_url   VARCHAR(500),
  experience     TEXT,
  cv_url         VARCHAR(500),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
