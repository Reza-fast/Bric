-- Technical plan / drawing uploads per project (PDF, CAD, Office, images).
CREATE TABLE IF NOT EXISTS technical_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_original_name TEXT NOT NULL,
  file_storage_key TEXT NOT NULL,
  file_mime_type TEXT,
  uploaded_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technical_plans_project_created ON technical_plans (project_id, created_at DESC);
