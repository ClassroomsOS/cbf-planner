-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Student Player Card Module
-- Fecha: 2026-05-02
-- Tablas: attendance, psychometric_tests, social_map, ai_diagnostics, player_stats
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Asistencia
CREATE TABLE student_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id),
  student_id      UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES teachers(id),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  subject         TEXT,
  period          INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, attendance_date, teacher_id, subject)
);

-- 2. Tests psicométricos
CREATE TABLE student_psychometric_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id),
  student_id      UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  test_type       TEXT NOT NULL CHECK (test_type IN ('holland_riasec','teen_disc','chaside')),
  access_token    TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','expired')),
  responses       JSONB,
  results         JSONB,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_by      UUID REFERENCES teachers(id)
);

-- 3. Mapa social (un registro por profesor+grado+sección)
CREATE TABLE student_social_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id),
  teacher_id      UUID NOT NULL REFERENCES teachers(id),
  grade           TEXT NOT NULL,
  section         TEXT NOT NULL,
  groups          JSONB NOT NULL DEFAULT '[]',
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, grade, section)
);

-- 4. Diagnósticos IA cacheados
CREATE TABLE student_ai_diagnostics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id),
  student_id      UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  diagnostic      JSONB NOT NULL,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  generated_by    UUID REFERENCES teachers(id)
);

-- 5. Stats del jugador (cache derivada para render rápido)
CREATE TABLE student_player_stats (
  student_id      UUID PRIMARY KEY REFERENCES school_students(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id),
  overall_rating  INTEGER DEFAULT 0 CHECK (overall_rating BETWEEN 0 AND 99),
  stats           JSONB DEFAULT '{}',
  badges          JSONB DEFAULT '[]',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ RLS ══════════════════════════════════════════════════════════════════════════
ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_psychometric_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_social_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_ai_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_player_stats ENABLE ROW LEVEL SECURITY;

-- School-wide access for authenticated teachers
CREATE POLICY "attendance_school" ON student_attendance FOR ALL USING (school_id = get_my_school_id());
CREATE POLICY "psychometric_school" ON student_psychometric_tests FOR ALL USING (school_id = get_my_school_id());
CREATE POLICY "social_school" ON student_social_map FOR ALL USING (school_id = get_my_school_id());
CREATE POLICY "diagnostic_school" ON student_ai_diagnostics FOR ALL USING (school_id = get_my_school_id());
CREATE POLICY "stats_school" ON student_player_stats FOR ALL USING (school_id = get_my_school_id());

-- Anon policies for public test page (student fills test without auth)
CREATE POLICY "psychometric_anon_select" ON student_psychometric_tests
  FOR SELECT TO anon USING (access_token IS NOT NULL);
CREATE POLICY "psychometric_anon_update" ON student_psychometric_tests
  FOR UPDATE TO anon USING (access_token IS NOT NULL)
  WITH CHECK (status IN ('in_progress','completed'));

-- ═══ Indexes ═════════════════════════════════════════════════════════════════════
CREATE INDEX idx_attendance_student_date ON student_attendance(student_id, attendance_date);
CREATE INDEX idx_attendance_teacher_date ON student_attendance(teacher_id, attendance_date);
CREATE INDEX idx_psychometric_token ON student_psychometric_tests(access_token);
CREATE INDEX idx_psychometric_student ON student_psychometric_tests(student_id);
CREATE INDEX idx_diagnostic_student ON student_ai_diagnostics(student_id);
CREATE INDEX idx_player_stats_school ON student_player_stats(school_id);
