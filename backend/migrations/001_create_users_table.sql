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

  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
