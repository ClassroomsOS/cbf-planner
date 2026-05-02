-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar categoría 'general' a micro_activities
-- Fecha: 2026-05-01
-- ════════════════════════════════════════════════════════════════════════════════

-- Drop old CHECK and add new one with 'general'
ALTER TABLE micro_activities DROP CONSTRAINT IF EXISTS micro_activities_category_check;
ALTER TABLE micro_activities ADD CONSTRAINT micro_activities_category_check
  CHECK (category IN ('cognitiva', 'digital', 'axiologica', 'general'));
