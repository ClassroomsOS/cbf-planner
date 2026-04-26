-- ══════════════════════════════════════════════════════════════════════════════
-- Roles y Estructura — Sprint Roles
-- CBF Planner — 2026-04-03
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Expandir CHECK constraint en teachers.role ─────────────────────────────
-- Nuevos roles: superadmin, director, psicopedagoga
-- Mantenemos 'admin' para compatibilidad con registros existentes.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name
    INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'teachers'
      AND tc.constraint_type = 'CHECK'
      AND tc.constraint_name ILIKE '%role%'
    LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE teachers DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

ALTER TABLE teachers
  ADD CONSTRAINT teachers_role_check
  CHECK (role IN ('teacher', 'admin', 'superadmin', 'director', 'psicopedagoga'));

-- ── 2. Campo level para docentes ──────────────────────────────────────────────
-- Nivel educativo al que pertenece el docente/directivo.
-- Nullable — no todos los roles necesitan nivel.
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS level text
  CHECK (level IN ('elementary', 'middle', 'high'));

-- ── 3. RLS — Directores, admins y superadmins leen todos los planes ───────────
-- Por defecto RLS restringe lesson_plans al teacher_id propietario.
-- Esta política adicional permite SELECT a admin/superadmin/director del mismo colegio.
-- Supabase evalúa múltiples SELECT policies con OR — se permite si ALGUNA es true.
DROP POLICY IF EXISTS "Managers can read school lesson plans" ON lesson_plans;
CREATE POLICY "Managers can read school lesson plans"
  ON lesson_plans
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM teachers WHERE id = auth.uid())
    AND (SELECT role FROM teachers WHERE id = auth.uid())
        IN ('admin', 'superadmin', 'director')
  );

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'teachers'
  AND column_name IN ('role', 'level')
ORDER BY column_name;
