-- Migration: 20260426030000
-- Full schema catch-up for dev project.
-- Adds all tables and columns that exist in prod but were missing from dev
-- due to migrations that were marked applied without running their SQL.
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- On production this migration is a NO-OP — mark it applied via repair.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- PART 1: MISSING TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ── schedule_slots ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_slots (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id  uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  start_time time        NOT NULL,
  end_time   time        NOT NULL,
  level      text        CHECK (level IN ('elementary', 'middle', 'high')),
  color      text        NOT NULL DEFAULT '#F79646',
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_slots' AND policyname='School members can read schedule slots') THEN
    ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "School members can read schedule slots" ON schedule_slots
      FOR SELECT USING (school_id = get_my_school_id());
    CREATE POLICY "Admins can manage schedule slots" ON schedule_slots
      FOR ALL USING (
        school_id = get_my_school_id()
        AND (SELECT role FROM teachers WHERE id = auth.uid()) IN ('admin', 'superadmin', 'rector')
      );
  END IF;
END $$;

-- ── weekly_agendas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_agendas (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade       text        NOT NULL,
  section     text        NOT NULL,
  week_start  date        NOT NULL,
  period      smallint,
  devotional  text,
  notes       text,
  content     jsonb       NOT NULL DEFAULT '{"entries":[]}',
  status      text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','sent')),
  created_by  uuid        REFERENCES teachers(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, grade, section, week_start)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='weekly_agendas' AND policyname='School members can read agendas') THEN
    ALTER TABLE weekly_agendas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "School members can read agendas" ON weekly_agendas
      FOR SELECT USING (school_id = get_my_school_id());
    CREATE POLICY "Managers can write agendas" ON weekly_agendas
      FOR ALL USING (
        school_id = get_my_school_id()
        AND (SELECT role FROM teachers WHERE id = auth.uid()) IN ('admin', 'superadmin', 'rector')
      );
  END IF;
END $$;

-- ── message_rooms ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_rooms (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  type       text        NOT NULL DEFAULT 'group' CHECK (type IN ('group','direct')),
  created_by uuid        NOT NULL REFERENCES teachers(id),
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_rooms' AND policyname='rooms_school_all') THEN
    ALTER TABLE message_rooms ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "rooms_school_all" ON message_rooms
      FOR ALL USING (school_id = get_my_school_id())
      WITH CHECK (school_id = get_my_school_id() AND created_by = auth.uid());
  END IF;
END $$;

-- ── room_participants ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_participants (
  room_id    uuid NOT NULL REFERENCES message_rooms(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, teacher_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='room_participants' AND policyname='room_participants_school') THEN
    ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "room_participants_school" ON room_participants
      FOR ALL USING (
        EXISTS (SELECT 1 FROM message_rooms mr WHERE mr.id = room_participants.room_id AND mr.school_id = get_my_school_id())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM message_rooms mr WHERE mr.id = room_participants.room_id AND mr.school_id = get_my_school_id())
      );
  END IF;
END $$;

-- ── room_messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid        NOT NULL REFERENCES message_rooms(id) ON DELETE CASCADE,
  from_id    uuid        NOT NULL REFERENCES teachers(id),
  body       text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_messages_room_idx ON room_messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS room_participants_teacher_idx ON room_participants (teacher_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='room_messages' AND policyname='room_messages_school_read') THEN
    ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "room_messages_school_read" ON room_messages
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM message_rooms mr WHERE mr.id = room_messages.room_id AND mr.school_id = get_my_school_id())
      );
    CREATE POLICY "room_messages_school_insert" ON room_messages
      FOR INSERT WITH CHECK (
        from_id = auth.uid()
        AND EXISTS (SELECT 1 FROM message_rooms mr WHERE mr.id = room_messages.room_id AND mr.school_id = get_my_school_id())
      );
  END IF;
END $$;

-- ── question_criteria ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS question_criteria (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  question_id            uuid        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  model_answer           text,
  key_concepts           text[],
  rubric                 jsonb       NOT NULL DEFAULT '{}',
  bloom_level            text,
  rigor_level            text        NOT NULL DEFAULT 'flexible',
  ai_correction_context  text,
  ai_generated           boolean     NOT NULL DEFAULT false,
  teacher_approved       boolean     NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='question_criteria' AND policyname='question_criteria_school') THEN
    ALTER TABLE question_criteria ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "question_criteria_school" ON question_criteria
      FOR ALL USING (school_id = get_my_school_id());
  END IF;
END $$;

-- ── system_health_snapshots ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_health_snapshots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at       timestamptz NOT NULL DEFAULT now(),
  overall_status    text        NOT NULL DEFAULT 'healthy',
  sessions_active   integer     NOT NULL DEFAULT 0,
  exams_active      integer     NOT NULL DEFAULT 0,
  queue_pending     integer     NOT NULL DEFAULT 0,
  queue_processing  integer     NOT NULL DEFAULT 0,
  queue_failed      integer     NOT NULL DEFAULT 0,
  alerts_open       integer     NOT NULL DEFAULT 0,
  errors_warn       integer     NOT NULL DEFAULT 0,
  errors_error      integer     NOT NULL DEFAULT 0,
  errors_critical   integer     NOT NULL DEFAULT 0,
  ai_success_rate   numeric(5,2),
  ai_avg_duration_ms integer
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_health_snapshots' AND policyname='health_snapshots_admin') THEN
    ALTER TABLE system_health_snapshots ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "health_snapshots_admin" ON system_health_snapshots
      FOR ALL USING (
        (SELECT role FROM teachers WHERE id = auth.uid()) IN ('admin','superadmin','rector')
      );
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 2: MISSING COLUMNS IN EXISTING TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ── achievement_indicators ────────────────────────────────────────────────────
ALTER TABLE achievement_indicators
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE;

-- ── alert_rules ───────────────────────────────────────────────────────────────
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS active           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS description      text,
  ADD COLUMN IF NOT EXISTS error_code       text,
  ADD COLUMN IF NOT EXISTS module           text,
  ADD COLUMN IF NOT EXISTS notify_telegram  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS severity_min     text    NOT NULL DEFAULT 'error',
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS threshold_count  integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS threshold_minutes integer NOT NULL DEFAULT 60;

-- ── assessments ───────────────────────────────────────────────────────────────
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS ai_generated          boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_model_used         text,
  ADD COLUMN IF NOT EXISTS ai_prompt_used        text,
  ADD COLUMN IF NOT EXISTS anti_cheat_enabled    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at             timestamptz,
  ADD COLUMN IF NOT EXISTS copy_paste_blocked    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by            uuid        REFERENCES teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description           text,
  ADD COLUMN IF NOT EXISTS instructions          text,
  ADD COLUMN IF NOT EXISTS published_at          timestamptz,
  ADD COLUMN IF NOT EXISTS tab_switch_alert      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teacher_assignment_id uuid        REFERENCES teacher_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS telegram_chat_id      text,
  ADD COLUMN IF NOT EXISTS telegram_notify       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_limit_minutes    integer,
  ADD COLUMN IF NOT EXISTS total_points          numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS week                  integer,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz DEFAULT now();

-- ── checkpoints ───────────────────────────────────────────────────────────────
ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS achievement  text,
  ADD COLUMN IF NOT EXISTS indicator_id uuid REFERENCES achievement_indicators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS week_number  integer;

-- ── lesson_plans ──────────────────────────────────────────────────────────────
ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS date_end               date,
  ADD COLUMN IF NOT EXISTS date_range             text,
  ADD COLUMN IF NOT EXISTS date_start             date,
  ADD COLUMN IF NOT EXISTS eleot_coverage         jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS indicator_id           uuid  REFERENCES achievement_indicators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS monday_date            date,
  ADD COLUMN IF NOT EXISTS news_criteria_focus    jsonb,
  ADD COLUMN IF NOT EXISTS news_week_number       integer,
  ADD COLUMN IF NOT EXISTS section                text,
  ADD COLUMN IF NOT EXISTS session_agenda         jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS title                  text,
  ADD COLUMN IF NOT EXISTS week_number            integer;

-- ── messages ──────────────────────────────────────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS body    text,
  ADD COLUMN IF NOT EXISTS subject text;

-- ── notifications ─────────────────────────────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS from_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES lesson_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_id   uuid REFERENCES teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_role text;

-- ── questions ─────────────────────────────────────────────────────────────────
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS ai_generated          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assessment_version_id uuid    REFERENCES assessment_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS media_type            text,
  ADD COLUMN IF NOT EXISTS media_url             text,
  ADD COLUMN IF NOT EXISTS partial_credit        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS section               text,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz DEFAULT now();

-- ── school_calendar ───────────────────────────────────────────────────────────
ALTER TABLE school_calendar
  ADD COLUMN IF NOT EXISTS affects_sections  text[],
  ADD COLUMN IF NOT EXISTS created_by        uuid REFERENCES teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_type        text NOT NULL DEFAULT 'holiday',
  ADD COLUMN IF NOT EXISTS name              text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS no_class          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS type              text;

-- ── student_exam_sessions ─────────────────────────────────────────────────────
ALTER TABLE student_exam_sessions
  ADD COLUMN IF NOT EXISTS access_code_used    text,
  ADD COLUMN IF NOT EXISTS copy_attempt_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ip_address          text,
  ADD COLUMN IF NOT EXISTS security_events     jsonb   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS status              text    NOT NULL DEFAULT 'started',
  ADD COLUMN IF NOT EXISTS student_code        text,
  ADD COLUMN IF NOT EXISTS tab_switch_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telegram_notified   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_spent_seconds  integer,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_agent          text;

-- ── system_events ─────────────────────────────────────────────────────────────
ALTER TABLE system_events
  ADD COLUMN IF NOT EXISTS assessment_id    uuid,
  ADD COLUMN IF NOT EXISTS duration_ms      integer,
  ADD COLUMN IF NOT EXISTS environment      text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS error_code       text,
  ADD COLUMN IF NOT EXISTS function_name    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payload_in       jsonb,
  ADD COLUMN IF NOT EXISTS payload_out      jsonb,
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS resolved         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by      uuid,
  ADD COLUMN IF NOT EXISTS school_id        uuid,
  ADD COLUMN IF NOT EXISTS session_id       uuid,
  ADD COLUMN IF NOT EXISTS stack_trace      text,
  ADD COLUMN IF NOT EXISTS step             text,
  ADD COLUMN IF NOT EXISTS submission_id    uuid,
  ADD COLUMN IF NOT EXISTS user_id          uuid;

-- ── document_feedback ─────────────────────────────────────────────────────────
ALTER TABLE document_feedback
  ADD COLUMN IF NOT EXISTS entity_id    uuid,
  ADD COLUMN IF NOT EXISTS entity_title text,
  ADD COLUMN IF NOT EXISTS entity_type  text;

-- ── rubric_templates ──────────────────────────────────────────────────────────
ALTER TABLE rubric_templates
  ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS skill      text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── teacher_assignments ───────────────────────────────────────────────────────
ALTER TABLE teacher_assignments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── school_monthly_principles ────────────────────────────────────────────────
ALTER TABLE school_monthly_principles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES teachers(id) ON DELETE SET NULL;

-- ── exam_responses ────────────────────────────────────────────────────────────
ALTER TABLE exam_responses
  ADD COLUMN IF NOT EXISTS requires_human_review boolean NOT NULL DEFAULT false;

-- ── exam_results ─────────────────────────────────────────────────────────────
ALTER TABLE exam_results
  ADD COLUMN IF NOT EXISTS correction_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS max_score         numeric(6,2),
  ADD COLUMN IF NOT EXISTS total_score       numeric(6,2);

-- ── activity_log ─────────────────────────────────────────────────────────────
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS changes    jsonb,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS user_id    uuid;

-- ── ai_usage ─────────────────────────────────────────────────────────────────
ALTER TABLE ai_usage
  ADD COLUMN IF NOT EXISTS type text;

-- ── error_codes ───────────────────────────────────────────────────────────────
ALTER TABLE error_codes
  ADD COLUMN IF NOT EXISTS probable_causes   text,
  ADD COLUMN IF NOT EXISTS resolution_steps  text;

-- ── error_log ────────────────────────────────────────────────────────────────
ALTER TABLE error_log
  ADD COLUMN IF NOT EXISTS component       text,
  ADD COLUMN IF NOT EXISTS error_code      text,
  ADD COLUMN IF NOT EXISTS error_message   text,
  ADD COLUMN IF NOT EXISTS error_stack     text,
  ADD COLUMN IF NOT EXISTS metadata        jsonb,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS resolved        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by     uuid,
  ADD COLUMN IF NOT EXISTS severity        text,
  ADD COLUMN IF NOT EXISTS user_id         uuid;

-- ── assessment_versions ───────────────────────────────────────────────────────
ALTER TABLE assessment_versions
  ADD COLUMN IF NOT EXISTS player_html text,
  ADD COLUMN IF NOT EXISTS player_url  text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

-- ── assessment_results ────────────────────────────────────────────────────────
ALTER TABLE assessment_results
  ADD COLUMN IF NOT EXISTS ai_corrected_score   numeric(6,2),
  ADD COLUMN IF NOT EXISTS auto_corrected_score numeric(6,2),
  ADD COLUMN IF NOT EXISTS calculated_at        timestamptz,
  ADD COLUMN IF NOT EXISTS final_grade          numeric(3,1),
  ADD COLUMN IF NOT EXISTS integrity_flag       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS integrity_notes      text,
  ADD COLUMN IF NOT EXISTS percentage           numeric(5,2),
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz DEFAULT now();

-- ── system_alerts ────────────────────────────────────────────────────────────
ALTER TABLE system_alerts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── lesson_plans admin/rector RLS ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lesson_plans' AND policyname='lesson_plans_admin_school') THEN
    CREATE POLICY "lesson_plans_admin_school" ON lesson_plans
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM teachers actor
          WHERE actor.id = auth.uid()
            AND actor.role IN ('admin', 'superadmin', 'rector')
            AND actor.school_id = (SELECT owner.school_id FROM teachers owner WHERE owner.id = lesson_plans.teacher_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM teachers actor
          WHERE actor.id = auth.uid()
            AND actor.role IN ('admin', 'superadmin', 'rector')
            AND actor.school_id = (SELECT owner.school_id FROM teachers owner WHERE owner.id = lesson_plans.teacher_id)
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
