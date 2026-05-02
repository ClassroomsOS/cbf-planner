-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Módulo de Calificación en Vivo
-- Fecha: 2026-05-01
-- Descripción: Tablas para calificación en tiempo real desde el celular del profesor.
--   - Backfill UUIDs en actividades_evaluativas existentes
--   - grading_sessions: sesión en vivo por actividad/grupo
--   - student_activity_grades: nota por estudiante por actividad
-- ════════════════════════════════════════════════════════════════════════════════

-- ── 1. Backfill UUIDs en actividades_evaluativas ────────────────────────────────
-- Cada objeto en el array JSONB recibe un campo "id" UUID si no lo tiene.
UPDATE news_projects
SET actividades_evaluativas = (
  SELECT jsonb_agg(
    CASE
      WHEN elem ? 'id' THEN elem
      ELSE elem || jsonb_build_object('id', gen_random_uuid()::text)
    END
  )
  FROM jsonb_array_elements(actividades_evaluativas) AS elem
)
WHERE actividades_evaluativas IS NOT NULL
  AND jsonb_array_length(actividades_evaluativas) > 0;

-- ── 2. grading_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id       uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  news_project_id  uuid        NOT NULL REFERENCES news_projects(id) ON DELETE CASCADE,
  activity_id      text        NOT NULL,
  activity_name    text        NOT NULL,
  grade            text        NOT NULL,
  section          text        NOT NULL,
  subject          text        NOT NULL,
  max_score        numeric(5,2) NOT NULL DEFAULT 5.0,
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'paused', 'closed')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grading_sessions_owner" ON grading_sessions
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "grading_sessions_school_read" ON grading_sessions
  FOR SELECT USING (school_id = get_my_school_id());

CREATE INDEX idx_grading_sessions_teacher ON grading_sessions (teacher_id, status);
CREATE INDEX idx_grading_sessions_school  ON grading_sessions (school_id, status);

-- ── 3. student_activity_grades ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_activity_grades (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id       uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id       uuid        NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  news_project_id  uuid        NOT NULL REFERENCES news_projects(id) ON DELETE CASCADE,
  activity_id      text        NOT NULL,
  session_id       uuid        REFERENCES grading_sessions(id) ON DELETE SET NULL,
  score            numeric(5,2) NOT NULL,
  max_score        numeric(5,2) NOT NULL DEFAULT 5.0,
  colombian_grade  numeric(3,1) GENERATED ALWAYS AS (
    LEAST(5.0, GREATEST(1.0, (score / NULLIF(max_score, 0)) * 4 + 1))
  ) STORED,
  notes            text,
  graded_at        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, news_project_id, activity_id)
);

ALTER TABLE student_activity_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sag_owner" ON student_activity_grades
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "sag_school_read" ON student_activity_grades
  FOR SELECT USING (school_id = get_my_school_id());

CREATE INDEX idx_sag_session  ON student_activity_grades (session_id);
CREATE INDEX idx_sag_student  ON student_activity_grades (student_id);
CREATE INDEX idx_sag_project  ON student_activity_grades (news_project_id, activity_id);
CREATE INDEX idx_sag_teacher  ON student_activity_grades (teacher_id);

-- ── 4. updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_sag_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sag_updated_at
  BEFORE UPDATE ON student_activity_grades
  FOR EACH ROW EXECUTE FUNCTION update_sag_updated_at();

-- ── 5. Enable Realtime for live grading ─────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE student_activity_grades;
ALTER PUBLICATION supabase_realtime ADD TABLE grading_sessions;
