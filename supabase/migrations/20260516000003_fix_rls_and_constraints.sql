-- ============================================================
-- CBF PLANNER — Fix: RLS policies + constraints (Auditoría 2026-05-16)
-- ============================================================

-- ── A-6: NOT NULL en student_email ──────────────────────────────────────────
-- Limpiar nulls existentes antes de agregar constraint
UPDATE exam_instances SET student_email = '' WHERE student_email IS NULL;
ALTER TABLE exam_instances ALTER COLUMN student_email SET NOT NULL;

-- ── A-8: Restringir policy instances_school ─────────────────────────────────
-- Antes: cualquier docente del colegio podía ver/modificar TODAS las instancias
-- Ahora: solo el owner de la sesión tiene ALL, admins tienen SELECT
DROP POLICY IF EXISTS "instances_school" ON exam_instances;

CREATE POLICY "instances_owner" ON exam_instances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM exam_sessions es
      WHERE es.id = session_id AND es.teacher_id = auth.uid()
    )
  );

CREATE POLICY "instances_school_read" ON exam_instances
  FOR SELECT USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.role IN ('admin', 'superadmin', 'rector')
    )
  );

-- ── A-11: Restringir shares_owner_manage ────────────────────────────────────
-- Antes: el dueño del doc podía gestionar shares creados por admin
-- Ahora: solo puedes gestionar shares que TÚ creaste
DROP POLICY IF EXISTS "shares_owner_manage" ON library_shares;
CREATE POLICY "shares_owner_manage" ON library_shares
  FOR ALL USING (shared_by = auth.uid())
  WITH CHECK (shared_by = auth.uid());

-- Agregar policy separada para que el dueño del documento pueda ver sus shares
CREATE POLICY "shares_doc_owner_read" ON library_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM school_library sl
      WHERE sl.id = doc_id AND sl.teacher_id = auth.uid()
    )
  );

-- ── A-7 extra: índice compuesto para exam_responses ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_exam_responses_instance_status
  ON exam_responses(instance_id, ai_correction_status);

-- ── M-15: UNIQUE en access_code ─────────────────────────────────────────────
-- Evitar colisión teórica de códigos de acceso
ALTER TABLE exam_sessions
  ADD CONSTRAINT exam_sessions_access_code_unique UNIQUE (access_code);

-- ── M-16: FK library_fragments.created_by con SET NULL ──────────────────────
-- Si un docente se elimina, preservar el fragmento (auditoría)
ALTER TABLE library_fragments
  DROP CONSTRAINT IF EXISTS library_fragments_created_by_fkey;
ALTER TABLE library_fragments
  ADD CONSTRAINT library_fragments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE library_fragments ALTER COLUMN created_by DROP NOT NULL;
