-- ══════════════════════════════════════════════════════════════════════════════
-- Sesión L — columnas faltantes detectadas en auditoría 2026-04-25
-- CBF Planner · ETA Platform
-- ══════════════════════════════════════════════════════════════════════════════

-- teachers.telegram_chat_id — requerido por sistema antitrampa (Capa 4 — alertas Telegram)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- assessments.rubric_criteria — criterios de corrección del examen (JSONB)
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS rubric_criteria JSONB DEFAULT '[]'::jsonb;

-- assessments.biblical_min — % mínimo de preguntas bíblicas requeridas
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS biblical_min INTEGER DEFAULT 0;
