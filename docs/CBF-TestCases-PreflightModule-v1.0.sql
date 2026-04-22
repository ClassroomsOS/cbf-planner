-- ============================================================
-- CBF TEST CASES — exam-preflight
-- Versión: 1.0.0 — 2026-04-22
-- Ejecutar en Supabase SQL Editor contra la BD de producción
-- o en el entorno de desarrollo con datos de prueba
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SETUP: Datos de prueba
-- Requiere: una sesión existente con school_id válido
-- Reemplazar los UUIDs con valores reales del entorno
-- ────────────────────────────────────────────────────────────

-- TC-PRE-001: Preflight con todo funcionando
-- ────────────────────────────────────────────────────────────
-- DESCRIPCIÓN: Sesión con instancias generadas, PDFs listos,
--              todos los servicios operativos
-- PRECONDICIÓN: Sesión en status 'ready' con N instancias completas
-- ACCIÓN: POST /functions/v1/exam-preflight
-- PAYLOAD: { "session_id": "<ID>", "triggered_by": "manual" }
-- RESULTADO ESPERADO:
--   verdict: "passed"
--   preflight_status en exam_sessions: "passed"
--   status en exam_sessions: "ready"
--   telegram_sent: true (mensaje verde)
--   exam_preflight_log: 1 registro nuevo con verdict "passed"
-- ────────────────────────────────────────────────────────────

-- TC-PRE-002: Preflight con instancias faltantes — auto-reparación
-- ────────────────────────────────────────────────────────────
-- DESCRIPCIÓN: Sesión con 3 instancias sin generated_questions
-- PRECONDICIÓN: Crear instancias vacías manualmente:
/*
UPDATE exam_instances
SET generated_questions = '[]'::jsonb
WHERE session_id = '<SESSION_ID>'
AND student_code IN ('EST-001', 'EST-002', 'EST-003');
*/
-- ACCIÓN: POST /functions/v1/exam-preflight
-- RESULTADO ESPERADO:
--   auto_repair_attempted: true
--   auto_repair_results.instances.success: true (si exam-instance-generator está activo)
--   Si reparación OK → verdict: "passed_with_warnings"
--   warnings: ["Instancias faltantes reparadas automáticamente durante preflight"]
--   Si reparación FALLA → verdict: "failed"
--   critical_failures contiene mensaje sobre instancias
-- ────────────────────────────────────────────────────────────

-- TC-PRE-003: Preflight con claude-proxy caído
-- ────────────────────────────────────────────────────────────
-- DESCRIPCIÓN: claude-proxy no responde (simular con timeout)
-- PRECONDICIÓN: Instancias y PDFs completos, claude-proxy inaccesible
-- RESULTADO ESPERADO:
--   checks.claude_proxy.ok: false
--   verdict: "passed_with_warnings" (no es crítico — corrección es asíncrona)
--   resilience_mode: "no_realtime_ai"
--   warnings: ["claude-proxy no disponible — corrección diferida post-examen"]
--   telegram: mensaje ⚠️ con modo activo indicado
-- ────────────────────────────────────────────────────────────

-- TC-PRE-004: Preflight con PDFs faltantes — auto-reparación
-- ────────────────────────────────────────────────────────────
-- PRECONDICIÓN: pdf_url = NULL en todas las instancias de la sesión
/*
UPDATE exam_instances SET pdf_url = NULL WHERE session_id = '<SESSION_ID>';
*/
-- RESULTADO ESPERADO:
--   checks.pdfs.ok: false inicialmente
--   auto_repair_attempted: true
--   auto_repair_results.pdfs.success: true (si exam-pdf-generator activo)
--   Si reparado → warnings contiene aviso, verdict no falla por esto
--   Si Storage caído también → warning "PDFs no disponibles — solo modo digital"
-- ────────────────────────────────────────────────────────────

-- TC-PRE-005: Preflight triple — noche anterior, mañana, 30min antes
-- ────────────────────────────────────────────────────────────
-- DESCRIPCIÓN: Verificar que el cron no ejecuta preflight dos veces
--              en la misma ventana de tiempo
-- PRECONDICIÓN: Ejecutar preflight manualmente, luego verificar
--               que el cron no lo vuelve a ejecutar en < 4 horas
-- VERIFICACIÓN SQL:
SELECT
  session_id,
  triggered_at,
  verdict,
  triggered_by
FROM exam_preflight_log
WHERE session_id = '<SESSION_ID>'
ORDER BY triggered_at DESC;
-- RESULTADO ESPERADO: Solo 1 registro por ventana de 4 horas
-- ────────────────────────────────────────────────────────────

-- TC-PRE-006: Preflight actualiza exam_sessions correctamente
-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN después de cualquier preflight:
SELECT
  id,
  title,
  status,
  preflight_status,
  preflight_last_run,
  resilience_mode,
  contingency_active,
  jsonb_pretty(preflight_results) AS preflight_results
FROM exam_sessions
WHERE id = '<SESSION_ID>';
-- RESULTADO ESPERADO:
--   preflight_last_run: timestamp reciente (< 2 minutos)
--   preflight_status: 'passed' | 'warned' | 'failed'
--   status: 'ready' si passed o warned, 'preparing' si failed
--   resilience_mode: 'full' | 'no_realtime_ai' | 'offline_sync' | 'pdf_fallback'
--   preflight_results: JSON completo con todos los checks
-- ────────────────────────────────────────────────────────────

-- TC-PRE-007: Log forense — inmutabilidad
-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN: el log nunca se modifica, solo se inserta
SELECT COUNT(*) AS total_logs FROM exam_preflight_log
WHERE session_id = '<SESSION_ID>';
-- Ejecutar preflight 3 veces manualmente
-- RESULTADO ESPERADO: COUNT = 3 (uno por ejecución, nunca sobreescrito)
-- ────────────────────────────────────────────────────────────

-- TC-PRE-008: Telegram enviado con formato correcto
-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN MANUAL: revisar el chat de Telegram después del preflight
-- RESULTADO ESPERADO:
--   Mensaje con emoji correcto (✅ / ⚠️ / 🚨)
--   Nombre del examen, fecha, hora
--   Estado de cada check con latencia
--   Modo de resiliencia activo
--   Warnings o fallas si aplica
-- ────────────────────────────────────────────────────────────

-- TC-PRE-009: Alertas automáticas de pg_cron
-- ────────────────────────────────────────────────────────────
-- Crear sesión con preflight_status = 'failed' y scheduled_at en < 24h
/*
UPDATE exam_sessions
SET preflight_status = 'failed', scheduled_at = NOW() + INTERVAL '3 hours'
WHERE id = '<SESSION_ID>';
*/
-- Esperar hasta la próxima ejecución del health check (cada hora)
-- RESULTADO ESPERADO:
--   Alerta Telegram 'PREFLIGHT FALLIDO' disparada
--   system_alerts: 1 registro nuevo con rule 'exam_preflight_failed'
-- ────────────────────────────────────────────────────────────

-- TC-PRE-010: Preflight con sesión inexistente
-- ────────────────────────────────────────────────────────────
-- PAYLOAD: { "session_id": "00000000-0000-0000-0000-000000000000", "triggered_by": "manual" }
-- RESULTADO ESPERADO:
--   HTTP 500
--   body: { "error": "Sesión no encontrada: 00000000-0000-0000-0000-000000000000" }
--   system_events: 1 registro con severity 'critical', error_code 'CBF-EXAM-PRE-001'
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- QUERIES DE VERIFICACIÓN RÁPIDA POST-DEPLOY
-- ────────────────────────────────────────────────────────────

-- Ver todos los preflights del día
SELECT
  pl.session_id,
  s.title,
  s.scheduled_at,
  pl.triggered_by,
  pl.verdict,
  pl.warnings,
  pl.critical_failures,
  pl.auto_repair_attempted,
  pl.telegram_sent,
  pl.triggered_at
FROM exam_preflight_log pl
JOIN exam_sessions s ON s.id = pl.session_id
WHERE pl.triggered_at > NOW() - INTERVAL '24 hours'
ORDER BY pl.triggered_at DESC;

-- Ver sesiones próximas con su estado de preflight
SELECT
  id,
  title,
  scheduled_at,
  status,
  preflight_status,
  preflight_last_run,
  resilience_mode,
  EXTRACT(EPOCH FROM (scheduled_at - NOW())) / 3600 AS hours_until_exam
FROM exam_sessions
WHERE scheduled_at > NOW() AND scheduled_at < NOW() + INTERVAL '48 hours'
ORDER BY scheduled_at ASC;

-- Ver crons activos del sistema
SELECT jobname, schedule, command, active
FROM cron.job
WHERE jobname LIKE 'exam-%'
ORDER BY jobname;
