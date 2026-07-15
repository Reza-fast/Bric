-- Hourly labor rate for budget calculations (hours × wage = total labor budget).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hourly_wage NUMERIC(12, 2);
