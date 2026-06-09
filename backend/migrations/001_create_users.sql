CREATE TABLE IF NOT EXISTS users (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  email                VARCHAR(255) UNIQUE NOT NULL,
  name                 TEXT,
  role                 VARCHAR(50) CHECK(role IN ('entrepreneur', 'investor')),
  is_verified          TINYINT(1) DEFAULT 0,
  verification_status  VARCHAR(20) DEFAULT 'none' CHECK(verification_status IN ('none','pending','verified','rejected')),
  deleted_at           DATETIME NULL,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
