-- Migration: 20260426011734
-- Assets IA generados + sistema de evaluaciones + cola + overrides humanos + alertas
-- Nota: Reconstruida desde gen types (archivo original aplicado directo a prod)

-- Assets generados por IA (imágenes, slides, timelines)
CREATE TABLE IF NOT EXISTS generated_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  lesson_plan_id uuid REFERENCES lesson_plans(id) ON DELETE SET NULL,
  witness_event_id uuid,
  asset_type text NOT NULL,
  title text,
  content text,
  storage_path text,
  public_url text,
  timeline_json jsonb,
  metadata jsonb,
  used_in_canvas boolean DEFAULT false,
  used_in_slide boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generated_assets_school" ON generated_assets FOR ALL
  USING (school_id = get_my_school_id());

-- Eventos de testigo IA (cada llamada al modelo en clase)
CREATE TABLE IF NOT EXISTS ai_witness_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  session_id uuid REFERENCES classroom_sessions(id) ON DELETE SET NULL,
  request_type text NOT NULL,
  prompt text NOT NULL,
  response_text text,
  generated_url text,
  generation_model text,
  grade text,
  subject text,
  current_topic text,
  current_moment text,
  canvas_mode text,
  canvas_snapshot text,
  inserted_to_canvas boolean DEFAULT false,
  input_tokens int,
  output_tokens int,
  duration_ms int,
  cost_usd numeric(10,6),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_witness_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_witness_events_school" ON ai_witness_events FOR ALL
  USING (school_id = get_my_school_id());

-- Respuestas de estudiantes a evaluaciones (sistema antiguo de assessments)
CREATE TABLE IF NOT EXISTS submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES student_exam_sessions(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer jsonb NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  auto_correct boolean,
  auto_score numeric(5,2),
  time_spent_seconds int
);
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions_school" ON submissions FOR ALL
  USING (school_id = get_my_school_id());

-- Evaluaciones IA de respuestas
CREATE TABLE IF NOT EXISTS ai_evaluations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  score_awarded numeric(5,2) NOT NULL,
  max_score numeric(5,2) NOT NULL,
  percentage numeric(5,2),
  confidence numeric(4,3),
  feedback text,
  reasoning text,
  detected_concepts text[],
  missing_concepts text[],
  requires_review boolean DEFAULT false,
  is_active boolean DEFAULT true,
  ai_model text,
  ai_version text,
  evaluated_at timestamptz DEFAULT now()
);
ALTER TABLE ai_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_evaluations_school" ON ai_evaluations FOR ALL
  USING (school_id = get_my_school_id());

-- Cola de corrección IA (assessments)
CREATE TABLE IF NOT EXISTS ai_evaluation_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  priority int DEFAULT 5,
  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  last_error text,
  queued_at timestamptz DEFAULT now(),
  processing_started_at timestamptz,
  processed_at timestamptz
);
ALTER TABLE ai_evaluation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_evaluation_queue_school" ON ai_evaluation_queue FOR ALL
  USING (school_id = get_my_school_id());

-- Overrides humanos sobre evaluaciones IA
CREATE TABLE IF NOT EXISTS human_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  ai_evaluation_id uuid NOT NULL REFERENCES ai_evaluations(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  overridden_by uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  original_score numeric(5,2) NOT NULL,
  adjusted_score numeric(5,2) NOT NULL,
  reason text,
  status text DEFAULT 'applied',
  overridden_at timestamptz DEFAULT now(),
  auto_confirmed_at timestamptz
);
ALTER TABLE human_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "human_overrides_school" ON human_overrides FOR ALL
  USING (school_id = get_my_school_id());

-- Alertas del sistema CBF (generadas por reglas de observabilidad)
CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  error_code text REFERENCES error_codes(code) ON DELETE SET NULL,
  trigger_event_id uuid REFERENCES system_events(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  severity text NOT NULL,
  module text,
  status text DEFAULT 'open',
  event_count int DEFAULT 1,
  telegram_sent boolean DEFAULT false,
  telegram_sent_at timestamptz,
  acknowledged_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_alerts_school" ON system_alerts FOR ALL
  USING (school_id = get_my_school_id());
CREATE POLICY "system_alerts_global" ON system_alerts FOR SELECT
  USING (school_id IS NULL);
