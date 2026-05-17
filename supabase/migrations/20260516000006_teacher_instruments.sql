-- Teacher Instruments: AI-generated session scripts linked to lesson plans
CREATE TABLE IF NOT EXISTS teacher_instruments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES lesson_plans(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  school_id uuid REFERENCES schools(id) NOT NULL,
  group_state text NOT NULL CHECK (group_state IN ('present','scattered','down','electric','anxious')),
  ims_index int NOT NULL CHECK (ims_index BETWEEN 0 AND 3),
  day_key text, -- ISO date (YYYY-MM-DD) for which day this instrument applies
  subject text,
  skill text,
  verse text,
  verse_ref text,
  objective text,
  generated_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_instruments_plan ON teacher_instruments(plan_id);
CREATE INDEX idx_instruments_teacher ON teacher_instruments(teacher_id);

-- RLS
ALTER TABLE teacher_instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instruments_owner" ON teacher_instruments FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "instruments_school_read" ON teacher_instruments FOR SELECT USING (school_id = get_my_school_id());
