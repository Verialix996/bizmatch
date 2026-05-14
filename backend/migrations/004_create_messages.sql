CREATE TABLE IF NOT EXISTS messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  match_id   INT NOT NULL,
  sender_id  INT NOT NULL,
  body       TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_messages_match_id (match_id),
  FOREIGN KEY (match_id)  REFERENCES matches(id)  ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
