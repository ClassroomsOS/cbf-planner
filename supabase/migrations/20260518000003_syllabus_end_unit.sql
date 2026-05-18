-- Add end_unit column to syllabus_plan for unit range selection.
-- Allows teacher to specify "from Unit X to Unit Y" for the period.

ALTER TABLE public.syllabus_plan
  ADD COLUMN IF NOT EXISTS end_unit integer;
