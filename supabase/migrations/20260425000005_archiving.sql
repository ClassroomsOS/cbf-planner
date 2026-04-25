-- ── Archivado inmutable — guías y proyectos NEWS ─────────────────────────────
-- CBF Planner · Fase 5 · Sesión N
--
-- 1. storage_path en lesson_plan_versions → URL del HTML archivado en Storage
-- 2. news_project_versions              → snapshot JSON de proyectos NEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Columna storage_path en lesson_plan_versions
--    Al publicar una guía, el frontend sube el HTML con imágenes inlineadas a
--    Supabase Storage (bucket guide-images) y guarda la URL pública aquí.
ALTER TABLE lesson_plan_versions
  ADD COLUMN IF NOT EXISTS storage_path text;

-- 2. Versiones de proyectos NEWS
--    Snapshot inmutable del contenido JSONB del proyecto en el momento de archivar.
--    El docente puede archivar cualquier versión de su proyecto (no requiere admin).
CREATE TABLE IF NOT EXISTS news_project_versions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES news_projects(id) ON DELETE CASCADE,
  school_id    uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  version      integer     NOT NULL,
  content      jsonb       NOT NULL,   -- snapshot completo del form/proyecto
  note         text,                   -- comentario opcional del docente
  archived_by  uuid        NOT NULL REFERENCES teachers(id),
  archived_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

ALTER TABLE news_project_versions ENABLE ROW LEVEL SECURITY;

-- El dueño del proyecto puede crear y leer sus propias versiones
CREATE POLICY "npv_owner_all" ON news_project_versions
  FOR ALL USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM news_projects
      WHERE id = project_id
        AND teacher_id = auth.uid()
    )
  );

-- Admin/rector/superadmin puede leer todas las versiones del colegio
CREATE POLICY "npv_school_read" ON news_project_versions
  FOR SELECT USING (school_id = get_my_school_id());

-- Índice para listado rápido por proyecto
CREATE INDEX IF NOT EXISTS npv_project_idx ON news_project_versions (project_id, version DESC);
