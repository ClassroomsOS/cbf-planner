-- Migration: 20260426031000
-- Round 2: missing columns in correction_requests and news_projects
-- NO-OP on production — mark as applied via repair.

-- ── correction_requests ─────────────────��─────────────────���───────────────────
ALTER TABLE correction_requests
  ADD COLUMN IF NOT EXISTS author_id   uuid REFERENCES teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS body        text,
  ADD COLUMN IF NOT EXISTS day_iso     text,
  ADD COLUMN IF NOT EXISTS section_key text;

-- ── news_projects ─────────────────────────────────────────────────────────────
ALTER TABLE news_projects
  ADD COLUMN IF NOT EXISTS assessments jsonb,
  ADD COLUMN IF NOT EXISTS rubric      jsonb,
  ADD COLUMN IF NOT EXISTS sequence    integer,
  ADD COLUMN IF NOT EXISTS start_date  date;

NOTIFY pgrst, 'reload schema';
