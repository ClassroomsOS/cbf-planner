-- ══════════════════════════════════════════════════════════════════════════════
-- Sesión A — Bloque 3: Extensiones a news_projects y lesson_plans
-- CBF Planner · ETA Platform — 2026-04-07
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- Todas las columnas son nullable — no rompe datos existentes.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. news_projects — agregar indicator_id ───────────────────────────────────
-- FK obligatorio al indicador que este NEWS Project jalona.
-- El indicador determina el criterio de evaluación principal.
ALTER TABLE news_projects
  ADD COLUMN IF NOT EXISTS indicator_id UUID
  REFERENCES achievement_indicators(id) ON DELETE SET NULL;

-- ── 2. lesson_plans — agregar syllabus_topic_id ───────────────────────────────
-- Contenido del syllabus que se trabaja en esta guía.
-- Pre-fill automático desde el NEWS Project activo.
ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS syllabus_topic_id UUID
  REFERENCES syllabus_topics(id) ON DELETE SET NULL;

-- ── 3. lesson_plans — agregar eleot_coverage ──────────────────────────────────
-- Cobertura eleot® calculada al momento de diseño.
-- Formato: {"A": 3.5, "B": 4.0, "C": 2.8, "D": 3.9, "E": 4.0, "F": 3.5, "G": 4.2}
ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS eleot_coverage JSONB
  NOT NULL DEFAULT '{}';

-- ── 4. lesson_plans — agregar session_agenda ─────────────────────────────────
-- Agenda de la clase generada automáticamente desde los Smart Blocks.
-- Formato: [{"duration": 5, "activity": "Warm-up"}, ...]
ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS session_agenda JSONB
  NOT NULL DEFAULT '[]';

-- ── 5. lesson_plans — agregar indicator_id ────────────────────────────────────
-- FK directo al indicador de logro que esta guía trabaja.
-- Heredado del NEWS Project activo al momento de creación.
ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS indicator_id UUID
  REFERENCES achievement_indicators(id) ON DELETE SET NULL;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'news_projects'
  AND column_name = 'indicator_id';

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'lesson_plans'
  AND column_name IN ('syllabus_topic_id','eleot_coverage','session_agenda','indicator_id')
ORDER BY column_name;
