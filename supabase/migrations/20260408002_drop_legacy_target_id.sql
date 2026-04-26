-- ── 20260408_drop_legacy_target_id.sql ──────────────────────────────────────
-- Elimina columnas target_id legacy de checkpoints, lesson_plans y news_projects.
-- Todos los valores eran NULL (confirmado antes de ejecutar).
-- news_projects.target_indicador SE MANTIENE — sigue siendo el gate del botón IA.
-- learning_targets tabla NO se toca aquí (decisión pendiente por separado).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop FK constraints
ALTER TABLE checkpoints   DROP CONSTRAINT IF EXISTS checkpoints_target_id_fkey;
ALTER TABLE lesson_plans  DROP CONSTRAINT IF EXISTS lesson_plans_target_id_fkey;
ALTER TABLE news_projects DROP CONSTRAINT IF EXISTS news_projects_target_id_fkey;

-- 2. Drop columns
ALTER TABLE checkpoints   DROP COLUMN IF EXISTS target_id;
ALTER TABLE lesson_plans  DROP COLUMN IF EXISTS target_id;
ALTER TABLE news_projects DROP COLUMN IF EXISTS target_id;
