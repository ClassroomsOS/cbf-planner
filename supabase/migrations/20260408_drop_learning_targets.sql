-- ── 20260408_drop_learning_targets.sql ──────────────────────────────────────
-- Elimina la tabla learning_targets (sistema legacy de logros).
-- Condiciones confirmadas antes de ejecutar:
--   - 1 fila, description vacía, datos de prueba (Science 7.°, Apr 6 2026)
--   - Sin FKs entrantes (checkpoints/lesson_plans/news_projects ya dropearon
--     sus columnas target_id en 20260408_drop_legacy_target_id.sql)
--   - Ningún componente del frontend la referencia (limpieza completada Ses. H)
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS learning_targets;
