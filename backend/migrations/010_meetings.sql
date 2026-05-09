CREATE TABLE IF NOT EXISTS meetings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  match_id      INT NOT NULL,
  proposer_id   INT NOT NULL,
  receiver_id   INT NOT NULL,
  title         VARCHAR(255),
  scheduled_at  DATETIME NOT NULL,
  location_type ENUM('virtual', 'in_person') NOT NULL,
  video_link    VARCHAR(500),
  address       VARCHAR(500),
  lat           DECIMAL(10, 7),
  lng           DECIMAL(10, 7),
  status        ENUM('proposed','confirmed','declined','cancelled') NOT NULL DEFAULT 'proposed',
  ai_briefing   TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id)     REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (proposer_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (receiver_id)  REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
