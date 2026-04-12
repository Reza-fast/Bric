-- Portfolio columns + seeded demo projects (runs after 003 commits enum values)

ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS portfolio_lead_name TEXT;

UPDATE projects SET completion_percent = 0 WHERE completion_percent IS NULL;

INSERT INTO projects (name, slug, status, budgeted_hours, description, location, completion_percent, portfolio_lead_name)
VALUES
  ('Skyline Residency', 'skyline-residency', 'active', 5200, NULL, 'District 4, Metropolitan Area', 68, 'Sarah Jenkins'),
  ('Oakwood Commercial Hub', 'oakwood-commercial-hub', 'critical', 800, NULL, 'North Perimeter Business Park', 42, 'Marcus Chen'),
  ('Vertex Corporate Plaza', 'vertex-corporate-plaza', 'planning', 12000, NULL, 'Tech Corridor South', 12, 'Elena Rodriguez'),
  ('Riverbend Luxury Lofts', 'riverbend-luxury-lofts', 'completed', 6400, NULL, 'Waterfront Development', 100, 'Julian Thorne'),
  ('Aurora Science Labs', 'aurora-science-labs', 'active', 4100, NULL, 'Innovation Ridge', 82, 'Sarah Jenkins'),
  ('Apex Industrial Center', 'apex-industrial-center', 'active', 9000, NULL, 'Logistics Corridor North', 55, 'Marcus Chen')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  budgeted_hours = EXCLUDED.budgeted_hours,
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  completion_percent = EXCLUDED.completion_percent,
  portfolio_lead_name = EXCLUDED.portfolio_lead_name,
  updated_at = now();

INSERT INTO project_members (project_id, user_id)
SELECT p.id, u.id
FROM projects p
CROSS JOIN users u
WHERE p.slug IN (
  'skyline-residency',
  'oakwood-commercial-hub',
  'vertex-corporate-plaza',
  'riverbend-luxury-lofts',
  'aurora-science-labs',
  'apex-industrial-center'
)
ON CONFLICT DO NOTHING;
