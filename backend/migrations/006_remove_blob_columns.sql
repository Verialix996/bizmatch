-- 006: remove BLOB columns now that CV and deck files are stored in Cloudinary

ALTER TABLE users    DROP COLUMN cv_data;
ALTER TABLE projects DROP COLUMN deck_data;
ALTER TABLE projects DROP COLUMN deck_mime;
