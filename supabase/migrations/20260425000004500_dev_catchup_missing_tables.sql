-- Migration: 20260425000004500
-- Catch-up for dev project: creates tables that were skipped due to dependency
-- ordering issues when splitting the original 20260407 monolithic migration.
-- On production these tables already exist — this migration is NO-OP there.
-- All statements use IF NOT EXISTS / IF NOT EXISTS to be idempotent.

-- ── syllabus_topics ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syllabus_topics (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject       TEXT        NOT NULL,
  grade         TEXT        NOT NULL,
  period        INTEGER     NOT NULL CHECK (period BETWEEN 1 AND 4),
  academic_year INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  week_number   INTEGER     CHECK (week_number BETWEEN 1 AND 20),
  topic         TEXT        NOT NULL,
  content_type  TEXT        NOT NULL DEFAULT 'concept'
                            CHECK (content_type IN
                              ('grammar','vocabulary','skill','value','concept','other')),
  description   TEXT,
  resources     JSONB       NOT NULL DEFAULT '[]',
  indicator_id  UUID        REFERENCES achievement_indicators(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='syllabus_topics' AND policyname='syllabus_owner') THEN
    ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "syllabus_owner" ON syllabus_topics FOR ALL USING (teacher_id = auth.uid());
    CREATE POLICY "syllabus_school_read" ON syllabus_topics FOR SELECT USING (school_id = get_my_school_id());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_syllabus_teacher_period_week
  ON syllabus_topics (teacher_id, subject, grade, period, week_number);

-- ── lesson_plan_versions (with storage_path already included) ─────────────────
CREATE TABLE IF NOT EXISTS lesson_plan_versions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid        NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  school_id   uuid        NOT NULL REFERENCES schools(id),
  version     integer     NOT NULL,
  status      text        NOT NULL,
  content     jsonb       NOT NULL,
  storage_path text,
  note        text,
  archived_by uuid        NOT NULL REFERENCES teachers(id),
  archived_at timestamptz DEFAULT now(),
  UNIQUE (plan_id, version)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lesson_plan_versions' AND policyname='versions_school_read') THEN
    ALTER TABLE lesson_plan_versions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "versions_school_read" ON lesson_plan_versions FOR SELECT USING (school_id = get_my_school_id());
    CREATE POLICY "versions_admin_insert" ON lesson_plan_versions
      FOR INSERT WITH CHECK (
        school_id = get_my_school_id()
        AND EXISTS (SELECT 1 FROM teachers WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'rector'))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lpv_plan_version_idx ON lesson_plan_versions (plan_id, version DESC);

-- ── lesson_plans extra columns ────────────────────────────────────────────────
ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS syllabus_topic_id UUID REFERENCES syllabus_topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- ── lesson_plans.status (if missing) ─────────────────────────────────────────
ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- ── news_projects extra columns ──────────────────────────────────────────────
ALTER TABLE news_projects
  ADD COLUMN IF NOT EXISTS indicator_id UUID REFERENCES achievement_indicators(id) ON DELETE SET NULL;

-- ── eleot_observations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eleot_observations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES schools(id),
  observer_id           uuid NOT NULL REFERENCES teachers(id),
  observed_teacher_id   uuid NOT NULL REFERENCES teachers(id),
  date                  date NOT NULL,
  grade                 text,
  subject               text,
  domain                char(1) NOT NULL CHECK (domain IN ('A','B','C','D','E','F','G')),
  item                  varchar(3) NOT NULL,
  level                 smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eleot_obs_school_idx   ON eleot_observations (school_id);
CREATE INDEX IF NOT EXISTS eleot_obs_teacher_idx  ON eleot_observations (observed_teacher_id);
CREATE INDEX IF NOT EXISTS eleot_obs_date_idx     ON eleot_observations (date DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eleot_observations' AND policyname='eleot_obs_school') THEN
    ALTER TABLE eleot_observations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "eleot_obs_school" ON eleot_observations FOR ALL USING (school_id = get_my_school_id());
  END IF;
END $$;
