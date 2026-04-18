-- HR role for people operations (team directory, invites, org time oversight).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'hr'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'hr';
  END IF;
END
$$;
