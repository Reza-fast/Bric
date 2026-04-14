-- Generalize attachments (not only PDF) + MIME for downloads

ALTER TABLE reports RENAME COLUMN pdf_original_name TO file_original_name;
ALTER TABLE reports RENAME COLUMN pdf_storage_key TO file_storage_key;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_mime_type TEXT;
