-- Multiple image attachments per report (narrative site photos, etc.)
CREATE TABLE IF NOT EXISTS report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  report_id UUID NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  file_original_name TEXT NOT NULL,
  file_storage_key TEXT NOT NULL,
  file_mime_type TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_photos_report ON report_photos (report_id, sort_order);
