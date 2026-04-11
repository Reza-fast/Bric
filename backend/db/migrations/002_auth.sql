-- Authentication: password hash on users (NULL = cannot log in until set)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN users.password_hash IS 'bcrypt hash; NULL means password login is not available for this row';

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
