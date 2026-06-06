-- 004: merge profiles into users, drop unused tables

ALTER TABLE users
  ADD COLUMN bio TEXT,
  ADD COLUMN skills TEXT,
  ADD COLUMN hobbies TEXT,
  ADD COLUMN role_type VARCHAR(50),
  ADD COLUMN investment_domain TEXT,
  ADD COLUMN preferred_stage VARCHAR(20),
  ADD COLUMN max_investment DECIMAL(15,2),
  ADD COLUMN portfolio_url VARCHAR(500),
  ADD COLUMN linkedin_url VARCHAR(500),
  ADD COLUMN experience TEXT,
  ADD COLUMN cv_url VARCHAR(500),
  ADD COLUMN cv_data LONGBLOB;

UPDATE users u
INNER JOIN profiles p ON p.user_id = u.id
SET u.bio               = p.bio,
    u.skills            = p.skills,
    u.hobbies           = p.hobbies,
    u.role_type         = p.role_type,
    u.investment_domain = p.investment_domain,
    u.preferred_stage   = p.preferred_stage,
    u.max_investment    = p.max_investment,
    u.portfolio_url     = p.portfolio_url,
    u.linkedin_url      = p.linkedin_url,
    u.experience        = p.experience,
    u.cv_url            = p.cv_url,
    u.cv_data           = p.cv_data;

DROP TABLE IF EXISTS ai_compatibility_breakdowns;
DROP TABLE IF EXISTS role_change_requests;
DROP TABLE IF EXISTS api_usage;
DROP TABLE IF EXISTS profiles;
