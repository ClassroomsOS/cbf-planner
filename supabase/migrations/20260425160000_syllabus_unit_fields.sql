-- Sesión N: persistir unit_number y subunit en syllabus_topics
-- Estos campos existían en el formulario pero nunca se guardaban en DB

ALTER TABLE syllabus_topics
  ADD COLUMN IF NOT EXISTS unit_number INTEGER CHECK (unit_number BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS subunit     TEXT;

COMMENT ON COLUMN syllabus_topics.unit_number IS 'Número de unidad (Language Arts, Science). Opcional en otras materias.';
COMMENT ON COLUMN syllabus_topics.subunit     IS 'Subunidad Cambridge (ej. "1.1"). Solo Language Arts.';
