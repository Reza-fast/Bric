-- Site reports (werf verslag): in-app body text and/or uploaded PDF

ALTER TABLE reports ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_original_name TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_storage_key TEXT;
