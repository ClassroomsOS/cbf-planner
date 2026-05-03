-- ============================================================
-- MIGRACIÓN: Flujo de aprobación de exámenes
-- Agrega status submitted/approved/returned a exam_blueprints
-- Crea tabla exam_feedback para comentarios del supervisor
-- ============================================================

-- 1. Expandir CHECK constraint de status en exam_blueprints
ALTER TABLE exam_blueprints DROP CONSTRAINT IF EXISTS exam_blueprints_status_check;
ALTER TABLE exam_blueprints ADD CONSTRAINT exam_blueprints_status_check
  CHECK (status IN ('draft', 'ready', 'archived', 'submitted', 'approved', 'returned'));

-- 2. Agregar columnas de revisión a exam_blueprints
ALTER TABLE exam_blueprints
  ADD COLUMN IF NOT EXISTS submitted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_id     UUID REFERENCES teachers(id),
  ADD COLUMN IF NOT EXISTS archive_url     TEXT;

-- 3. Crear tabla exam_feedback
CREATE TABLE IF NOT EXISTS exam_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id  UUID NOT NULL REFERENCES exam_blueprints(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL REFERENCES schools(id),
  reviewer_id   UUID NOT NULL REFERENCES teachers(id),
  action        TEXT NOT NULL CHECK (action IN ('approved', 'returned', 'comment')),
  comments      TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_feedback_blueprint ON exam_feedback(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_exam_feedback_school    ON exam_feedback(school_id);

-- 4. RLS para exam_feedback
ALTER TABLE exam_feedback ENABLE ROW LEVEL SECURITY;

-- Supervisores pueden crear feedback
DROP POLICY IF EXISTS "exam_feedback_reviewer_insert" ON exam_feedback;
CREATE POLICY "exam_feedback_reviewer_insert" ON exam_feedback
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM teachers
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'rector')
    )
  );

-- Todos del colegio pueden leer feedback (docente ve su feedback)
DROP POLICY IF EXISTS "exam_feedback_school_read" ON exam_feedback;
CREATE POLICY "exam_feedback_school_read" ON exam_feedback
  FOR SELECT USING (school_id = get_my_school_id());

-- 5. RLS: supervisores pueden actualizar status de blueprints de su colegio
DROP POLICY IF EXISTS "blueprints_supervisor_update" ON exam_blueprints;
CREATE POLICY "blueprints_supervisor_update" ON exam_blueprints
  FOR UPDATE USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM teachers
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'rector')
    )
  );

COMMENT ON TABLE exam_feedback IS
  'Historial de revisiones de exámenes — cada aprobación o devolución queda registrada con comentarios.';
