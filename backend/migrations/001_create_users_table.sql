CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  email                TEXT UNIQUE NOT NULL,
  password_hash        TEXT,
  name                 TEXT,
  photo_url            TEXT,
  role                 TEXT CHECK(role IN ('entrepreneur', 'investor')),

  is_verified          INTEGER DEFAULT 0,
  otp_code             TEXT,
  otp_expires_at       TEXT,

  reset_token          TEXT,
  reset_token_expires  TEXT,

  oauth_provider       TEXT CHECK(oauth_provider IN ('google', 'linkedin')),
  oauth_provider_id    TEXT,

  two_factor_secret    TEXT,
  two_factor_enabled   INTEGER DEFAULT 0,

  verification_status  TEXT DEFAULT 'none' CHECK(verification_status IN ('none','pending','verified','rejected')),

  deleted_at           TEXT DEFAULT NULL,

  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
