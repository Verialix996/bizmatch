CREATE TABLE IF NOT EXISTS profiles (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  user_id            INT NOT NULL UNIQUE,

  bio                TEXT,
  skills             TEXT,
  hobbies            TEXT,

  role_type          VARCHAR(50) CHECK(role_type IN ('entrepreneur', 'investor')),

  venture_stage      VARCHAR(20) CHECK(venture_stage IN ('idea','mvp','growth','scale')),
  funding_needs      DECIMAL(15,2),

  investment_domain  TEXT,
  preferred_stage    VARCHAR(20) CHECK(preferred_stage IN ('idea','mvp','growth','scale')),
  max_investment     DECIMAL(15,2),

  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
