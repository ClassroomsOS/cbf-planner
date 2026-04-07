-- ══════════════════════════════════════════════════════════════════════════════
-- Sesión A — Bloque 2: syllabus_topics
-- CBF Planner · ETA Platform — 2026-04-07
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. syllabus_topics — Contenidos del plan de estudios ─────────────────────
-- Un registro por tema por semana. Vinculado al indicador que jalona ese contenido.
-- resources JSONB: [{type:'textbook', ref:'Cambridge Book pp.6-11'},
--                   {type:'cambridge_one', activity:'...'},
--                   {type:'workbook', ref:'pp.5-7'}]
CREATE TABLE IF NOT EXISTS syllabus_topics (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject       TEXT        NOT NULL,
  grade         TEXT        NOT NULL,
  period        INTEGER     NOT NULL CHECK (period BETWEEN 1 AND 4),
  academic_year INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  week_number   INTEGER     CHECK (week_number BETWEEN 1 AND 20),
  topic         TEXT        NOT NULL,
  content_type  TEXT        NOT NULL DEFAULT 'concept'
                            CHECK (content_type IN
                              ('grammar','vocabulary','skill','value','concept','other')),
  description   TEXT,
  resources     JSONB       NOT NULL DEFAULT '[]',
  indicator_id  UUID        REFERENCES achievement_indicators(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. RLS — syllabus_topics ──────────────────────────────────────────────────
ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;

-- El propietario puede hacer todo
CREATE POLICY "syllabus_owner" ON syllabus_topics
  FOR ALL USING (teacher_id = auth.uid());

-- Compañeros del mismo colegio pueden leer el syllabus
CREATE POLICY "syllabus_school_read" ON syllabus_topics
  FOR SELECT USING (school_id = get_my_school_id());

-- ── 3. Trigger: updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_syllabus_topics_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_syllabus_topics_updated_at ON syllabus_topics;
CREATE TRIGGER trg_syllabus_topics_updated_at
  BEFORE UPDATE ON syllabus_topics
  FOR EACH ROW EXECUTE FUNCTION update_syllabus_topics_updated_at();

-- ── 4. Índice de rendimiento para queries por semana ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_syllabus_teacher_period_week
  ON syllabus_topics (teacher_id, subject, grade, period, week_number);

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'syllabus_topics'
ORDER BY ordinal_position;
