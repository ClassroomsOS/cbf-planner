-- Migration: 20260426004125
-- Classroom Live System — sesiones en vivo, pizarras, documentos, diapositivas
-- + anuncios institucionales + niveles de escuela
-- Nota: Reconstruida desde gen types (archivo original aplicado directo a prod)

-- Niveles de la escuela (Primaria / Bachillerato)
CREATE TABLE IF NOT EXISTS school_levels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  grade_from int NOT NULL,
  grade_to int NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE school_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_levels_school" ON school_levels FOR ALL
  USING (school_id = get_my_school_id());

-- Sesiones de clase en vivo
CREATE TABLE IF NOT EXISTS classroom_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  grade text NOT NULL,
  section text NOT NULL,
  subject text NOT NULL,
  status text DEFAULT 'active',
  classroom_label text,
  lesson_plan_id uuid REFERENCES lesson_plans(id) ON DELETE SET NULL,
  news_project_id uuid REFERENCES news_projects(id) ON DELETE SET NULL,
  current_topic text,
  current_moment text,
  notes text,
  student_count int,
  virtual_count int,
  started_at timestamptz,
  ended_at timestamptz,
  last_ping_at timestamptz
);
ALTER TABLE classroom_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classroom_sessions_school" ON classroom_sessions FOR ALL
  USING (school_id = get_my_school_id());

-- Pizarras digitales por sesión
CREATE TABLE IF NOT EXISTS classroom_boards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  grade text NOT NULL,
  section text NOT NULL,
  subject text NOT NULL,
  date date DEFAULT current_date,
  lesson_plan_id uuid REFERENCES lesson_plans(id) ON DELETE SET NULL,
  strokes jsonb DEFAULT '[]'::jsonb,
  text_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE classroom_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classroom_boards_school" ON classroom_boards FOR ALL
  USING (school_id = get_my_school_id());

-- Documentos compartidos en clase
CREATE TABLE IF NOT EXISTS classroom_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  lesson_plan_id uuid REFERENCES lesson_plans(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text DEFAULT 'file',
  url text,
  storage_path text,
  grade text,
  section text,
  subject text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE classroom_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classroom_documents_school" ON classroom_documents FOR ALL
  USING (school_id = get_my_school_id());

-- Diapositivas / presentaciones de clase
CREATE TABLE IF NOT EXISTS classroom_slides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  grade text NOT NULL,
  section text NOT NULL,
  subject text NOT NULL,
  lesson_plan_id uuid REFERENCES lesson_plans(id) ON DELETE SET NULL,
  title text DEFAULT '',
  slides jsonb DEFAULT '[]'::jsonb,
  week_number int,
  period int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE classroom_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classroom_slides_school" ON classroom_slides FOR ALL
  USING (school_id = get_my_school_id());

-- Anuncios institucionales
CREATE TABLE IF NOT EXISTS announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  author_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  target_role text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_school" ON announcements FOR ALL
  USING (school_id = get_my_school_id());

-- Comentarios en planes de guía
CREATE TABLE IF NOT EXISTS plan_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES lesson_plans(id) ON DELETE CASCADE,
  author_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  body text NOT NULL,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE plan_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_comments_school" ON plan_comments FOR ALL
  USING (school_id = get_my_school_id());
