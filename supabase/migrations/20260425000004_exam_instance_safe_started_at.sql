-- ── get_exam_instance_safe v2 ─────────────────────────────────────────────────
-- Agrega started_at al resultado para que el frontend pueda calcular
-- el tiempo restante real tras una reconexión (iPad apagado, pérdida de red, etc.)
-- Sin started_at, el timer se reiniciaba al máximo permitiendo ganar tiempo extra.
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
    'started_at',         ei.started_at,
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

GRANT EXECUTE ON FUNCTION get_exam_instance_safe(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION get_exam_instance_safe(uuid, text) TO authenticated;
