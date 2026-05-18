-- Syllabus deep analysis: adds subunit classification, teaching strategies,
-- and starting unit to syllabus_plan.
-- The existing page_analysis column is reused with richer objects (backward compatible).

ALTER TABLE public.syllabus_plan
  -- Subunit-level classification aggregated from deep page analysis
  -- [{subunit, unit_number, difficulty:'easy'|'moderate'|'dense',
  --   estimated_sessions, session_type, grammar_points[], vocabulary_topics[],
  --   exercise_types[], ai_rationale}]
  ADD COLUMN IF NOT EXISTS subunit_classification jsonb DEFAULT '[]'::jsonb,

  -- Teaching strategies for dense/complex subunits only
  -- [{subunit, unit_number, content_focus, strategies:{
  --   introduction, scaffolding[], common_mistakes[], visual_aids[], session_flow}}]
  ADD COLUMN IF NOT EXISTS teaching_strategies jsonb DEFAULT '[]'::jsonb,

  -- Which unit the teacher chose to start from (1-based)
  ADD COLUMN IF NOT EXISTS start_unit integer DEFAULT 1;

-- Index for quick lookup by plan
CREATE INDEX IF NOT EXISTS idx_syllabus_plan_teacher_period
  ON public.syllabus_plan (teacher_id, subject, grade, period, year);
