-- New project_status enum values must be committed before use (PG 55P04).
-- This file only extends the enum; seed data lives in 004_portfolio_projects.sql.

DO $e$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    INNER JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'project_status' AND e.enumlabel = 'planning'
  ) THEN
    ALTER TYPE project_status ADD VALUE 'planning';
  END IF;
END $e$;

DO $e$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    INNER JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'project_status' AND e.enumlabel = 'critical'
  ) THEN
    ALTER TYPE project_status ADD VALUE 'critical';
  END IF;
END $e$;
