-- ── Legacy Format fields for lesson_plans ────────────────────────────────────
-- CBF Planner — Legacy Format export (all grades)
-- Adds two nullable TEXT columns that feed the Legacy DOCX generator.
-- Nullability ensures zero impact on existing 8° (CBF-G AC-01) workflow.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS weekly_label              text,  -- e.g. "SPEAKING WEEK"
  ADD COLUMN IF NOT EXISTS weekly_biblical_principle text;  -- free-text biblical principle for the week
