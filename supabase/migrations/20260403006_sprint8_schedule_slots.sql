-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 8 — Franjas del Horario (schedule_slots)
-- CBF Planner — 2026-04-03
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schedule_slots (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id  uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       text        NOT NULL,          -- 'DEVOCIONAL', 'RECESO', 'ALMUERZO'
  start_time time        NOT NULL,          -- e.g. '07:40:00'
  end_time   time        NOT NULL,          -- e.g. '08:00:00'
  level      text        CHECK (level IN ('elementary', 'middle', 'high')),  -- NULL = todos
  color      text        NOT NULL DEFAULT '#F79646',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;

-- All approved teachers of the school can read slots (shown in SchedulePage)
CREATE POLICY "School members can read schedule slots" ON schedule_slots
  FOR SELECT USING (
    school_id = (SELECT school_id FROM teachers WHERE id = auth.uid())
  );

-- Only admin/superadmin can create/edit/delete slots
CREATE POLICY "Admins can manage schedule slots" ON schedule_slots
  FOR ALL USING (
    school_id = (SELECT school_id FROM teachers WHERE id = auth.uid())
    AND (SELECT role FROM teachers WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'schedule_slots'
ORDER BY ordinal_position;
