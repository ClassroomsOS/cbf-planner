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
  name, condition_sql, severity, message_template,
  notification_channels, cooldown_minutes, is_active
) VALUES
(
  'exam_preflight_failed',
  $$EXISTS (
    SELECT 1 FROM exam_sessions
    WHERE preflight_status = 'failed'
    AND scheduled_at > NOW()
    AND scheduled_at < NOW() + INTERVAL '24 hours'
  )$$,
  'critical',
  'PREFLIGHT FALLIDO: hay un examen programado en las próximas 24h con preflight fallido',
  ARRAY['telegram'],
  60,  -- no repetir más de una vez por hora
  true
),
(
  'exam_preflight_warned_close',
  $$EXISTS (
    SELECT 1 FROM exam_sessions
    WHERE preflight_status = 'warned'
    AND scheduled_at > NOW()
    AND scheduled_at < NOW() + INTERVAL '2 hours'
  )$$,
  'warn',
  'PREFLIGHT CON ADVERTENCIAS: examen en menos de 2 horas con advertencias activas',
  ARRAY['telegram'],
  30,
  true
),
(
  'exam_no_preflight_before_start',
  $$EXISTS (
    SELECT 1 FROM exam_sessions
    WHERE preflight_status = 'pending'
    AND scheduled_at > NOW()
    AND scheduled_at < NOW() + INTERVAL '1 hour'
  )$$,
  'error',
  'ALERTA: examen en menos de 1 hora sin preflight ejecutado',
  ARRAY['telegram'],
  15,
  true
)
ON CONFLICT (name) DO UPDATE SET
  condition_sql = EXCLUDED.condition_sql,
  message_template = EXCLUDED.message_template,
  is_active = EXCLUDED.is_active;

-- ── Comentario de arquitectura ───────────────────────────────
COMMENT ON FUNCTION run_scheduled_preflights IS
'Corre automáticamente cada hora. Detecta sesiones de examen próximas y
dispara exam-preflight en tres momentos: noche anterior (8PM),
mañana del examen (6AM), y 30 minutos antes del inicio.
Cada preflight verifica, auto-repara si puede, y notifica por Telegram.';
