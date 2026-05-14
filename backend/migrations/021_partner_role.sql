ALTER TABLE partner_invitations
  ADD COLUMN role_title VARCHAR(100) NULL,
  ADD COLUMN equity_pct DECIMAL(5,2) NULL,
  ADD COLUMN salary     INT NULL;
