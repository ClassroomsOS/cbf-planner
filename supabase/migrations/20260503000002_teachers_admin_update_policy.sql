-- ============================================================
-- MIGRACIÓN: Permitir a admin/superadmin/rector actualizar docentes de su colegio
-- Fix: superadmin no podía cambiar roles porque solo existía teachers_update_own
-- ============================================================

-- Supervisores pueden actualizar cualquier docente de su colegio
DROP POLICY IF EXISTS "teachers_admin_update" ON teachers;
CREATE POLICY "teachers_admin_update" ON teachers
  FOR UPDATE USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
      AND t.role IN ('admin', 'superadmin', 'rector')
    )
  );
