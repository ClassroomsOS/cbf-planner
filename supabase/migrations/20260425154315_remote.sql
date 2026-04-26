-- Migration: 20260425154315
-- Columnas de nombre separado + email representante en school_students
-- (Originalmente aplicado directo a prod sin archivo — reconstruido)

ALTER TABLE school_students
  ADD COLUMN IF NOT EXISTS first_name           text,
  ADD COLUMN IF NOT EXISTS second_name          text,
  ADD COLUMN IF NOT EXISTS first_lastname       text,
  ADD COLUMN IF NOT EXISTS second_lastname      text,
  ADD COLUMN IF NOT EXISTS representative_email text;
