CREATE TABLE IF NOT EXISTS profiles (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL UNIQUE,

  bio                TEXT,
  skills             TEXT,
  hobbies            TEXT,

  role_type          TEXT CHECK(role_type IN ('entrepreneur', 'investor')),

  venture_stage      TEXT CHECK(venture_stage IN ('idea','mvp','growth','scale')),
  funding_needs      REAL,

  investment_domain  TEXT,
  preferred_stage    TEXT CHECK(preferred_stage IN ('idea','mvp','growth','scale')),
  max_investment     REAL,

  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
