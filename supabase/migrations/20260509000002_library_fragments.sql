-- ── Biblioteca CBF — Fase 3: Fragment Extractor ──────────────────────────────
-- Fragmentos extraídos de documentos de la biblioteca (PDF/imagen)
-- Analizados con Claude Vision → SmartBlock sugerido → asignables a guías

CREATE TABLE IF NOT EXISTS library_fragments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid REFERENCES schools(id)        NOT NULL,
  doc_id           uuid REFERENCES school_library(id) ON DELETE CASCADE NOT NULL,
  created_by       uuid REFERENCES teachers(id)       NOT NULL,

  -- Localización en el documento
  page_number      integer,          -- null para imágenes no-PDF
  region           jsonb NOT NULL,   -- { x, y, w, h } como % 0–1 del canvas

  -- Asset capturado
  image_url        text NOT NULL,    -- Storage: cbf-library/{school_id}/fragments/{doc_id}/{id}.webp

  -- Texto extraído (PDF.js text layer; null si PDF escaneado o imagen)
  extracted_text   text,

  -- Resultado del análisis de Claude Vision
  ai_analysis      jsonb,
  -- {
  --   content_type: 'table'|'vocabulary'|'grammar'|'reading'|'exercise'|'image',
  --   description:  string,
  --   language:     'es'|'en',
  --   structured_data: { ... },
  --   suggested_smartblock: { id, type, model, data }
  -- }

  -- Asignación pedagógica (para flujo hacia GuideEditorPage)
  assigned_subject text,
  assigned_grade   text,
  assigned_week    integer,          -- número de semana ISO (1–53)

  created_at       timestamptz DEFAULT now()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS library_fragments_doc_id_idx
  ON library_fragments(doc_id);

CREATE INDEX IF NOT EXISTS library_fragments_school_week_idx
  ON library_fragments(school_id, assigned_subject, assigned_grade, assigned_week)
  WHERE assigned_week IS NOT NULL;

-- RLS
ALTER TABLE library_fragments ENABLE ROW LEVEL SECURITY;

-- El creador puede hacer todo sobre sus propios fragmentos
CREATE POLICY "fragments_owner"
  ON library_fragments FOR ALL
  USING (created_by = auth.uid());

-- Cualquier docente del colegio puede ver fragmentos de su institución
CREATE POLICY "fragments_school_read"
  ON library_fragments FOR SELECT
  USING (school_id = get_my_school_id());
