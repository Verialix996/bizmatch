ALTER TABLE notifications
  MODIFY COLUMN type ENUM('match','meeting','super_like','partner_invite','message') NOT NULL;
