-- ============================================================
-- CBF PLANNER — Roster de Estudiantes
-- Migración: 20260422000004
--
-- Crea la tabla school_students y agrega student_email /
-- student_id / student_section a exam_instances para que:
--   • El docente gestione el listado de su curso
--   • Los estudiantes accedan al examen con email + access_code
--   • Las alertas Telegram incluyan nombre y sección
-- ============================================================

-- ─── 1. Tabla school_students ─────────────────────────────────

CREATE TABLE IF NOT EXISTS school_students (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id    uuid        REFERENCES teachers(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  email         text        NOT NULL,
  grade         text        NOT NULL,   -- combined: "9.° Blue"
  section       text        NOT NULL,   -- "Blue" | "Red" | "A" ...
  student_code  text        NOT NULL,   -- auto-generado, único por colegio
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT school_students_email_unique  UNIQUE (school_id, email),
  CONSTRAINT school_students_code_unique   UNIQUE (school_id, student_code)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_school_students_school
  ON school_students (school_id);

CREATE INDEX IF NOT EXISTS idx_school_students_grade_section
  ON school_students (school_id, grade, section);

CREATE INDEX IF NOT EXISTS idx_school_students_email
  ON school_students (school_id, email);

CREATE INDEX IF NOT EXISTS idx_school_students_teacher
  ON school_students (teacher_id);

-- RLS
ALTER TABLE school_students ENABLE ROW LEVEL SECURITY;

-- El docente y todos los del mismo colegio pueden leer el roster
CREATE POLICY "school_students_school_read" ON school_students
  FOR SELECT USING (school_id = get_my_school_id());

-- Solo el docente propietario o admins pueden insertar/actualizar/borrar
CREATE POLICY "school_students_owner_write" ON school_students
  FOR ALL USING (
    teacher_id = auth.uid()
    OR school_id = get_my_school_id() AND EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.role IN ('admin', 'superadmin', 'rector')
    )
  );

-- ─── 2. Ampliar exam_instances ────────────────────────────────
-- Agrega los campos necesarios para el nuevo flujo email-based.
-- student_code se mantiene por compatibilidad (se auto-genera del roster).

ALTER TABLE exam_instances
  ADD COLUMN IF NOT EXISTS student_email   text,
  ADD COLUMN IF NOT EXISTS student_id      uuid REFERENCES school_students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS student_section text;

CREATE INDEX IF NOT EXISTS idx_exam_instances_student_email
  ON exam_instances (session_id, student_email);

CREATE INDEX IF NOT EXISTS idx_exam_instances_student_id
  ON exam_instances (student_id);

-- ─── 3. Función helper: generar student_code secuencial ───────
-- Formato: prefijo de grado/sección (9B) + número de secuencia 3-dígitos
-- Ejemplo: 9B-001, 9B-002, 9R-001

CREATE OR REPLACE FUNCTION generate_student_code(
  p_school_id uuid,
  p_grade     text,
  p_section   text
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_prefix  text;
  v_seq     int;
  v_code    text;
BEGIN
  -- Prefijo: primer dígito del grado + primera letra de la sección
  -- "9.° Blue" → "9" + "B" → "9B"
  v_prefix := regexp_replace(p_grade, '[^0-9]', '', 'g')
              || upper(left(p_section, 1));

  SELECT COUNT(*) + 1
    INTO v_seq
    FROM school_students
   WHERE school_id = p_school_id
     AND grade     = p_grade
     AND section   = p_section;

  v_code := v_prefix || '-' || lpad(v_seq::text, 3, '0');

  -- Si ya existe (por borrado + re-inserción), incrementar hasta libre
  WHILE EXISTS (
    SELECT 1 FROM school_students
     WHERE school_id = p_school_id AND student_code = v_code
  ) LOOP
    v_seq  := v_seq + 1;
    v_code := v_prefix || '-' || lpad(v_seq::text, 3, '0');
  END LOOP;

  RETURN v_code;
END;
$$;

-- ─── 4. Trigger: auto-set student_code antes de INSERT ────────

CREATE OR REPLACE FUNCTION auto_student_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.student_code IS NULL OR NEW.student_code = '' THEN
    NEW.student_code := generate_student_code(NEW.school_id, NEW.grade, NEW.section);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_student_code ON school_students;
CREATE TRIGGER trg_auto_student_code
  BEFORE INSERT OR UPDATE ON school_students
  FOR EACH ROW EXECUTE FUNCTION auto_student_code();
