-- Add metadata JSONB column to exam_blueprints
-- Stores exam configuration: exam_type, version_count, shuffle settings, extra_points, instructions
ALTER TABLE exam_blueprints
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
