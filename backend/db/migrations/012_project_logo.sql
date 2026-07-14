-- Optional cover/logo image per project (stored on disk, metadata in row).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_original_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_storage_key TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_mime_type TEXT;
