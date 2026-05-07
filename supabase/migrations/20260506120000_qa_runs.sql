-- ══════════════════════════════════════════════════════════════════════════════
-- QA Runs — módulo de verificación visual guiada · CBF Planner — 2026-05-06
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. qa_runs ─────────────────────────────────────────────────────────────────
-- Almacena el resultado completo de cada ejecución de una suite QA.
CREATE TABLE IF NOT EXISTS qa_runs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  runner_id   UUID        NOT NULL REFERENCES teachers(id)  ON DELETE CASCADE,
  suite_id    TEXT        NOT NULL,
  suite_name  TEXT        NOT NULL,
  passed      INT         NOT NULL DEFAULT 0,
  failed      INT         NOT NULL DEFAULT 0,
  skipped     INT         NOT NULL DEFAULT 0,
  results     JSONB       NOT NULL DEFAULT '[]',
  ran_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qa_runs_school    ON qa_runs (school_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_runs_runner    ON qa_runs (runner_id);
CREATE INDEX IF NOT EXISTS idx_qa_runs_suite     ON qa_runs (suite_id);

-- ── 3. RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE qa_runs ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro de la escuela puede leer los runs de su institución
CREATE POLICY "qa_runs_school_read" ON qa_runs
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM teachers WHERE id = auth.uid()
    )
  );

-- Solo admin, superadmin y rector pueden insertar
CREATE POLICY "qa_runs_privileged_insert" ON qa_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE id = auth.uid()
        AND school_id = qa_runs.school_id
        AND role IN ('admin', 'superadmin', 'rector')
    )
  );

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'qa_runs'
ORDER BY ordinal_position;
