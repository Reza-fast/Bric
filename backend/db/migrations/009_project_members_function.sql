-- Team directory metadata: project-specific function/title for each member.
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS member_function TEXT;
