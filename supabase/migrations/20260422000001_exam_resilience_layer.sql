-- ============================================================
-- CBF PLANNER — MÓDULO DE EVALUACIÓN RESILIENTE
-- Migración: 20260422000001_exam_resilience_layer
-- Doctrina: El examen siempre corre. Dentro del sistema. Siempre.
-- ============================================================

-- ============================================================
-- BLOQUE 0: TABLAS DE OBSERVABILIDAD (IF NOT EXISTS — ya existen en prod)
-- ============================================================

CREATE TABLE IF NOT EXISTS system_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID REFERENCES schools(id),
  module          TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('info','warn','error','critical')),
  message         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  resolved        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT UNIQUE NOT NULL,
  condition_sql         TEXT NOT NULL,
  severity              TEXT NOT NULL CHECK (severity IN ('info','warn','error','critical')),
  message_template      TEXT NOT NULL,
  notification_channels TEXT[] DEFAULT ARRAY['telegram'],
  cooldown_minutes      INTEGER DEFAULT 60,
  is_active             BOOLEAN DEFAULT true,
  last_triggered_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 1: BLUEPRINTS
-- El docente define la intención pedagógica, no las preguntas.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_blueprints (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES schools(id),
  teacher_id            UUID NOT NULL REFERENCES teachers(id),

  -- Identidad pedagógica
  title                 TEXT NOT NULL,
  subject               TEXT NOT NULL,
  grade                 TEXT NOT NULL,
  period                INTEGER NOT NULL CHECK (period BETWEEN 1 AND 4),
  unit_reference        TEXT,
  news_project_id       UUID REFERENCES news_projects(id),

  -- Contexto pedagógico
  learning_objectives   TEXT[] NOT NULL DEFAULT '{}',
  skills_targeted       TEXT[] NOT NULL DEFAULT '{}',
  vocabulary_scope      TEXT,
  grammar_scope         TEXT,
  content_topics        TEXT[] NOT NULL DEFAULT '{}',
  biblical_connection   TEXT,
  cefr_level            TEXT,
  difficulty_profile    TEXT NOT NULL DEFAULT 'mixed'
                        CHECK (difficulty_profile IN ('basic', 'mixed', 'challenging')),

  -- Estructura del examen
  total_points          INTEGER NOT NULL DEFAULT 20,
  estimated_minutes     INTEGER NOT NULL DEFAULT 60,
  sections              JSONB NOT NULL DEFAULT '[]',
  -- sections: [{
  --   id, name, skill, question_types[], content_types[], response_types[],
  --   points, question_count, instructions, biblical_min_pct
  -- }]

  -- Estado
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'ready', 'archived')),

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 2: SESSIONS
-- El evento pedagógico — el examen en vivo con su grupo.
-- Un blueprint puede tener N sesiones.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES schools(id),
  teacher_id            UUID NOT NULL REFERENCES teachers(id),
  blueprint_id          UUID NOT NULL REFERENCES exam_blueprints(id),

  -- Identidad del evento
  title                 TEXT NOT NULL,
  subject               TEXT NOT NULL,
  grade                 TEXT NOT NULL,
  period                INTEGER NOT NULL CHECK (period BETWEEN 1 AND 4),

  -- Acceso
  access_code           TEXT NOT NULL,

  -- Estado del evento
  status                TEXT NOT NULL DEFAULT 'preparing'
                        CHECK (status IN ('preparing','ready','active','completed','cancelled')),
  scheduled_at          TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  duration_minutes      INTEGER NOT NULL DEFAULT 60,

  -- Resiliencia
  resilience_mode       TEXT NOT NULL DEFAULT 'full'
                        CHECK (resilience_mode IN
                          ('full','no_realtime_ai','offline_sync','pdf_fallback','hybrid_recovery')),
  contingency_active    BOOLEAN DEFAULT false,
  contingency_type      TEXT,
  active_delivery_mode  TEXT DEFAULT 'digital'
                        CHECK (active_delivery_mode IN ('digital','printed','offline','manual')),

  -- Preflight
  preflight_status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (preflight_status IN ('pending','passed','warned','failed')),
  preflight_last_run    TIMESTAMPTZ,

  -- Payload para Service Worker (offline caching)
  service_worker_payload JSONB DEFAULT '{}',

  -- Contadores en tiempo real (actualizados por heartbeat)
  total_students        INTEGER DEFAULT 0,
  students_opened       INTEGER DEFAULT 0,
  students_active       INTEGER DEFAULT 0,
  students_submitted    INTEGER DEFAULT 0,
  students_with_error   INTEGER DEFAULT 0,
  students_offline      INTEGER DEFAULT 0,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 3: INSTANCES
-- El examen único generado por IA para un estudiante específico.
-- generated_questions es INMUTABLE después de generación.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_instances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES exam_sessions(id),
  school_id             UUID NOT NULL REFERENCES schools(id),

  -- Identidad del estudiante
  student_code          TEXT NOT NULL,
  student_name          TEXT,

  -- El examen único (inmutable post-generación)
  generated_questions   JSONB NOT NULL DEFAULT '[]',
  -- [{
  --   id, section_id, question_type, stem, options[], correct_answer,
  --   points, content_type, response_type, stimulus_url, order_position
  -- }]
  version_label         TEXT DEFAULT 'A',

  -- Contingencia papel
  pdf_url               TEXT,
  pdf_generated_at      TIMESTAMPTZ,

  -- Estado
  instance_status       TEXT NOT NULL DEFAULT 'pending'
                        CHECK (instance_status IN
                          ('pending','generating','ready','started','submitted','error')),
  delivery_mode         TEXT NOT NULL DEFAULT 'digital'
                        CHECK (delivery_mode IN ('digital','printed','offline','manual')),

  -- Timing
  started_at            TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,

  -- Integridad
  tab_switches          INTEGER DEFAULT 0,
  fullscreen_exits      INTEGER DEFAULT 0,
  time_spent_seconds    INTEGER DEFAULT 0,
  integrity_flags       JSONB DEFAULT '{}',
  -- { high_risk: bool, events: [{type, ts}], watermark_name: str }

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 4: RESPONSES
-- Respuestas por pregunta — polimórficas por response_type.
-- response_origin garantiza trazabilidad sin importar el canal.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id           UUID NOT NULL REFERENCES exam_instances(id),
  session_id            UUID NOT NULL REFERENCES exam_sessions(id),
  school_id             UUID NOT NULL REFERENCES schools(id),

  -- Referencia a la pregunta
  question_id           TEXT NOT NULL,
  question_type         TEXT NOT NULL,
  points_possible       NUMERIC NOT NULL DEFAULT 0,

  -- Respuesta (polimórfica)
  response_type         TEXT NOT NULL,
  -- 'selection' | 'written' | 'audio' | 'image' | 'numeric' | ...
  response_origin       TEXT NOT NULL DEFAULT 'digital_realtime',
  -- 'digital_realtime' | 'digital_offline_sync' | 'photo_paper' | 'manual_import'
  answer                JSONB NOT NULL DEFAULT '{}',
  -- selection: {selected: 'A'}
  -- written:   {text: '...'}
  -- audio:     {audio_url: '...', transcript: '...'}
  -- image:     {image_url: '...'}
  -- numeric:   {value: 3.14, unit: 'cm'}

  -- Corrección automática (MC instantáneo)
  auto_score            NUMERIC,

  -- Corrección IA
  ai_score              NUMERIC,
  ai_feedback           TEXT,
  ai_confidence         NUMERIC CHECK (ai_confidence BETWEEN 0 AND 1),
  ai_correction_status  TEXT NOT NULL DEFAULT 'pending'
                        CHECK (ai_correction_status IN
                          ('pending','processing','completed','failed','deferred','not_needed')),
  ai_corrected_at       TIMESTAMPTZ,

  -- Revisión humana
  human_score           NUMERIC,
  human_feedback        TEXT,
  human_reviewer_id     UUID REFERENCES teachers(id),
  needs_human_review    BOOLEAN DEFAULT false,
  reviewed_at           TIMESTAMPTZ,

  -- Nota final: humano gana sobre IA gana sobre automático
  -- Calculada por trigger recalculate_exam_result()
  final_score           NUMERIC GENERATED ALWAYS AS (
    COALESCE(human_score, ai_score, auto_score)
  ) STORED,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 5: RESULTS
-- Resultado final calculado automáticamente.
-- human_score tiene precedencia garantizada por la BD.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_results (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES exam_sessions(id),
  instance_id             UUID NOT NULL REFERENCES exam_instances(id),
  school_id               UUID NOT NULL REFERENCES schools(id),
  UNIQUE (instance_id),

  -- Identidad
  student_name            TEXT,
  student_code            TEXT,

  -- Puntaje calculado
  total_points_earned     NUMERIC DEFAULT 0,
  total_points_possible   NUMERIC DEFAULT 0,
  percentage              NUMERIC DEFAULT 0,
  colombian_grade         NUMERIC DEFAULT 1.0,
  -- ROUND((1 + (earned/possible) * 4) * 10) / 10
  -- 0%→1.0  60%→3.4  100%→5.0

  performance_level       TEXT DEFAULT 'DB',
  -- S (≥4.5) | A (≥4.0) | B (≥3.5) | DB (<3.5)

  -- Estado de corrección
  pending_responses       INTEGER DEFAULT 0,
  correction_complete     BOOLEAN DEFAULT false,

  -- Nota docente (override final)
  grade_confirmed         BOOLEAN DEFAULT false,
  teacher_final_grade     NUMERIC,
  teacher_comments        TEXT,
  confirmed_at            TIMESTAMPTZ,
  confirmed_by            UUID REFERENCES teachers(id),

  -- Modalidad
  completion_mode         TEXT DEFAULT 'digital',

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 6: PREFLIGHT LOG
-- Registro forense inmutable de cada verificación pre-examen.
-- NUNCA se borra — evidencia institucional.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_preflight_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES exam_sessions(id),
  school_id         UUID NOT NULL REFERENCES schools(id),

  -- Quién y cuándo lo disparó
  triggered_by      TEXT NOT NULL,
  -- 'cron' | 'manual' | 'pre_exam_auto'
  trigger_moment    TEXT NOT NULL,
  -- 't_minus_24h' | 't_minus_0h' | 't_minus_30min' | 'manual'

  -- Veredicto
  verdict           TEXT NOT NULL CHECK (verdict IN ('passed', 'warned', 'failed')),

  -- Resultados detallados por check
  checks            JSONB NOT NULL DEFAULT '{}',
  -- {
  --   supabase:    { ok, latency_ms, error },
  --   claude_proxy:{ ok, latency_ms, error },
  --   storage:     { ok, latency_ms, error },
  --   instances:   { ok, total, ready, missing, repaired },
  --   pdfs:        { ok, total, generated, missing, repaired },
  --   ai_corrector:{ ok, latency_ms, error }
  -- }

  -- Auto-reparaciones realizadas
  auto_repairs      JSONB DEFAULT '[]',
  -- [{ type, description, success, ts }]

  -- Notificación
  telegram_sent     BOOLEAN DEFAULT false,
  telegram_message  TEXT,

  -- INMUTABLE — sin updated_at
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 7: OFFLINE QUEUE
-- Respuestas acumuladas sin conexión esperando sincronización.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_offline_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES exam_sessions(id),
  instance_id         UUID NOT NULL REFERENCES exam_instances(id),
  school_id           UUID NOT NULL REFERENCES schools(id),

  -- Respuestas acumuladas en IndexedDB del navegador
  question_responses  JSONB NOT NULL DEFAULT '[]',
  -- [{ question_id, response_type, answer, answered_at }]

  -- Estado de sincronización
  sync_status         TEXT NOT NULL DEFAULT 'pending'
                      CHECK (sync_status IN ('pending','syncing','synced','failed')),
  sync_attempts       INTEGER DEFAULT 0,
  last_sync_attempt   TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ,
  sync_error          TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOQUE 8: TRIGGERS
-- ============================================================

-- Función: recalcular resultado cuando cambia una respuesta
CREATE OR REPLACE FUNCTION recalculate_exam_result()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_session_id      UUID;
  v_school_id       UUID;
  v_total_earned    NUMERIC;
  v_total_possible  NUMERIC;
  v_pending         INTEGER;
  v_pct             NUMERIC;
  v_grade           NUMERIC;
  v_level           TEXT;
BEGIN
  -- Obtener session_id y school_id desde la instancia
  SELECT i.session_id, i.school_id, i.student_name, i.student_code
  INTO v_session_id, v_school_id, v_total_earned, v_total_possible
  FROM exam_instances i WHERE i.id = NEW.instance_id;

  -- Agregar scores de todas las respuestas de esta instancia
  SELECT
    COALESCE(SUM(COALESCE(r.human_score, r.ai_score, r.auto_score, 0)), 0),
    COALESCE(SUM(r.points_possible), 0),
    COUNT(*) FILTER (WHERE r.ai_correction_status IN ('pending','processing'))
  INTO v_total_earned, v_total_possible, v_pending
  FROM exam_responses r
  WHERE r.instance_id = NEW.instance_id;

  -- Calcular nota colombiana
  IF v_total_possible > 0 THEN
    v_pct   := ROUND((v_total_earned / v_total_possible * 100)::NUMERIC, 1);
    v_grade := ROUND((1 + (v_total_earned / v_total_possible) * 4)::NUMERIC, 1);
  ELSE
    v_pct   := 0;
    v_grade := 1.0;
  END IF;

  -- Nivel de desempeño
  v_level := CASE
    WHEN v_grade >= 4.5 THEN 'S'
    WHEN v_grade >= 4.0 THEN 'A'
    WHEN v_grade >= 3.5 THEN 'B'
    ELSE 'DB'
  END;

  -- Upsert en exam_results
  INSERT INTO exam_results (
    session_id, instance_id, school_id,
    student_name, student_code,
    total_points_earned, total_points_possible,
    percentage, colombian_grade, performance_level,
    pending_responses, correction_complete,
    completion_mode
  )
  SELECT
    v_session_id, NEW.instance_id, i.school_id,
    i.student_name, i.student_code,
    v_total_earned, v_total_possible,
    v_pct, v_grade, v_level,
    v_pending, (v_pending = 0),
    i.delivery_mode
  FROM exam_instances i WHERE i.id = NEW.instance_id
  ON CONFLICT (instance_id) DO UPDATE SET
    total_points_earned  = EXCLUDED.total_points_earned,
    total_points_possible= EXCLUDED.total_points_possible,
    percentage           = EXCLUDED.percentage,
    colombian_grade      = EXCLUDED.colombian_grade,
    performance_level    = EXCLUDED.performance_level,
    pending_responses    = EXCLUDED.pending_responses,
    correction_complete  = EXCLUDED.correction_complete,
    updated_at           = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalculate_result
  AFTER INSERT OR UPDATE OF ai_score, human_score, auto_score ON exam_responses
  FOR EACH ROW EXECUTE FUNCTION recalculate_exam_result();

-- Función: updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_blueprints_updated_at
  BEFORE UPDATE ON exam_blueprints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_instances_updated_at
  BEFORE UPDATE ON exam_instances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_responses_updated_at
  BEFORE UPDATE ON exam_responses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_results_updated_at
  BEFORE UPDATE ON exam_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_offline_queue_updated_at
  BEFORE UPDATE ON exam_offline_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- BLOQUE 9: NUEVOS CÓDIGOS DE ERROR
-- Extienden los 16 existentes sin romper nada.
-- ============================================================

INSERT INTO error_codes (code, module, error_type, severity, title, description, auto_recoverable, notify_admin) VALUES
  ('CBF-EXAM-PRE-001', 'EXAM', 'PRE', 'critical', 'Preflight fallido',              'Preflight falló el día del examen',                     false, true),
  ('CBF-EXAM-PRE-002', 'EXAM', 'PRE', 'warn',     'Preflight con advertencias',     'Preflight con advertencias — monitorear',                true,  true),
  ('CBF-EXAM-GEN-001', 'EXAM', 'GEN', 'error',    'Instancia no generada',          'Generación de instancia fallida',                       false, true),
  ('CBF-EXAM-GEN-002', 'EXAM', 'GEN', 'warn',     'Generación lenta',               'Generación de instancia lenta (>15s)',                   true,  false),
  ('CBF-EXAM-OFF-001', 'EXAM', 'OFF', 'info',     'Modo offline activo',            'Estudiante en modo offline — IndexedDB activo',          true,  false),
  ('CBF-EXAM-OFF-002', 'EXAM', 'OFF', 'warn',     'Sync offline fallida',           'Sync offline fallida — reintentando',                   true,  true),
  ('CBF-EXAM-OFF-003', 'EXAM', 'OFF', 'error',    'Sync offline agotada',           'Sync offline falló todos los intentos',                  false, true),
  ('CBF-EXAM-PDF-001', 'EXAM', 'PDF', 'error',    'PDFs pre-examen fallidos',       'Generación de PDFs pre-examen fallida',                  false, true),
  ('CBF-EXAM-RES-001', 'EXAM', 'RES', 'warn',     'Modo resiliente activo',         'Modo resiliente activado — IA diferida',                 true,  true),
  ('CBF-EXAM-RES-002', 'EXAM', 'RES', 'critical', 'Contingencia en examen en vivo', 'Contingencia activada durante examen en vivo',           false, true),
  ('CBF-EXAM-IMG-001', 'EXAM', 'IMG', 'warn',     'Foto de papel no procesada',     'Procesamiento de foto de papel fallido',                 false, false),
  ('CBF-EXAM-HB-001',  'EXAM', 'HB',  'warn',     'Estudiante sin heartbeat',       'Estudiante sin heartbeat >2 minutos',                   true,  false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- BLOQUE 10: VISTAS
-- ============================================================

-- Vista: estado en tiempo real de una sesión activa
CREATE OR REPLACE VIEW exam_session_live AS
SELECT
  s.id AS session_id,
  s.title,
  s.status,
  s.resilience_mode,
  s.contingency_active,
  s.contingency_type,
  s.total_students,
  s.students_opened,
  s.students_active,
  s.students_submitted,
  s.students_with_error,
  s.students_offline,
  s.preflight_status,
  s.active_delivery_mode,
  s.started_at,
  s.scheduled_at,
  s.duration_minutes,
  -- Tiempo restante en segundos
  CASE
    WHEN s.started_at IS NOT NULL AND s.duration_minutes > 0 THEN
      GREATEST(0, EXTRACT(EPOCH FROM (
        s.started_at + (s.duration_minutes || ' minutes')::INTERVAL - NOW()
      ))::INTEGER)
    ELSE NULL
  END AS seconds_remaining,
  -- Progreso de corrección
  (SELECT COUNT(*) FROM exam_responses r
   JOIN exam_instances i ON i.id = r.instance_id
   WHERE i.session_id = s.id AND r.ai_correction_status = 'completed') AS responses_corrected,
  (SELECT COUNT(*) FROM exam_responses r
   JOIN exam_instances i ON i.id = r.instance_id
   WHERE i.session_id = s.id) AS responses_total
FROM exam_sessions s;

-- Vista: resultados completos por sesión
CREATE OR REPLACE VIEW exam_results_dashboard AS
SELECT
  r.id,
  r.session_id,
  s.title AS session_title,
  s.grade,
  s.subject,
  r.student_name,
  r.student_code,
  r.total_points_earned,
  r.total_points_possible,
  r.percentage,
  r.colombian_grade,
  r.performance_level,
  r.pending_responses,
  r.correction_complete,
  r.grade_confirmed,
  r.teacher_final_grade,
  r.completion_mode,
  i.tab_switches,
  i.fullscreen_exits,
  i.time_spent_seconds,
  i.integrity_flags,
  i.delivery_mode,
  i.version_label,
  -- Flag de alto riesgo de integridad
  COALESCE((i.integrity_flags->>'high_risk')::BOOLEAN, false) AS high_risk,
  r.created_at,
  r.updated_at
FROM exam_results r
JOIN exam_sessions s  ON s.id = r.session_id
JOIN exam_instances i ON i.id = r.instance_id;

-- ============================================================
-- BLOQUE 11: ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_blueprints_school    ON exam_blueprints(school_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_teacher   ON exam_blueprints(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_school      ON exam_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status      ON exam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_access_code ON exam_sessions(access_code);
CREATE INDEX IF NOT EXISTS idx_instances_session    ON exam_instances(session_id);
CREATE INDEX IF NOT EXISTS idx_instances_student    ON exam_instances(student_code);
CREATE INDEX IF NOT EXISTS idx_instances_status     ON exam_instances(instance_status);
CREATE INDEX IF NOT EXISTS idx_responses_instance   ON exam_responses(instance_id);
CREATE INDEX IF NOT EXISTS idx_responses_ai_status  ON exam_responses(ai_correction_status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON exam_offline_queue(sync_status);
CREATE INDEX IF NOT EXISTS idx_preflight_session    ON exam_preflight_log(session_id);

-- ============================================================
-- BLOQUE 12: RLS
-- ============================================================

ALTER TABLE exam_blueprints    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_instances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_preflight_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_offline_queue ENABLE ROW LEVEL SECURITY;

-- Blueprints: docente ve y edita los suyos; admin ve todos del colegio
CREATE POLICY "blueprints_owner" ON exam_blueprints
  FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "blueprints_school" ON exam_blueprints
  FOR SELECT USING (school_id = get_my_school_id());

-- Sessions: docente ve las suyas; admin ve todas del colegio
CREATE POLICY "sessions_owner" ON exam_sessions
  FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "sessions_school" ON exam_sessions
  FOR SELECT USING (school_id = get_my_school_id());

-- Instances: docente ve las de sus sesiones
CREATE POLICY "instances_school" ON exam_instances
  FOR ALL USING (school_id = get_my_school_id());

-- Responses: docente ve las de su colegio
CREATE POLICY "responses_school" ON exam_responses
  FOR ALL USING (school_id = get_my_school_id());

-- Results: docente ve los de su colegio
CREATE POLICY "results_school" ON exam_results
  FOR ALL USING (school_id = get_my_school_id());

-- Preflight log: solo lectura para el colegio
CREATE POLICY "preflight_log_school" ON exam_preflight_log
  FOR SELECT USING (school_id = get_my_school_id());

-- Offline queue: acceso por colegio
CREATE POLICY "offline_queue_school" ON exam_offline_queue
  FOR ALL USING (school_id = get_my_school_id());

-- ============================================================
-- COMENTARIO FINAL
-- ============================================================
COMMENT ON TABLE exam_blueprints IS
'Intención pedagógica del docente. Un blueprint puede generar N sesiones.';
COMMENT ON TABLE exam_sessions IS
'Evento pedagógico en vivo. Una sesión = un examen con un grupo en un momento específico.';
COMMENT ON TABLE exam_instances IS
'Examen único por estudiante — generado por IA desde el blueprint. Inmutable post-generación.';
COMMENT ON TABLE exam_responses IS
'Respuestas polimórficas. response_origin garantiza trazabilidad sin importar el canal de entrega.';
COMMENT ON TABLE exam_results IS
'Resultado calculado automáticamente. human_score tiene precedencia garantizada por la BD (COALESCE).';
COMMENT ON TABLE exam_preflight_log IS
'Log forense INMUTABLE. Nunca borrar. Evidencia institucional completa de cada verificación pre-examen.';
COMMENT ON TABLE exam_offline_queue IS
'Cola de respuestas offline esperando sincronización. Se procesa automáticamente al recuperar conexión.';
