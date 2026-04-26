-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 6 — AI Avanzado
-- CBF Planner — 2026-04-03
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Límite mensual de tokens por docente ───────────────────────────────────
-- 0 = ilimitado (default). El coordinador puede fijar un límite por docente.
-- Ejemplo: 50000 tokens/mes ≈ 25 generaciones de guía completa.
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS ai_monthly_limit integer NOT NULL DEFAULT 0;

-- ── 2. Asegurar que ai_usage existe con las columnas esperadas ────────────────
-- Esta tabla puede haberse creado manualmente. Aseguramos las columnas necesarias.
CREATE TABLE IF NOT EXISTS ai_usage (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id     uuid        REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    uuid        REFERENCES teachers(id) ON DELETE SET NULL,
  type          text        NOT NULL DEFAULT 'unknown',
  input_tokens  integer     NOT NULL DEFAULT 0,
  output_tokens integer     NOT NULL DEFAULT 0,
  cost_usd      numeric(10,6) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can insert own usage" ON ai_usage;
CREATE POLICY "Teachers can insert own usage" ON ai_usage
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can read own usage" ON ai_usage;
CREATE POLICY "Teachers can read own usage" ON ai_usage
  FOR SELECT USING (
    teacher_id = auth.uid()
    OR school_id = (SELECT school_id FROM teachers WHERE id = auth.uid())
       AND (SELECT role FROM teachers WHERE id = auth.uid()) IN ('admin','superadmin')
  );

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('teachers', 'ai_usage')
  AND column_name IN ('ai_monthly_limit', 'input_tokens', 'output_tokens', 'cost_usd')
ORDER BY table_name, column_name;
