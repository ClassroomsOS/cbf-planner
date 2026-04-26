-- ── lesson_plans: status + week_number ────────────────────────────────────────
-- Columnas usadas por PlannerPage, GuideEditorPage y ReviewRoomPage.
-- Pueden ya existir en producción (creadas en migraciones anteriores no incluidas).
-- Usar IF NOT EXISTS para idempotencia.

ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft','complete','submitted','approved','published','archived'));

ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS week_number integer;

-- Índice para filtros rápidos en ReviewRoomPage y GuideLibraryPage
CREATE INDEX IF NOT EXISTS lesson_plans_status_idx ON lesson_plans (status);
CREATE INDEX IF NOT EXISTS lesson_plans_teacher_status_idx ON lesson_plans (teacher_id, status);
