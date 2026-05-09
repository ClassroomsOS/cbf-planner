-- =============================================================================
-- school_library — Biblioteca pedagógica institucional y personal
-- Fase 1: tabla base, RLS dual, quota tracking, storage paths
-- =============================================================================

-- Función trigger reutilizable para updated_at
CREATE OR REPLACE FUNCTION update_school_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Tabla principal
CREATE TABLE IF NOT EXISTS school_library (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,

  -- Contenido
  title         text        NOT NULL,
  description   text,
  doc_type      text        NOT NULL DEFAULT 'other'
                            CHECK (doc_type IN (
                              'textbook','research','thesis','project',
                              'article','audio','video','guide','other'
                            )),

  -- Clasificación curricular (arrays para multi-materia / multi-grado)
  subjects      text[]      NOT NULL DEFAULT '{}',
  grades        text[]      NOT NULL DEFAULT '{}',
  tags          jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Archivo en Storage (cbf-library bucket)
  -- Institucional: {school_id}/inst/{doc_id}/{filename}
  -- Personal:      {school_id}/personal/{teacher_id}/{doc_id}/{filename}
  file_url      text,
  file_path     text,
  file_name     text,
  file_size     bigint,          -- bytes — usado para quota
  file_mime     text,
  page_count    integer,         -- para PDFs

  -- Recurso externo (alternativa al archivo subido)
  external_url  text,

  -- Metadata enriquecida
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- { author, year, publisher, isbn, edition, duration_seconds, resolution, language }

  -- Resumen IA (generado bajo demanda)
  ai_summary    text,

  -- Dos espacios: institucional (todos del colegio leen, admin escribe)
  --               personal     (solo el dueño)
  visibility    text        NOT NULL DEFAULT 'personal'
                            CHECK (visibility IN ('school', 'personal')),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_school_library_school_vis
  ON school_library(school_id, visibility);

CREATE INDEX IF NOT EXISTS idx_school_library_teacher
  ON school_library(teacher_id, visibility);

CREATE INDEX IF NOT EXISTS idx_school_library_doc_type
  ON school_library(school_id, doc_type);

CREATE INDEX IF NOT EXISTS idx_school_library_subjects
  ON school_library USING GIN(subjects);

-- Trigger updated_at
CREATE TRIGGER trg_school_library_updated_at
  BEFORE UPDATE ON school_library
  FOR EACH ROW EXECUTE FUNCTION update_school_library_updated_at();

-- =============================================================================
-- RLS — Seguridad por fila
-- =============================================================================

ALTER TABLE school_library ENABLE ROW LEVEL SECURITY;

-- 1. Documentos PERSONALES: solo el dueño (full CRUD)
CREATE POLICY "library_personal_owner" ON school_library
  FOR ALL
  USING (
    visibility = 'personal'
    AND teacher_id = auth.uid()
  );

-- 2. Documentos INSTITUCIONALES: todos los docentes del colegio pueden leer
CREATE POLICY "library_school_read" ON school_library
  FOR SELECT
  USING (
    visibility = 'school'
    AND school_id = get_my_school_id()
  );

-- 3. Documentos INSTITUCIONALES: Admin / Rector / Superadmin pueden gestionar
CREATE POLICY "library_admin_manage" ON school_library
  FOR ALL
  USING (
    visibility = 'school'
    AND school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM teachers
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'rector')
    )
  );

-- =============================================================================
-- schools.features — quota personal por defecto
-- No cambia el schema, solo documenta el key esperado:
--   features.library_quota_gb  integer  (default: 2)
-- Se puede ajustar en /settings → Feature flags, o por SQL:
--   UPDATE schools SET features = features || '{"library_quota_gb": 5}'
--   WHERE id = 'a21e681b-5898-4647-8ad9-bdb5f9844094';
-- =============================================================================
