CREATE TABLE IF NOT EXISTS investor_profiles (
  user_id            INT PRIMARY KEY,
  investment_domain  TEXT,
  preferred_stage    VARCHAR(20) CHECK(preferred_stage IN ('idea','mvp','growth','scale')),
  max_investment     DECIMAL(15,2),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
