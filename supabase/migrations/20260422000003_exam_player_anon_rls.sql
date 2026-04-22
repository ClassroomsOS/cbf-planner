-- ============================================================
-- CBF PLANNER — RLS para acceso anónimo del ExamPlayer
-- Los estudiantes no tienen cuenta Supabase — acceden por código.
-- ============================================================

-- exam_sessions: lectura pública si el examen está activo o listo
CREATE POLICY "exam_sessions_anon_read" ON exam_sessions
  FOR SELECT TO anon
  USING (status IN ('ready', 'active'));

-- exam_instances: lectura pública por student_code
-- (el estudiante solo puede leer la suya filtrando por código)
CREATE POLICY "exam_instances_anon_read" ON exam_instances
  FOR SELECT TO anon
  USING (instance_status IN ('ready', 'started', 'submitted'));

-- exam_instances: el estudiante puede actualizar su propia instancia
-- (started_at, tab_switches, time_spent_seconds, integrity_flags)
CREATE POLICY "exam_instances_anon_update" ON exam_instances
  FOR UPDATE TO anon
  USING (instance_status IN ('ready', 'started'));

-- exam_responses: el estudiante puede insertar sus respuestas
CREATE POLICY "exam_responses_anon_insert" ON exam_responses
  FOR INSERT TO anon
  WITH CHECK (true);

-- exam_offline_queue: el estudiante puede insertar su cola offline
CREATE POLICY "exam_offline_queue_anon_insert" ON exam_offline_queue
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "exam_offline_queue_anon_update" ON exam_offline_queue
  FOR UPDATE TO anon
  USING (sync_status IN ('pending', 'syncing', 'failed'));
