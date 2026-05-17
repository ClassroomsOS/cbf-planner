-- ── Syllabus page-level planning + session resources ─────────────────────────
-- Extends syllabus_plan with page analysis data and creates a resources table
-- for attaching multi-type educational resources per session day.

-- ── 1. Extend syllabus_plan ──────────────────────────────────────────────────

-- Page range of the book to cover this period (e.g., pages 24–85)
ALTER TABLE public.syllabus_plan
  ADD COLUMN IF NOT EXISTS page_start      integer,
  ADD COLUMN IF NOT EXISTS page_end        integer,
  -- AI Vision analysis per page: [{page, content_type, complexity, subunit, is_workbook, summary, estimated_minutes}]
  ADD COLUMN IF NOT EXISTS page_analysis   jsonb DEFAULT '[]'::jsonb,
  -- Unit structure detected from scanning: [{unit_number, title, start_page, end_page, subunits:[{label, pages:[]}]}]
  ADD COLUMN IF NOT EXISTS units_config    jsonb DEFAULT '[]'::jsonb,
  -- Page-level distribution: [{week, days:{mon:{pages:[], focus, summary, class_hours}, ...}}]
  ADD COLUMN IF NOT EXISTS page_distribution jsonb DEFAULT '[]'::jsonb;

-- ── 2. syllabus_session_resources — multi-type resources per session day ─────
-- Each resource is attached to a specific day in the syllabus distribution.
-- The teacher explains WHY this resource is here and WHEN in the ABC it goes.

CREATE TABLE IF NOT EXISTS public.syllabus_session_resources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES public.syllabus_plan(id) ON DELETE CASCADE,
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,

  -- Which day this resource belongs to
  week_number     integer NOT NULL,
  day_key         text NOT NULL CHECK (day_key IN ('mon', 'tue', 'wed', 'thu', 'fri')),

  -- Resource type and content
  resource_type   text NOT NULL CHECK (resource_type IN (
    'video', 'reading', 'webpage', 'worksheet', 'fragment', 'audio', 'image', 'other'
  )),
  title           text NOT NULL,
  url             text,                    -- URL for videos, webpages, or Storage path
  file_url        text,                    -- For uploaded files (worksheets, etc.)
  fragment_id     uuid REFERENCES public.library_fragments(id) ON DELETE SET NULL,

  -- Teacher annotation
  justification   text NOT NULL DEFAULT '',  -- WHY this resource is here
  emphasis_notes  text,                      -- What to emphasize from this resource
  abc_section     text CHECK (abc_section IN (
    'subject', 'motivation', 'activity', 'skill', 'closing', 'assignment'
  )),                                        -- WHEN in the ABC to use it

  -- Ordering within the day
  sort_order      integer NOT NULL DEFAULT 0,

  -- Metadata
  duration_minutes integer,                 -- Estimated time this resource takes
  metadata        jsonb DEFAULT '{}'::jsonb, -- Extra data (thumbnail_url, etc.)

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_syllabus_resources()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_syllabus_resources_updated_at ON public.syllabus_session_resources;
CREATE TRIGGER trg_syllabus_resources_updated_at
  BEFORE UPDATE ON public.syllabus_session_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_syllabus_resources();

-- ── 3. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ssr_plan       ON public.syllabus_session_resources(plan_id);
CREATE INDEX IF NOT EXISTS idx_ssr_teacher    ON public.syllabus_session_resources(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ssr_week_day   ON public.syllabus_session_resources(plan_id, week_number, day_key);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.syllabus_session_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssr_teacher_all"
  ON public.syllabus_session_resources FOR ALL
  USING  (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "ssr_school_select"
  ON public.syllabus_session_resources FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.teachers WHERE id = auth.uid()
    )
  );
