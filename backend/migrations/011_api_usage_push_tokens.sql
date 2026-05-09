-- Daily AI briefing usage counter
CREATE TABLE IF NOT EXISTS api_usage (
  date DATE PRIMARY KEY,
  briefing_count INT DEFAULT 0
);

-- Push notification tokens
ALTER TABLE users ADD COLUMN push_token VARCHAR(500);
