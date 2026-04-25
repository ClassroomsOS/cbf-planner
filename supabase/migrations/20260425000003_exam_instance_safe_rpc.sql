-- ── get_exam_instance_safe ────────────────────────────────────────────────���───
-- RPC llamado por el ExamPlayer para cargar la instancia del estudiante.
-- Devuelve generated_questions SIN correct_answer — la clave nunca sale
-- de la base de datos hacia el cliente.
--
-- Seguridad:
--   • SECURITY DEFINER: la función verifica student_email + session_id internamente
--   • El filtro AND lower(student_email) = lower(p_email) impide leer instancias ajenas
--   • correct_answer es removido con (q - 'correct_answer') antes del RETURN
--   • Accesible por anon (estudiantes sin cuenta Supabase)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_exam_instance_safe(
  p_session_id  uuid,
  p_email       text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id',                 ei.id,
    'student_name',       ei.student_name,
    'student_section',    ei.student_section,
    'version_label',      ei.version_label,
    'instance_status',    ei.instance_status,
    'delivery_mode',      ei.delivery_mode,
    'school_id',          ei.school_id,
    'session_id',         ei.session_id,
    'generated_questions', (
      SELECT COALESCE(jsonb_agg(q - 'correct_answer'), '[]'::jsonb)
      FROM jsonb_array_elements(ei.generated_questions) AS q
    )
  )
  FROM exam_instances ei
  WHERE ei.session_id               = p_session_id
    AND lower(ei.student_email)     = lower(p_email)
    AND ei.instance_status          IN ('ready', 'started')
  LIMIT 1;
$$;

-- Permitir ejecución a usuarios anónimos (estudiantes sin login)
GRANT EXECUTE ON FUNCTION get_exam_instance_safe(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION get_exam_instance_safe(uuid, text) TO authenticated;
