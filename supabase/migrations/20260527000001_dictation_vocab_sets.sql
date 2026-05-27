-- Vocabulary sets for the Dictation module
-- Teachers can save reusable word lists tagged by grade/subject/period

CREATE TABLE IF NOT EXISTS dictation_vocab_sets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id) DEFAULT auth.uid(),
  name text NOT NULL,
  vocabulary text[] NOT NULL DEFAULT '{}',
  grade text,
  subject text,
  period int CHECK (period BETWEEN 1 AND 4),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dictation_vocab_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vocab_sets_owner" ON dictation_vocab_sets
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "vocab_sets_school_read" ON dictation_vocab_sets
  FOR SELECT USING (school_id = get_my_school_id());
