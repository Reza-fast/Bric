-- Planning metadata for Gantt-style timeline and priority views

ALTER TABLE planned_tasks ADD COLUMN IF NOT EXISTS phase_label TEXT;
ALTER TABLE planned_tasks ADD COLUMN IF NOT EXISTS task_status TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE planned_tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE planned_tasks ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

UPDATE planned_tasks SET task_status = 'scheduled' WHERE task_status IS NULL OR task_status = '';
UPDATE planned_tasks SET priority = 'normal' WHERE priority IS NULL OR priority = '';

ALTER TABLE planned_tasks DROP CONSTRAINT IF EXISTS planned_tasks_task_status_chk;
ALTER TABLE planned_tasks ADD CONSTRAINT planned_tasks_task_status_chk CHECK (
  task_status IN ('planned', 'in_progress', 'pending_approval', 'scheduled', 'completed')
);

ALTER TABLE planned_tasks DROP CONSTRAINT IF EXISTS planned_tasks_priority_chk;
ALTER TABLE planned_tasks ADD CONSTRAINT planned_tasks_priority_chk CHECK (
  priority IN ('low', 'normal', 'high', 'critical')
);
