CREATE TABLE IF NOT EXISTS ai_compatibility_breakdowns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  viewer_id INT NOT NULL,
  target_id INT NOT NULL,
  score TINYINT NOT NULL,
  pros JSON NOT NULL,
  cons JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pair (viewer_id, target_id)
);
