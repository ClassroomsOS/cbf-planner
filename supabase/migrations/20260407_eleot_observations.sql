-- ── eleot_observations ──────────────────────────────────────────────────────
-- Registro de observaciones Cognia® / eleot® en aula.
-- observer_id: quien realiza la observación (admin, rector, coordinador).
-- observed_teacher_id: docente observado (puede ser el mismo observer si es auto-registro).
-- domain: letra A–G · item: código A1–G4 · level: 1–4 (Inicial→Ejemplar).

CREATE TABLE IF NOT EXISTS eleot_observations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES schools(id),
  observer_id           uuid NOT NULL REFERENCES teachers(id),
  observed_teacher_id   uuid NOT NULL REFERENCES teachers(id),
  date                  date NOT NULL,
  grade                 text,
  subject               text,
  domain                char(1) NOT NULL CHECK (domain IN ('A','B','C','D','E','F','G')),
  item                  varchar(3) NOT NULL,  -- e.g. 'A1', 'D3', 'G4'
  level                 smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Index for common filters
CREATE INDEX IF NOT EXISTS eleot_obs_school_idx   ON eleot_observations (school_id);
CREATE INDEX IF NOT EXISTS eleot_obs_teacher_idx  ON eleot_observations (observed_teacher_id);
CREATE INDEX IF NOT EXISTS eleot_obs_date_idx     ON eleot_observations (date DESC);
CREATE INDEX IF NOT EXISTS eleot_obs_domain_idx   ON eleot_observations (domain);

-- RLS
ALTER TABLE eleot_observations ENABLE ROW LEVEL SECURITY;

-- Admins, rectors, superadmins: full access to own school
CREATE POLICY "eleot_obs_admin" ON eleot_observations
  FOR ALL
  USING (school_id = get_my_school_id());

-- Teachers can read their own observations and insert self-observations
CREATE POLICY "eleot_obs_teacher_read" ON eleot_observations
  FOR SELECT
  USING (
    observed_teacher_id = auth.uid()
    OR observer_id = auth.uid()
  );

CREATE POLICY "eleot_obs_teacher_insert" ON eleot_observations
  FOR INSERT
  WITH CHECK (observer_id = auth.uid() AND school_id = get_my_school_id());
