-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 5 — Agenda Semanal Automática
-- CBF Planner — 2026-04-03
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla weekly_agendas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_agendas (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id    uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade        text        NOT NULL,   -- e.g. "7.°"
  section      text        NOT NULL,   -- e.g. "A"
  week_start   date        NOT NULL,   -- lunes de la semana
  period       smallint,               -- período académico (1-4)
  devotional   text,                   -- devoción / versículo rector de la semana
  notes        text,                   -- notas del director para los padres
  content      jsonb       NOT NULL DEFAULT '{"entries":[]}',
  -- entries: [{ subject, teacher_name, days: { "YYYY-MM-DD": "texto" } }]
  status       text        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'ready', 'sent')),
  created_by   uuid        REFERENCES teachers(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, grade, section, week_start)
);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE weekly_agendas ENABLE ROW LEVEL SECURITY;

-- Todos los docentes del colegio pueden leer las agendas (padres también, vía export)
CREATE POLICY "School members can read agendas" ON weekly_agendas
  FOR SELECT USING (
    school_id = (SELECT school_id FROM teachers WHERE id = auth.uid())
  );

-- Solo admin, superadmin y director pueden crear/editar/borrar agendas
CREATE POLICY "Managers can write agendas" ON weekly_agendas
  FOR ALL USING (
    school_id = (SELECT school_id FROM teachers WHERE id = auth.uid())
    AND (SELECT role FROM teachers WHERE id = auth.uid())
        IN ('admin', 'superadmin', 'director')
  );

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'weekly_agendas'
ORDER BY ordinal_position;
