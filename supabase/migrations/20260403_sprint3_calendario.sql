-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 3 — Calendario Institucional
-- CBF Planner — 2026-04-03
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Nuevos campos en school_calendar ───────────────────────────────────────

-- level: nivel educativo al que aplica el evento.
-- NULL = todos los niveles (comportamiento previo).
ALTER TABLE school_calendar
  ADD COLUMN IF NOT EXISTS level text
  CHECK (level IN ('elementary', 'middle', 'high'));

-- affects_planning: si TRUE, el sistema genera una notificación automática
-- a los docentes del nivel afectado para que revisen sus guías.
ALTER TABLE school_calendar
  ADD COLUMN IF NOT EXISTS affects_planning boolean NOT NULL DEFAULT false;

-- created_by: quién creó la entrada (admin, superadmin, psicopedagoga).
ALTER TABLE school_calendar
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES teachers(id) ON DELETE SET NULL;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'school_calendar'
  AND column_name IN ('level', 'affects_planning', 'created_by')
ORDER BY column_name;
