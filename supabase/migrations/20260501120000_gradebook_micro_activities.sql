-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sábana de Calificaciones + Micro-actividades
-- Fecha: 2026-05-01
-- Descripción:
--   - micro_activities: actividades rápidas creadas por el docente
--   - micro_activity_groups: equipos de estudiantes (cuando group_mode=true)
--   - Alter student_activity_grades: agregar micro_activity_id + hacer news nullable
--   - Backfill categoria en actividades_evaluativas existentes
-- ════════════════════════════════════════════════════════════════════════════════

-- ── 1. micro_activities ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS micro_activities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id     uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  grade          text        NOT NULL,  -- base "8.°"
  section        text        NOT NULL,  -- "Blue"
  subject        text        NOT NULL,
  period         int         NOT NULL,
  name           text        NOT NULL,
  description    text,
  category       text        NOT NULL DEFAULT 'cognitiva'
                             CHECK (category IN ('cognitiva', 'digital', 'axiologica')),
  group_mode     boolean     NOT NULL DEFAULT false,
  rubric_type    text        NOT NULL DEFAULT 'simple'
                             CHECK (rubric_type IN ('simple', 'numeric')),
  activity_date  date,
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'closed')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE micro_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "micro_activities_owner" ON micro_activities
  FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "micro_activities_school_read" ON micro_activities
  FOR SELECT USING (school_id = get_my_school_id());

CREATE INDEX idx_micro_act_teacher ON micro_activities (teacher_id, grade, section, subject, period);

-- ── 2. micro_activity_groups ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS micro_activity_groups (
  id                  uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  micro_activity_id   uuid   NOT NULL REFERENCES micro_activities(id) ON DELETE CASCADE,
  group_label         text   NOT NULL DEFAULT 'Equipo',
  student_ids         uuid[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE micro_activity_groups ENABLE ROW LEVEL SECURITY;

-- RLS via micro_activities join
CREATE POLICY "mag_via_parent" ON micro_activity_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM micro_activities ma
      WHERE ma.id = micro_activity_id AND ma.teacher_id = auth.uid()
    )
  );
CREATE POLICY "mag_school_read" ON micro_activity_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM micro_activities ma
      WHERE ma.id = micro_activity_id AND ma.school_id = get_my_school_id()
    )
  );

CREATE INDEX idx_mag_micro ON micro_activity_groups (micro_activity_id);

-- ── 3. Alter student_activity_grades ────────────────────────────────────────────
-- Make news_project_id and activity_id nullable (micro-activities don't have them)
ALTER TABLE student_activity_grades
  ALTER COLUMN news_project_id DROP NOT NULL;

ALTER TABLE student_activity_grades
  ALTER COLUMN activity_id DROP NOT NULL;

-- Add micro_activity_id column
ALTER TABLE student_activity_grades
  ADD COLUMN IF NOT EXISTS micro_activity_id uuid REFERENCES micro_activities(id) ON DELETE CASCADE;

-- Add unique constraint for micro-activity grades
CREATE UNIQUE INDEX IF NOT EXISTS idx_sag_micro_unique
  ON student_activity_grades (student_id, micro_activity_id)
  WHERE micro_activity_id IS NOT NULL;

-- Add check: must have either news_project_id or micro_activity_id
ALTER TABLE student_activity_grades
  ADD CONSTRAINT sag_source_check
  CHECK (news_project_id IS NOT NULL OR micro_activity_id IS NOT NULL);

CREATE INDEX idx_sag_micro ON student_activity_grades (micro_activity_id) WHERE micro_activity_id IS NOT NULL;

-- ── 4. Backfill categoria in existing actividades_evaluativas ───────────────────
-- Default all existing activities to 'cognitiva'
UPDATE news_projects
SET actividades_evaluativas = (
  SELECT jsonb_agg(
    CASE
      WHEN elem ? 'categoria' THEN elem
      ELSE elem || jsonb_build_object('categoria', 'cognitiva')
    END
  )
  FROM jsonb_array_elements(actividades_evaluativas) AS elem
)
WHERE actividades_evaluativas IS NOT NULL
  AND jsonb_array_length(actividades_evaluativas) > 0;

-- ── 5. Enable Realtime for micro_activities ─────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE micro_activities;
