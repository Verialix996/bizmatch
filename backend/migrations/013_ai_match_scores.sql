CREATE TABLE IF NOT EXISTS ai_match_scores (
  user_id      INT NOT NULL,
  candidate_id INT NOT NULL,
  score        TINYINT NOT NULL,
  scored_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, candidate_id),
  FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE
);
