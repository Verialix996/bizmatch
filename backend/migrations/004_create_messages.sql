CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   INTEGER NOT NULL,
  sender_id  INTEGER NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (match_id)  REFERENCES matches(id)  ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
