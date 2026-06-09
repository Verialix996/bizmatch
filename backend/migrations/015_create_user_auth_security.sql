CREATE TABLE IF NOT EXISTS user_auth_security (
  user_id              INT PRIMARY KEY,
  password_hash        TEXT,
  otp_code             TEXT,
  otp_expires_at       DATETIME NULL,
  reset_token          TEXT,
  reset_token_expires  DATETIME NULL,
  oauth_provider       VARCHAR(50) CHECK(oauth_provider IN ('google')),
  oauth_provider_id    TEXT,
  two_factor_secret    TEXT,
  two_factor_enabled   TINYINT(1) DEFAULT 0,
  login_attempts       INT DEFAULT 0,
  locked_until         DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
