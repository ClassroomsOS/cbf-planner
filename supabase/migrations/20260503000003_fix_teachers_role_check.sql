-- Fix: agregar 'rector' al CHECK constraint de teachers.role
-- El constraint original lo incluía pero la migración 20260403001 lo omitió por error.

ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_role_check;
ALTER TABLE teachers ADD CONSTRAINT teachers_role_check
  CHECK (role IN ('teacher', 'admin', 'superadmin', 'rector', 'psicopedagoga'));
