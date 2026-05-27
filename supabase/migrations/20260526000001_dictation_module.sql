-- ══════════════════════════════════════════════════════════════════════════════
-- DICTATION MODULE — Módulo de dictados integrado al CBF Planner
-- Fecha: 2026-05-26
-- Tablas: dictation_blueprints, dictation_sessions, dictation_instances,
--         dictation_responses, dictation_results
-- RPC:    get_dictation_instance_safe (strip correct_answer)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. dictation_blueprints ─────────────────────────────────────────────────
-- Template del dictation creado por el docente. Contiene vocabulario,
-- secciones generadas por IA, y URLs de audio generados por TTS.

CREATE TABLE IF NOT EXISTS dictation_blueprints (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id       uuid NOT NULL REFERENCES schools(id),
  teacher_id      uuid NOT NULL REFERENCES teachers(id),
  title           text NOT NULL,
  subject         text NOT NULL,
  grade           text NOT NULL CHECK (grade LIKE '%.° %'),
  section         text NOT NULL,
  unit_reference  text,
  difficulty      text NOT NULL DEFAULT 'Intermedio'
                    CHECK (difficulty IN ('Basico', 'Intermedio', 'Avanzado')),
  vocabulary      jsonb NOT NULL DEFAULT '[]'::jsonb,
  voice_config    jsonb NOT NULL DEFAULT '{}'::jsonb,
  sections        jsonb,
  audio_urls      jsonb DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'ready', 'archived')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_dictation_blueprints_teacher ON dictation_blueprints(teacher_id);
CREATE INDEX idx_dictation_blueprints_school  ON dictation_blueprints(school_id);

ALTER TABLE dictation_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dictation_blueprints_owner" ON dictation_blueprints
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "dictation_blueprints_school_read" ON dictation_blueprints
  FOR SELECT USING (school_id = get_my_school_id());


-- ── 2. dictation_sessions ───────────────────────────────────────────────────
-- Sesión activa de un dictation. Un blueprint puede tener múltiples sesiones.

CREATE TABLE IF NOT EXISTS dictation_sessions (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blueprint_id      uuid NOT NULL REFERENCES dictation_blueprints(id) ON DELETE CASCADE,
  teacher_id        uuid NOT NULL REFERENCES teachers(id),
  school_id         uuid NOT NULL REFERENCES schools(id),
  title             text,
  access_code       text UNIQUE,
  duration_minutes  int NOT NULL DEFAULT 30,
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'ready', 'active', 'closed')),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_dictation_sessions_blueprint ON dictation_sessions(blueprint_id);
CREATE INDEX idx_dictation_sessions_school    ON dictation_sessions(school_id);
CREATE INDEX idx_dictation_sessions_code      ON dictation_sessions(access_code);

ALTER TABLE dictation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dictation_sessions_owner" ON dictation_sessions
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "dictation_sessions_school_read" ON dictation_sessions
  FOR SELECT USING (school_id = get_my_school_id());

-- Anon puede leer sesiones activas por access_code (estudiantes sin login)
CREATE POLICY "dictation_sessions_anon_read" ON dictation_sessions
  FOR SELECT TO anon
  USING (status IN ('ready', 'active'));


-- ── 3. dictation_instances ──────────────────────────────────────────────────
-- Una instancia por estudiante por sesión. Contiene las preguntas generadas
-- y el estado de progreso del estudiante.

CREATE TABLE IF NOT EXISTS dictation_instances (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          uuid NOT NULL REFERENCES dictation_sessions(id) ON DELETE CASCADE,
  student_id          uuid REFERENCES school_students(id),
  student_email       text,
  student_name        text,
  student_section     text,
  student_code        text,
  access_code         text NOT NULL UNIQUE,
  generated_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  instance_status     text NOT NULL DEFAULT 'ready'
                        CHECK (instance_status IN ('ready', 'started', 'submitted')),
  started_at          timestamptz,
  submitted_at        timestamptz,
  time_spent_seconds  int,
  tab_switches        int DEFAULT 0,
  integrity_flags     jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_dictation_instances_session ON dictation_instances(session_id);
CREATE INDEX idx_dictation_instances_code    ON dictation_instances(access_code);
CREATE INDEX idx_dictation_instances_student ON dictation_instances(student_id);

ALTER TABLE dictation_instances ENABLE ROW LEVEL SECURITY;

-- Docente autenticado ve instancias de sus sesiones
CREATE POLICY "dictation_instances_teacher_read" ON dictation_instances
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM dictation_sessions WHERE teacher_id = auth.uid()
    )
  );

-- Docente autenticado puede insertar instancias en sus sesiones
CREATE POLICY "dictation_instances_teacher_insert" ON dictation_instances
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM dictation_sessions WHERE teacher_id = auth.uid()
    )
  );

-- Anon puede leer/actualizar su instancia (por access_code, filtrado en RPC)
CREATE POLICY "dictation_instances_anon_select" ON dictation_instances
  FOR SELECT TO anon USING (true);

CREATE POLICY "dictation_instances_anon_update" ON dictation_instances
  FOR UPDATE TO anon USING (true)
  WITH CHECK (true);


-- ── 4. dictation_responses ──────────────────────────────────────────────────
-- Respuesta individual por pregunta.

CREATE TABLE IF NOT EXISTS dictation_responses (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id     uuid NOT NULL REFERENCES dictation_instances(id) ON DELETE CASCADE,
  question_index  int NOT NULL,
  question_type   text NOT NULL
                    CHECK (question_type IN ('listen_type', 'listen_identify', 'fill_blank')),
  answer          text,
  correct_answer  text NOT NULL,
  is_correct      bool,
  score           numeric NOT NULL DEFAULT 0,
  max_score       numeric NOT NULL DEFAULT 1,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_dictation_responses_instance ON dictation_responses(instance_id);

ALTER TABLE dictation_responses ENABLE ROW LEVEL SECURITY;

-- Docente autenticado ve respuestas de sus sesiones
CREATE POLICY "dictation_responses_teacher_read" ON dictation_responses
  FOR SELECT TO authenticated
  USING (
    instance_id IN (
      SELECT di.id FROM dictation_instances di
      JOIN dictation_sessions ds ON ds.id = di.session_id
      WHERE ds.teacher_id = auth.uid()
    )
  );

-- Anon puede insertar respuestas (el estudiante envía al hacer submit)
CREATE POLICY "dictation_responses_anon_insert" ON dictation_responses
  FOR INSERT TO anon WITH CHECK (true);

-- Anon puede leer sus propias respuestas (para mostrar resultados)
CREATE POLICY "dictation_responses_anon_select" ON dictation_responses
  FOR SELECT TO anon USING (true);


-- ── 5. dictation_results ────────────────────────────────────────────────────
-- Resultado final por instancia.

CREATE TABLE IF NOT EXISTS dictation_results (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id     uuid NOT NULL UNIQUE REFERENCES dictation_instances(id) ON DELETE CASCADE,
  total_score     numeric NOT NULL,
  max_score       numeric NOT NULL,
  colombian_grade numeric,
  grade_level     text,
  section_scores  jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_dictation_results_instance ON dictation_results(instance_id);

ALTER TABLE dictation_results ENABLE ROW LEVEL SECURITY;

-- Docente autenticado ve resultados de sus sesiones
CREATE POLICY "dictation_results_teacher_read" ON dictation_results
  FOR SELECT TO authenticated
  USING (
    instance_id IN (
      SELECT di.id FROM dictation_instances di
      JOIN dictation_sessions ds ON ds.id = di.session_id
      WHERE ds.teacher_id = auth.uid()
    )
  );

-- Anon puede insertar resultados (corrector) y leer (mostrar al estudiante)
CREATE POLICY "dictation_results_anon_insert" ON dictation_results
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "dictation_results_anon_select" ON dictation_results
  FOR SELECT TO anon USING (true);

-- Service role puede upsert (dictation-corrector Edge Function)
CREATE POLICY "dictation_results_service_all" ON dictation_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── 6. RPC: get_dictation_instance_safe ─────────────────────────────────────
-- Devuelve la instancia del estudiante SIN correct_answer en las preguntas.
-- Patrón idéntico a get_exam_instance_safe.

CREATE OR REPLACE FUNCTION get_dictation_instance_safe(
  p_access_code text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id',                  di.id,
    'session_id',          di.session_id,
    'student_name',        di.student_name,
    'student_section',     di.student_section,
    'student_code',        di.student_code,
    'instance_status',     di.instance_status,
    'started_at',          di.started_at,
    'generated_questions', (
      SELECT COALESCE(jsonb_agg(q - 'correct_answer'), '[]'::jsonb)
      FROM jsonb_array_elements(di.generated_questions) AS q
    ),
    'session', (
      SELECT jsonb_build_object(
        'id',               ds.id,
        'title',            ds.title,
        'duration_minutes', ds.duration_minutes,
        'status',           ds.status,
        'teacher_id',       ds.teacher_id,
        'blueprint_id',     ds.blueprint_id
      )
      FROM dictation_sessions ds
      WHERE ds.id = di.session_id
    ),
    'blueprint', (
      SELECT jsonb_build_object(
        'title',          db.title,
        'subject',        db.subject,
        'grade',          db.grade,
        'section',        db.section,
        'difficulty',     db.difficulty,
        'audio_urls',     db.audio_urls,
        'voice_config',   db.voice_config
      )
      FROM dictation_blueprints db
      JOIN dictation_sessions ds2 ON ds2.blueprint_id = db.id
      WHERE ds2.id = di.session_id
    )
  )
  FROM dictation_instances di
  WHERE di.access_code = p_access_code
    AND di.instance_status IN ('ready', 'started')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_dictation_instance_safe(text) TO anon;
GRANT EXECUTE ON FUNCTION get_dictation_instance_safe(text) TO authenticated;


-- ── 7. Trigger: updated_at automático para blueprints ───────────────────────

CREATE OR REPLACE FUNCTION update_dictation_blueprints_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dictation_blueprints_updated_at
  BEFORE UPDATE ON dictation_blueprints
  FOR EACH ROW
  EXECUTE FUNCTION update_dictation_blueprints_updated_at();


-- ══════════════════════════════════════════════════════════════════════════════
-- NOTA: El bucket de Storage 'dictation-audio' debe crearse manualmente
-- desde el dashboard de Supabase o via CLI:
--   INSERT INTO storage.buckets (id, name, public) VALUES ('dictation-audio', 'dictation-audio', true);
-- ══════════════════════════════════════════════════════════════════════════════
