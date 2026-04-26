-- ══════════════════════════════════════════════════════════════════
-- Módulo Psicosocial — Sesión N
-- Tablas: student_psychosocial_profiles · student_observations
--         student_accommodation_plans
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Perfil psicosocial (uno por estudiante) ─────────────────
CREATE TABLE IF NOT EXISTS student_psychosocial_profiles (
  student_id         UUID PRIMARY KEY REFERENCES school_students(id) ON DELETE CASCADE,
  school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'monitoring'
                     CHECK (status IN ('no_intervention','monitoring','intervention','closed')),
  support_level      TEXT NOT NULL DEFAULT 'standard'
                     CHECK (support_level IN ('standard','enhanced','intensive')),
  flags              TEXT[]       NOT NULL DEFAULT '{}',
  teacher_notes      TEXT,          -- visible a todos los docentes de la escuela
  confidential_notes TEXT,          -- solo psicopedagoga + rector + admin
  photo_url          TEXT,
  created_by         UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psychosocial_school
  ON student_psychosocial_profiles(school_id);

-- ── 2. Log de observaciones / seguimiento ──────────────────────
CREATE TABLE IF NOT EXISTS student_observations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  obs_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  obs_type       TEXT NOT NULL DEFAULT 'other'
                 CHECK (obs_type IN ('academic','behavioral','emotional','family','health','other')),
  description    TEXT NOT NULL,
  action_taken   TEXT,
  next_steps     TEXT,
  next_followup  DATE,
  created_by     UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observations_student
  ON student_observations(student_id, obs_date DESC);

-- ── 3. Planes de acomodación (visibles a docentes) ─────────────
CREATE TABLE IF NOT EXISTS student_accommodation_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  academic_year  INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  subject        TEXT,   -- NULL = todas las materias
  period         INTEGER CHECK (period BETWEEN 1 AND 6), -- NULL = todo el año
  accommodations JSONB   NOT NULL DEFAULT '[]',
  status         TEXT    NOT NULL DEFAULT 'active'
                 CHECK (status IN ('draft','active','archived')),
  created_by     UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accommodations_student
  ON student_accommodation_plans(student_id, academic_year, status);

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE student_psychosocial_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_observations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_accommodation_plans      ENABLE ROW LEVEL SECURITY;

-- Profiles: todos en la escuela pueden leer
CREATE POLICY "psychosocial_profiles_read" ON student_psychosocial_profiles
  FOR SELECT USING (school_id = get_my_school_id());

-- Profiles: solo psicopedagoga / admin / rector pueden escribir
CREATE POLICY "psychosocial_profiles_write" ON student_psychosocial_profiles
  FOR ALL USING (
    school_id = get_my_school_id() AND
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.role IN ('psicopedagoga','admin','superadmin','rector')
    )
  );

-- Observations: misma lógica
CREATE POLICY "observations_read" ON student_observations
  FOR SELECT USING (school_id = get_my_school_id());

CREATE POLICY "observations_write" ON student_observations
  FOR ALL USING (
    school_id = get_my_school_id() AND
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.role IN ('psicopedagoga','admin','superadmin','rector')
    )
  );

-- Accommodation plans: todos leen, solo psico/admin/rector escriben
CREATE POLICY "accommodations_read" ON student_accommodation_plans
  FOR SELECT USING (school_id = get_my_school_id());

CREATE POLICY "accommodations_write" ON student_accommodation_plans
  FOR ALL USING (
    school_id = get_my_school_id() AND
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.role IN ('psicopedagoga','admin','superadmin','rector')
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_psychosocial_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_psychosocial_profiles_updated_at
  BEFORE UPDATE ON student_psychosocial_profiles
  FOR EACH ROW EXECUTE FUNCTION update_psychosocial_updated_at();

CREATE TRIGGER trg_accommodation_plans_updated_at
  BEFORE UPDATE ON student_accommodation_plans
  FOR EACH ROW EXECUTE FUNCTION update_psychosocial_updated_at();
