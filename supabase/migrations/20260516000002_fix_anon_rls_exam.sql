-- ============================================================
-- CBF PLANNER — Fix: Restringir policies anon del ExamPlayer
--
-- Problema: exam_instances_anon_read permitía leer TODAS las instancias.
--           exam_responses_anon_insert/exam_offline_queue_anon_insert
--           permitían insertar para CUALQUIER instancia.
--
-- Fix: Agregar filtros que validen que la instancia pertenece a una
--      sesión activa. El path principal sigue siendo get_exam_instance_safe().
-- ============================================================

-- 1. Restringir lectura anon de exam_instances:
--    Solo instancias de sesiones activas (el estudiante DEBE pasar por el RPC)
DROP POLICY IF EXISTS "exam_instances_anon_read" ON exam_instances;
CREATE POLICY "exam_instances_anon_read" ON exam_instances
  FOR SELECT TO anon
  USING (
    instance_status IN ('ready', 'started', 'submitted')
    AND EXISTS (
      SELECT 1 FROM exam_sessions es
      WHERE es.id = session_id
        AND es.status IN ('ready', 'active', 'completed')
    )
  );

-- 2. Restringir update anon: solo instancias en sesiones activas
DROP POLICY IF EXISTS "exam_instances_anon_update" ON exam_instances;
CREATE POLICY "exam_instances_anon_update" ON exam_instances
  FOR UPDATE TO anon
  USING (
    instance_status IN ('ready', 'started')
    AND EXISTS (
      SELECT 1 FROM exam_sessions es
      WHERE es.id = session_id
        AND es.status = 'active'
    )
  );

-- 3. Restringir insert de respuestas: solo para instancias activas
DROP POLICY IF EXISTS "exam_responses_anon_insert" ON exam_responses;
CREATE POLICY "exam_responses_anon_insert" ON exam_responses
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_instances ei
      WHERE ei.id = instance_id
        AND ei.instance_status IN ('ready', 'started')
        AND EXISTS (
          SELECT 1 FROM exam_sessions es
          WHERE es.id = ei.session_id
            AND es.status = 'active'
        )
    )
  );

-- 4. Restringir insert offline queue: misma lógica
DROP POLICY IF EXISTS "exam_offline_queue_anon_insert" ON exam_offline_queue;
CREATE POLICY "exam_offline_queue_anon_insert" ON exam_offline_queue
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_instances ei
      WHERE ei.id = instance_id
        AND ei.instance_status IN ('ready', 'started')
    )
  );

-- 5. Agregar índice para performance de las policies
CREATE INDEX IF NOT EXISTS idx_exam_instances_session_status
  ON exam_instances(session_id, instance_status);

CREATE INDEX IF NOT EXISTS idx_exam_instances_school_status
  ON exam_instances(school_id, instance_status);
