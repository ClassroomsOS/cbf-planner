-- ══════════════════════════════════════════════════════════════════════════════
-- SESSION CONTROL ROOM — Sala de Control de Dictados
-- Fecha: 2026-05-27
-- Cambio: Extiende instance_status para permitir 'force_closed'
-- ══════════════════════════════════════════════════════════════════════════════

-- Extender el CHECK constraint de instance_status para incluir 'force_closed'
-- (El docente puede cerrar remotamente el examen de un estudiante)
ALTER TABLE dictation_instances
  DROP CONSTRAINT IF EXISTS dictation_instances_instance_status_check;

ALTER TABLE dictation_instances
  ADD CONSTRAINT dictation_instances_instance_status_check
  CHECK (instance_status IN ('ready', 'started', 'submitted', 'force_closed'));
