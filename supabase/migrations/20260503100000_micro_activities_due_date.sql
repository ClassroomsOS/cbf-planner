-- Add due_date to micro_activities for deadline tracking
ALTER TABLE micro_activities
ADD COLUMN IF NOT EXISTS due_date date;

-- Add assigned_student_ids to scope activities to specific students (null = all)
ALTER TABLE micro_activities
ADD COLUMN IF NOT EXISTS assigned_student_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN micro_activities.due_date IS 'Deadline for student submission. NULL = no deadline.';
COMMENT ON COLUMN micro_activities.assigned_student_ids IS 'Specific students assigned. NULL = all students in grade/section.';
