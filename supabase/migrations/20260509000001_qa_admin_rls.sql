-- =============================================================================
-- QA Admin RLS — acceso de observabilidad para admin/rector/superadmin
-- =============================================================================
-- Los logs de clientes (error_log, activity_log) solo tienen la política _own.
-- Aquí agregamos políticas SELECT que permiten a los admins ver todos los logs
-- de su colegio, sin acceso de escritura.
-- =============================================================================

-- ── error_log — admin oversight ─────────────────────────────────────────────
CREATE POLICY "error_log_admin_read" ON error_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers t_viewer
      WHERE t_viewer.id = auth.uid()
        AND t_viewer.role IN ('admin', 'superadmin', 'rector')
        AND (
          -- El log tiene school_id directo
          error_log.school_id = t_viewer.school_id
          -- O el log tiene teacher_id y ese docente es del mismo colegio
          OR EXISTS (
            SELECT 1 FROM teachers t_subject
            WHERE t_subject.id = error_log.teacher_id
              AND t_subject.school_id = t_viewer.school_id
          )
        )
    )
  );

-- ── activity_log — admin oversight ──────────────────────────────────────────
CREATE POLICY "activity_log_admin_read" ON activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers t_viewer
      WHERE t_viewer.id = auth.uid()
        AND t_viewer.role IN ('admin', 'superadmin', 'rector')
        AND (
          activity_log.school_id = t_viewer.school_id
          OR EXISTS (
            SELECT 1 FROM teachers t_subject
            WHERE t_subject.id = activity_log.teacher_id
              AND t_subject.school_id = t_viewer.school_id
          )
        )
    )
  );

-- ── system_events — habilitar RLS + admin read ───────────────────────────────
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_events_admin_read" ON system_events
  FOR SELECT
  USING (
    -- Eventos globales (sin school_id) visibles para superadmin
    school_id IS NULL
    OR EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.school_id = system_events.school_id
        AND t.role IN ('admin', 'superadmin', 'rector')
    )
  );

-- Edge Functions escriben en system_events con service_role (sin RLS check)
-- INSERT desde el cliente no está permitido
CREATE POLICY "system_events_insert_deny" ON system_events
  FOR INSERT WITH CHECK (false);

-- ── system_health_snapshots — admin read ────────────────────────────────────
ALTER TABLE system_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_snapshots_admin_read" ON system_health_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.role IN ('admin', 'superadmin', 'rector')
    )
  );

-- ── system_alerts — la política _school ya existe, asegurar admin puede ver todo ──
-- La política system_alerts_global ya cubre SELECT sin filtro school_id para admins.
-- No duplicar.
