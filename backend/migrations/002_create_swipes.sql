CREATE TABLE IF NOT EXISTS swipes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  swiper_id     INT NOT NULL,
  swiped_id     INT NOT NULL,
  direction     VARCHAR(10) NOT NULL CHECK(direction IN ('like', 'pass')),
  is_super_like BOOLEAN DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(swiper_id, swiped_id),
  FOREIGN KEY (swiper_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (swiped_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
