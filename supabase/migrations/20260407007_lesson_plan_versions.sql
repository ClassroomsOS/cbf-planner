-- ── Versioning de guías publicadas ────────────────────────────────────────────
-- CBF Planner — Fase 5: Archivado + versioning
-- lesson_plans.locked  → bloquea edición sin aprobación admin
-- lesson_plan_versions → snapshot inmutable de cada versión publicada
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Campo locked en lesson_plans
ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- 2. Tabla de versiones
CREATE TABLE IF NOT EXISTS lesson_plan_versions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid        NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  school_id   uuid        NOT NULL REFERENCES schools(id),
  version     integer     NOT NULL,
  status      text        NOT NULL,
  content     jsonb       NOT NULL,
  note        text,                        -- opcional: motivo de publicación
  archived_by uuid        NOT NULL REFERENCES teachers(id),
  archived_at timestamptz DEFAULT now(),
  UNIQUE (plan_id, version)
);

ALTER TABLE lesson_plan_versions ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro del colegio puede ver las versiones de las guías de su colegio
CREATE POLICY "versions_school_read" ON lesson_plan_versions
  FOR SELECT USING (school_id = get_my_school_id());

-- Solo admin/rector pueden crear versiones
CREATE POLICY "versions_admin_insert" ON lesson_plan_versions
  FOR INSERT WITH CHECK (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM teachers
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'rector')
    )
  );

-- Solo admin/rector pueden eliminar versiones (raro, pero posible)
CREATE POLICY "versions_admin_delete" ON lesson_plan_versions
  FOR DELETE USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM teachers
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'rector')
    )
  );

-- Índice para listado rápido por plan
CREATE INDEX IF NOT EXISTS lpv_plan_version_idx ON lesson_plan_versions (plan_id, version DESC);
