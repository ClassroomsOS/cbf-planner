-- ══════════════════════════════════════════════════════════════════════════════
-- Sesión A — Bloque 1: achievement_goals + achievement_indicators
-- CBF Planner · ETA Platform — 2026-04-07
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. achievement_goals — Logros de período ──────────────────────────────────
-- Un logro por asignatura por grado por período por año.
-- Texto: verbo Bloom + contenido + condición.
CREATE TABLE IF NOT EXISTS achievement_goals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject       TEXT        NOT NULL,
  grade         TEXT        NOT NULL,
  period        INTEGER     NOT NULL CHECK (period BETWEEN 1 AND 4),
  academic_year INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  text          TEXT        NOT NULL,
  verb          TEXT,
  bloom_level   TEXT        CHECK (bloom_level IN
                  ('remember','understand','apply','analyze','evaluate','create')),
  year_verse    TEXT,
  status        TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','published')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, subject, grade, period, academic_year)
);

-- ── 2. achievement_indicators — Indicadores de logro ──────────────────────────
-- 3–4 indicadores por logro, en 3 dimensiones: cognitiva, procedimental, actitudinal.
-- student_text: versión en lenguaje A2 generada por IA.
CREATE TABLE IF NOT EXISTS achievement_indicators (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id       UUID        NOT NULL REFERENCES achievement_goals(id) ON DELETE CASCADE,
  dimension     TEXT        NOT NULL
                            CHECK (dimension IN ('cognitive','procedural','attitudinal')),
  -- skill_area: para materias de idioma (English). NULL para materias sin habilidades comunicativas.
  -- Cuando tiene valor, el NEWS Project hereda automáticamente la plantilla de rúbrica correspondiente.
  skill_area    TEXT        CHECK (skill_area IN ('speaking','listening','reading','writing','general')),
  text          TEXT        NOT NULL,
  student_text  TEXT,
  weight        NUMERIC(5,2),
  order_index   INTEGER     NOT NULL DEFAULT 1,
  bloom_level   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. RLS — achievement_goals ────────────────────────────────────────────────
ALTER TABLE achievement_goals ENABLE ROW LEVEL SECURITY;

-- El propietario puede hacer todo
CREATE POLICY "goals_owner" ON achievement_goals
  FOR ALL USING (teacher_id = auth.uid());

-- Compañeros del mismo colegio pueden leer logros publicados
CREATE POLICY "goals_school_read" ON achievement_goals
  FOR SELECT USING (
    school_id = get_my_school_id()
    AND status = 'published'
  );

-- Admin/director pueden leer todos los logros del colegio
CREATE POLICY "goals_admin_read" ON achievement_goals
  FOR SELECT USING (
    school_id = get_my_school_id()
    AND (SELECT role FROM teachers WHERE id = auth.uid())
        IN ('admin', 'superadmin', 'director')
  );

-- ── 4. RLS — achievement_indicators ──────────────────────────────────────────
ALTER TABLE achievement_indicators ENABLE ROW LEVEL SECURITY;

-- Acceso vía goal_id → si puede ver el goal, puede ver sus indicadores
CREATE POLICY "indicators_via_goal" ON achievement_indicators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM achievement_goals g
      WHERE g.id = achievement_indicators.goal_id
        AND (
          g.teacher_id = auth.uid()
          OR (g.school_id = get_my_school_id() AND g.status = 'published')
          OR (
            g.school_id = get_my_school_id()
            AND (SELECT role FROM teachers WHERE id = auth.uid())
                IN ('admin', 'superadmin', 'director')
          )
        )
    )
  );

-- ── 5. Trigger: updated_at automático en achievement_goals ───────────────────
CREATE OR REPLACE FUNCTION update_achievement_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievement_goals_updated_at ON achievement_goals;
CREATE TRIGGER trg_achievement_goals_updated_at
  BEFORE UPDATE ON achievement_goals
  FOR EACH ROW EXECUTE FUNCTION update_achievement_goals_updated_at();

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('achievement_goals', 'achievement_indicators')
ORDER BY table_name, ordinal_position;
