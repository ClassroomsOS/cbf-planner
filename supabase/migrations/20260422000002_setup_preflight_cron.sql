-- ============================================================
-- CBF PLANNER — Cron del Preflight Automático
-- Migración: 20260422000002_setup_preflight_cron
--
-- Lógica:
--   1. 8:00 PM del día anterior — preflight inicial
--   2. 6:00 AM del día del examen — preflight de confirmación
--   3. 30 minutos antes del examen — preflight final (crítico)
-- ============================================================

-- Función que encuentra sesiones que necesitan preflight
-- y llama a la Edge Function para cada una
CREATE OR REPLACE FUNCTION run_scheduled_preflights()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_trigger_type TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Iterar sobre sesiones que necesitan preflight ahora
  FOR v_session IN
    SELECT
      s.id AS session_id,
      s.school_id,
      s.scheduled_at,
      s.preflight_last_run,
      s.status,
      -- Determinar qué tipo de preflight corresponde
      CASE
        -- 30 minutos antes: preflight crítico pre-examen
        WHEN s.scheduled_at - v_now BETWEEN INTERVAL '25 minutes' AND INTERVAL '35 minutes'
          THEN 'pre_exam_auto'
        -- Mañana mismo: preflight de confirmación (6 AM)
        WHEN DATE(s.scheduled_at) = DATE(v_now)
          AND EXTRACT(HOUR FROM v_now) = 6
          THEN 'cron'
        -- Noche anterior (8 PM)
        WHEN DATE(s.scheduled_at) = DATE(v_now + INTERVAL '1 day')
          AND EXTRACT(HOUR FROM v_now) = 20
          THEN 'cron'
        ELSE NULL
      END AS trigger_type
    FROM exam_sessions s
    WHERE
      s.status IN ('preparing', 'ready')
      AND s.scheduled_at > v_now
      AND s.scheduled_at < v_now + INTERVAL '25 hours'
      -- Evitar doble ejecución en la misma ventana
      AND (
        s.preflight_last_run IS NULL
        OR s.preflight_last_run < v_now - INTERVAL '4 hours'
      )
  LOOP
    -- Solo procesar si hay un trigger type definido
    IF v_session.trigger_type IS NOT NULL THEN

      -- Llamar a la Edge Function via pg_net
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/exam-preflight',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'session_id', v_session.session_id,
          'triggered_by', v_session.trigger_type,
          'school_id', v_session.school_id
        )
      );

      -- Registrar en system_events
      INSERT INTO system_events (
        module, event_type, severity, message,
        school_id, metadata
      ) VALUES (
        'EXAM', 'PREFLIGHT_SCHEDULED', 'info',
        'Preflight automático disparado para sesión ' || v_session.session_id,
        v_session.school_id,
        jsonb_build_object(
          'session_id', v_session.session_id,
          'trigger_type', v_session.trigger_type,
          'scheduled_at', v_session.scheduled_at,
          'triggered_at', v_now
        )
      );

    END IF;
  END LOOP;
END;
$$;

-- ── Cron jobs ────────────────────────────────────────────────

-- Cron 1: Cada hora — busca sesiones que necesitan preflight
-- (La función internamente filtra por las ventanas de tiempo correctas)
SELECT cron.schedule(
  'exam-preflight-scheduler',
  '0 * * * *',              -- Cada hora en punto
  'SELECT run_scheduled_preflights()'
);

-- Cron 2: Cada 5 minutos — solo busca el preflight pre-examen (30min antes)
-- Más frecuente para no perderse la ventana de 30 minutos
SELECT cron.schedule(
  'exam-preflight-pre-exam',
  '*/5 * * * *',            -- Cada 5 minutos
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/exam-preflight-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'window_minutes', 35,
      'triggered_by', 'pre_exam_auto'
    )
  )
  FROM exam_sessions
  WHERE
    status IN ('preparing', 'ready')
    AND scheduled_at BETWEEN NOW() + INTERVAL '25 minutes'
                         AND NOW() + INTERVAL '35 minutes'
  LIMIT 1
  $$
);

-- ── Configurar variables de entorno en PostgreSQL ────────────
-- Estas se setean una sola vez y quedan disponibles para pg_cron

-- NOTA PARA DEPLOY:
-- Ejecutar estos comandos con los valores reales antes de activar los crons:
--
-- ALTER DATABASE postgres SET app.supabase_url = 'https://vouxrqsiyoyllxgcriic.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = '<SERVICE_ROLE_KEY>';

-- ── Nuevas reglas de alerta para el preflight ────────────────

INSERT INTO alert_rules (
  name, description, error_code, module,
  severity_min, threshold_count, threshold_minutes,
  notify_telegram, active
)
SELECT * FROM (VALUES
  ('exam_preflight_failed',
   'PREFLIGHT FALLIDO: hay un examen programado en las próximas 24h con preflight fallido',
   'CBF-EXAM-PRE-001', 'EXAM', 'critical', 1, 60, true, true),
  ('exam_preflight_warned_close',
   'PREFLIGHT CON ADVERTENCIAS: examen en menos de 2 horas con advertencias activas',
   'CBF-EXAM-PRE-002', 'EXAM', 'warn', 1, 30, true, true),
  ('exam_no_preflight_before_start',
   'ALERTA: examen en menos de 1 hora sin preflight ejecutado',
   'CBF-EXAM-PRE-001', 'EXAM', 'error', 1, 15, true, true)
) AS v(name, description, error_code, module, severity_min, threshold_count, threshold_minutes, notify_telegram, active)
WHERE NOT EXISTS (
  SELECT 1 FROM alert_rules ar WHERE ar.name = v.name
);

-- ── Comentario de arquitectura ───────────────────────────────
COMMENT ON FUNCTION run_scheduled_preflights IS
'Corre automáticamente cada hora. Detecta sesiones de examen próximas y
dispara exam-preflight en tres momentos: noche anterior (8PM),
mañana del examen (6AM), y 30 minutos antes del inicio.
Cada preflight verifica, auto-repara si puede, y notifica por Telegram.';
