CREATE TABLE IF NOT EXISTS swipes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  swiper_id  INTEGER NOT NULL,
  swiped_id  INTEGER NOT NULL,
  direction  TEXT NOT NULL CHECK(direction IN ('like', 'pass')),
  created_at TEXT DEFAULT (datetime('now')),

  UNIQUE(swiper_id, swiped_id),
  FOREIGN KEY (swiper_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (swiped_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id   INTEGER NOT NULL,
  user2_id   INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  UNIQUE(user1_id, user2_id),
  FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
);
