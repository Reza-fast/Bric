-- Day-level timer entries have no project; project rows allocate hours from that pool per UTC day.
ALTER TABLE time_logs
  ALTER COLUMN project_id DROP NOT NULL;
