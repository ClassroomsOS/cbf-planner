-- ══════════════════════════════════════════════════════════════════════════════
-- Sesión B — Constraints adicionales en checkpoints
-- CBF Planner · ETA Platform — 2026-04-07
-- ══════════════════════════════════════════════════════════════════════════════
-- Agrega unique constraint en plan_id para permitir upsert por plan
-- cuando se usa el nuevo sistema de indicator_id.
-- ══════════════════════════════════════════════════════════════════════════════

-- Unique constraint para upsert por plan_id (nuevo sistema indicator-based)
ALTER TABLE checkpoints
  ADD CONSTRAINT checkpoints_plan_id_unique UNIQUE (plan_id);

-- Verificación
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'checkpoints'
  AND constraint_type = 'UNIQUE';
