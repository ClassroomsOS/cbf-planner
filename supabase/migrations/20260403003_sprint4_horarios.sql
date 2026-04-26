-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 4 — Constructor de Horarios
-- CBF Planner — 2026-04-03
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Campo classroom en teacher_assignments ─────────────────────────────────
-- Identifica el salón/aula donde se dicta la clase.
-- Nullable — no todas las asignaciones tienen salón fijo.
-- Usado para detectar conflictos de espacio: mismo salón + mismo período = error.
ALTER TABLE teacher_assignments
  ADD COLUMN IF NOT EXISTS classroom text;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'teacher_assignments'
  AND column_name IN ('classroom', 'schedule', 'grade', 'section', 'subject')
ORDER BY column_name;
