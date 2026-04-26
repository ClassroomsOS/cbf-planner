-- ══════════════════════════════════════════════════════════════════════════════
-- SCHEMA BASE — CBF Planner / ETA Platform
-- Tablas fundacionales creadas en producción vía SQL Editor (sin CLI).
-- Este archivo permite replicar el schema en proyectos nuevos (dev/staging).
-- Orden crítico: schools → teachers → get_my_school_id() → resto
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ── schools (sin políticas RLS que usen get_my_school_id aún) ─────────────────
CREATE TABLE IF NOT EXISTS schools (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name              text NOT NULL,
  short_name        text,
  dane              text,
  resolution        text,
  document_code     text,
  doc_version       text,
  process_name      text,
  logo_url          text,
  features          jsonb DEFAULT '{}',
  year_verse        text,
  year_verse_ref    text,
  year_theme        text,
  city              text,
  country           text,
  timezone          text,
  theme_color       text,
  sections          text[],
  network_code      text,
  network_role      text,
  parent_school_id  uuid REFERENCES schools(id) ON DELETE SET NULL,
  role_permissions  jsonb,
  active            boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- ── teachers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id             uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name             text NOT NULL,
  email                 text,
  role                  text DEFAULT 'teacher'
    CHECK (role IN ('teacher','admin','superadmin','director','psicopedagoga','rector')),
  status                text DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  initials              text,
  display_name          text,
  level                 text CHECK (level IN ('elementary','middle','high')),
  default_class         text,
  default_subject       text,
  default_period        text,
  grade_levels          text[],
  subjects              text[],
  my_classes            text[],
  class_subjects        jsonb,
  homeroom_grade        text,
  homeroom_section      text,
  coteacher_grade       text,
  coteacher_section     text,
  director_class        text,
  director_absent_until date,
  telegram_chat_id      text,
  ai_monthly_limit      int NOT NULL DEFAULT 0,
  school_levels         jsonb,
  roles                 jsonb,
  active                boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- ── get_my_school_id() — requiere teachers ────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT school_id FROM teachers WHERE id = auth.uid() LIMIT 1;
$$;

-- ── RLS policies que usan get_my_school_id() ──────────────────────────────────
CREATE POLICY "schools_read_own" ON schools FOR SELECT
  USING (id = get_my_school_id());
CREATE POLICY "schools_update_admin" ON schools FOR UPDATE
  USING (id = get_my_school_id()
    AND (SELECT role FROM teachers WHERE id = auth.uid())
        IN ('admin','superadmin','rector'));

CREATE POLICY "teachers_read_school" ON teachers FOR SELECT
  USING (school_id = get_my_school_id());
CREATE POLICY "teachers_update_own" ON teachers FOR UPDATE
  USING (id = auth.uid());

-- ── teacher_assignments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id  uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade       text NOT NULL,
  section     text NOT NULL,
  subject     text NOT NULL,
  schedule    jsonb DEFAULT '{}',
  classroom   text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments_own" ON teacher_assignments FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "assignments_read_school" ON teacher_assignments FOR SELECT
  USING (school_id = get_my_school_id());
CREATE POLICY "assignments_manage_admin" ON teacher_assignments FOR ALL
  USING (school_id = get_my_school_id()
    AND (SELECT role FROM teachers WHERE id = auth.uid())
        IN ('admin','superadmin','rector'));

-- ── learning_targets (LEGACY — se elimina en 20260408) ────────────────────────
CREATE TABLE IF NOT EXISTS learning_targets (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id     uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id      uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade          text NOT NULL,
  subject        text NOT NULL,
  period         int,
  academic_year  text,
  description    text,
  taxonomy       text CHECK (taxonomy IN ('recognize','apply','produce')),
  indicadores    jsonb DEFAULT '[]',
  tematica_names jsonb DEFAULT '[]',
  news_model     text DEFAULT 'standard',
  trimestre      smallint CHECK (trimestre IN (1,2,3)),
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE learning_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learning_targets_own" ON learning_targets FOR ALL
  USING (teacher_id = auth.uid());

-- ── news (será renombrada a news_legacy en 20260407) ──────────────────────────
CREATE TABLE IF NOT EXISTS news (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id  uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title       text,
  content     jsonb DEFAULT '{}',
  status      text DEFAULT 'draft',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_own" ON news FOR ALL USING (teacher_id = auth.uid());

-- ── news_projects ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_projects (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id               uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id                uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade                    text NOT NULL,
  section                  text,
  subject                  text NOT NULL,
  period                   int,
  academic_year            text,
  title                    text,
  description              text,
  conditions               text,
  due_date                 date,
  status                   text DEFAULT 'draft',
  target_id                uuid REFERENCES learning_targets(id) ON DELETE SET NULL,
  target_indicador         text,
  rubric_criteria          jsonb,
  rubric_template_id       uuid,
  skill                    text,
  news_model               text DEFAULT 'standard',
  competencias             jsonb DEFAULT '[]',
  operadores_intelectuales jsonb DEFAULT '[]',
  habilidades              jsonb DEFAULT '[]',
  actividades_evaluativas  jsonb DEFAULT '[]',
  biblical_principle       text,
  indicator_verse_ref      text,
  biblical_reflection      text,
  textbook_reference       jsonb,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
ALTER TABLE news_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_projects_own" ON news_projects FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "news_projects_read_school" ON news_projects FOR SELECT
  USING (school_id = get_my_school_id());

-- ── lesson_plans ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_plans (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id                uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id                 uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade                     text NOT NULL,
  subject                   text NOT NULL,
  week                      text,
  period                    int,
  academic_year             text,
  content                   jsonb DEFAULT '{}',
  status                    text DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','rejected','published')),
  news_project_id           uuid REFERENCES news_projects(id) ON DELETE SET NULL,
  target_id                 uuid REFERENCES learning_targets(id) ON DELETE SET NULL,
  week_count                int DEFAULT 1,
  locked                    boolean DEFAULT false,
  weekly_label              text,
  weekly_biblical_principle text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_plans_own" ON lesson_plans FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "lesson_plans_read_admin" ON lesson_plans FOR SELECT
  USING (school_id = get_my_school_id()
    AND (SELECT role FROM teachers WHERE id = auth.uid())
        IN ('admin','superadmin','rector'));

-- ── checkpoints ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkpoints (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id  uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id     uuid REFERENCES lesson_plans(id) ON DELETE SET NULL,
  target_id   uuid REFERENCES learning_targets(id) ON DELETE SET NULL,
  week        text,
  period      int,
  grade       text,
  subject     text,
  notes       text,
  evaluated   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkpoints_own" ON checkpoints FOR ALL
  USING (teacher_id = auth.uid());

-- ── rubric_templates ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rubric_templates (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  skill_area  text,
  criteria    jsonb DEFAULT '[]',
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE rubric_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rubric_templates_school" ON rubric_templates FOR ALL
  USING (school_id = get_my_school_id());

-- ── school_monthly_principles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_monthly_principles (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id           uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  year                int NOT NULL,
  month               int NOT NULL CHECK (month BETWEEN 1 AND 12),
  month_verse         text,
  month_verse_ref     text,
  indicator_principle text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (school_id, year, month)
);
ALTER TABLE school_monthly_principles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "principles_school" ON school_monthly_principles FOR ALL
  USING (school_id = get_my_school_id());

-- ── school_calendar ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_calendar (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id        uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date             date NOT NULL,
  label            text,
  is_school_day    boolean DEFAULT true,
  level            text,
  affects_planning boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (school_id, date)
);
ALTER TABLE school_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_school" ON school_calendar FOR ALL
  USING (school_id = get_my_school_id());

-- ── messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  from_id     uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  to_id       uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  content     text NOT NULL,
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_own" ON messages FOR ALL
  USING (from_id = auth.uid() OR to_id = auth.uid());

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id  uuid REFERENCES teachers(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text,
  type        text DEFAULT 'info',
  read        boolean DEFAULT false,
  data        jsonb,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications FOR ALL
  USING (teacher_id = auth.uid() OR school_id = get_my_school_id());

-- ── document_feedback ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_feedback (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   uuid REFERENCES schools(id) ON DELETE CASCADE,
  plan_id     uuid REFERENCES lesson_plans(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES teachers(id) ON DELETE SET NULL,
  body        text NOT NULL,
  type        text DEFAULT 'comment',
  resolved    boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE document_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_feedback_school" ON document_feedback FOR ALL
  USING (school_id = get_my_school_id());

-- ── correction_requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS correction_requests (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id     uuid REFERENCES schools(id) ON DELETE CASCADE,
  plan_id       uuid REFERENCES lesson_plans(id) ON DELETE CASCADE,
  requester_id  uuid REFERENCES teachers(id) ON DELETE SET NULL,
  reviewer_id   uuid REFERENCES teachers(id) ON DELETE SET NULL,
  reason        text,
  status        text DEFAULT 'pending',
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "correction_requests_school" ON correction_requests FOR ALL
  USING (school_id = get_my_school_id());

-- ── error_log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   uuid REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id  uuid REFERENCES teachers(id) ON DELETE SET NULL,
  page        text,
  action      text,
  entity_id   text,
  message     text,
  stack       text,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_log_own" ON error_log FOR ALL
  USING (teacher_id = auth.uid());

-- ── activity_log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id    uuid REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id   uuid REFERENCES teachers(id) ON DELETE SET NULL,
  action       text,
  entity_type  text,
  entity_id    text,
  description  text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_log_own" ON activity_log FOR ALL
  USING (teacher_id = auth.uid());

-- ── ai_usage ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  input_tokens  int DEFAULT 0,
  output_tokens int DEFAULT 0,
  cost_usd      numeric(10,6) DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_school" ON ai_usage FOR ALL
  USING (school_id = get_my_school_id());

-- ── assessments ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id      uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id       uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title           text NOT NULL,
  grade           text NOT NULL,
  subject         text NOT NULL,
  period          int,
  academic_year   text,
  access_code     text UNIQUE,
  status          text DEFAULT 'draft',
  rubric_criteria jsonb DEFAULT '[]',
  biblical_min    int DEFAULT 1,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessments_own" ON assessments FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "assessments_read_school" ON assessments FOR SELECT
  USING (school_id = get_my_school_id());

-- ── questions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id  uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  school_id      uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  question_type  text NOT NULL,
  stem           text NOT NULL,
  options        jsonb,
  correct_answer text,
  points         numeric(5,2) DEFAULT 1,
  position       int DEFAULT 0,
  rigor_level    text DEFAULT 'flexible'
    CHECK (rigor_level IN ('strict','flexible','conceptual')),
  section_name   text DEFAULT '',
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_school" ON questions FOR ALL
  USING (school_id = get_my_school_id());

-- ── assessment_versions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_versions (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id     uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  version_number    int NOT NULL DEFAULT 1,
  version_label     text DEFAULT 'A',
  is_base           boolean DEFAULT false,
  shuffle_questions boolean DEFAULT true,
  shuffle_options   boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE assessment_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessment_versions_school" ON assessment_versions FOR ALL
  USING (school_id = get_my_school_id());

-- ── student_exam_sessions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_exam_sessions (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id             uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assessment_id         uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  assessment_version_id uuid REFERENCES assessment_versions(id) ON DELETE SET NULL,
  student_email         text NOT NULL,
  student_name          text,
  access_code           text,
  started_at            timestamptz DEFAULT now(),
  submitted_at          timestamptz,
  total_score           numeric(5,2),
  integrity_flags       jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now()
);
ALTER TABLE student_exam_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_exam_sessions_school" ON student_exam_sessions FOR ALL
  USING (school_id = get_my_school_id());
CREATE POLICY "student_exam_sessions_anon_insert" ON student_exam_sessions
  FOR INSERT WITH CHECK (true);

-- ── assessment_results ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_results (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id       uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL REFERENCES student_exam_sessions(id) ON DELETE CASCADE,
  assessment_id   uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  colombian_grade numeric(3,1),
  total_score     numeric(6,2),
  max_score       numeric(6,2),
  status          text DEFAULT 'complete',
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assessment_results_school" ON assessment_results FOR ALL
  USING (school_id = get_my_school_id());

-- ── error_codes (observability) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_codes (
  code        text PRIMARY KEY,
  module      text NOT NULL,
  description text,
  severity    text DEFAULT 'error',
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE error_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_codes_read_all" ON error_codes FOR SELECT USING (true);
