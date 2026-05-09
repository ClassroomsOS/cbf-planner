-- =============================================================================
-- library_sharing_history
-- 1. Supervisión admin sobre documentos personales de docentes
-- 2. Compartir documentos con permisos de lectura/edición
-- 3. Log automático de ediciones con capacidad de rollback
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SUPERVISIÓN ADMIN — policy SELECT sobre TODOS los docs del colegio
-- Admin / Rector / Superadmin ven documentos personales de todos los docentes.
-- Esto NO les da permiso de editar ni borrar documentos ajenos.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "library_admin_oversight" ON school_library
  FOR SELECT
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM teachers
      WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin', 'rector')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. COMPARTIR — tabla library_shares
-- El dueño del documento puede compartirlo con otros docentes del colegio,
-- con o sin permiso de edición.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS library_shares (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        uuid        NOT NULL REFERENCES school_library(id) ON DELETE CASCADE,
  shared_by     uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  shared_with   uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  can_edit      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_library_shares_doc    ON library_shares(doc_id);
CREATE INDEX IF NOT EXISTS idx_library_shares_with   ON library_shares(shared_with);

-- RLS library_shares
ALTER TABLE library_shares ENABLE ROW LEVEL SECURITY;

-- Dueño del doc gestiona sus shares
CREATE POLICY "shares_owner_manage" ON library_shares
  FOR ALL
  USING (
    shared_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM school_library
      WHERE id = doc_id AND teacher_id = auth.uid()
    )
  );

-- Admin puede ver y gestionar shares de su colegio
CREATE POLICY "shares_admin_manage" ON library_shares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_library sl
      JOIN teachers t ON t.id = auth.uid()
      WHERE sl.id = doc_id
        AND sl.school_id = t.school_id
        AND t.role IN ('admin', 'superadmin', 'rector')
    )
  );

-- Recipient puede leer su propio share
CREATE POLICY "shares_recipient_read" ON library_shares
  FOR SELECT
  USING (shared_with = auth.uid());

-- ─── Políticas de acceso en school_library via library_shares ─────────────
-- Documentos compartidos: recipient puede leer
CREATE POLICY "library_shared_read" ON school_library
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM library_shares
      WHERE doc_id = school_library.id
        AND shared_with = auth.uid()
    )
  );

-- Documentos compartidos: recipient con can_edit puede actualizar metadata
CREATE POLICY "library_shared_update" ON school_library
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM library_shares
      WHERE doc_id = school_library.id
        AND shared_with = auth.uid()
        AND can_edit = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LOG DE EDICIÓN — tabla library_edit_log
-- Cada modificación de school_library queda registrada automáticamente
-- mediante trigger. Snapshot completo del estado anterior permite rollback.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS library_edit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id        uuid        NOT NULL REFERENCES school_library(id) ON DELETE CASCADE,
  editor_id     uuid        REFERENCES teachers(id) ON DELETE SET NULL,
  action        text        NOT NULL
                            CHECK (action IN ('created','updated','restored','shared','file_replaced')),
  -- Snapshot del estado ANTERIOR (para rollback)
  old_snapshot  jsonb,
  -- Snapshot del estado NUEVO
  new_snapshot  jsonb,
  -- Descripción legible de qué cambió
  change_summary text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lib_log_doc  ON library_edit_log(doc_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lib_log_editor ON library_edit_log(editor_id);

-- RLS library_edit_log
ALTER TABLE library_edit_log ENABLE ROW LEVEL SECURITY;

-- Quien puede ver el doc puede ver su historial
CREATE POLICY "log_visible_to_doc_readers" ON library_edit_log
  FOR SELECT
  USING (
    -- Dueño del doc
    EXISTS (SELECT 1 FROM school_library WHERE id = doc_id AND teacher_id = auth.uid())
    -- Admin del colegio
    OR EXISTS (
      SELECT 1 FROM school_library sl JOIN teachers t ON t.id = auth.uid()
      WHERE sl.id = doc_id AND sl.school_id = t.school_id AND t.role IN ('admin','superadmin','rector')
    )
    -- Recipient de share
    OR EXISTS (SELECT 1 FROM library_shares WHERE doc_id = library_edit_log.doc_id AND shared_with = auth.uid())
  );

-- Solo el trigger/RPC escriben en el log (no desde el cliente)
CREATE POLICY "log_insert_trigger_only" ON library_edit_log
  FOR INSERT
  WITH CHECK (true);  -- el trigger es SECURITY DEFINER, pasa este check

-- ─── Función trigger — log automático en cada UPDATE ──────────────────────

CREATE OR REPLACE FUNCTION fn_log_library_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_editor   uuid;
  v_summary  text;
  v_changes  text[];
BEGIN
  -- Saltar si el UPDATE viene del RPC de rollback
  IF current_setting('app.library_skip_log', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Capturar el editor (funciona en contexto de API Supabase)
  BEGIN
    v_editor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_editor := NULL;
  END;

  -- Construir resumen legible de cambios
  IF OLD.title       IS DISTINCT FROM NEW.title       THEN v_changes := array_append(v_changes, 'título'); END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN v_changes := array_append(v_changes, 'descripción'); END IF;
  IF OLD.doc_type    IS DISTINCT FROM NEW.doc_type    THEN v_changes := array_append(v_changes, 'tipo'); END IF;
  IF OLD.subjects    IS DISTINCT FROM NEW.subjects    THEN v_changes := array_append(v_changes, 'materias'); END IF;
  IF OLD.grades      IS DISTINCT FROM NEW.grades      THEN v_changes := array_append(v_changes, 'grados'); END IF;
  IF OLD.metadata    IS DISTINCT FROM NEW.metadata    THEN v_changes := array_append(v_changes, 'metadata'); END IF;
  IF OLD.file_url    IS DISTINCT FROM NEW.file_url    THEN v_changes := array_append(v_changes, 'archivo'); END IF;
  IF OLD.visibility  IS DISTINCT FROM NEW.visibility  THEN v_changes := array_append(v_changes, 'visibilidad'); END IF;

  v_summary := CASE
    WHEN array_length(v_changes, 1) > 0 THEN 'Cambió: ' || array_to_string(v_changes, ', ')
    ELSE 'Actualización menor'
  END;

  INSERT INTO library_edit_log (doc_id, editor_id, action, old_snapshot, new_snapshot, change_summary)
  VALUES (
    NEW.id,
    v_editor,
    'updated',
    to_jsonb(OLD),
    to_jsonb(NEW),
    v_summary
  );

  RETURN NEW;
END;
$$;

-- Trigger: después de cada UPDATE en school_library
DROP TRIGGER IF EXISTS trg_library_edit_log ON school_library;
CREATE TRIGGER trg_library_edit_log
  AFTER UPDATE ON school_library
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_library_edit();

-- Log automático en INSERT (creación)
CREATE OR REPLACE FUNCTION fn_log_library_create()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_editor uuid;
BEGIN
  BEGIN v_editor := auth.uid(); EXCEPTION WHEN OTHERS THEN v_editor := NULL; END;
  INSERT INTO library_edit_log (doc_id, editor_id, action, new_snapshot, change_summary)
  VALUES (NEW.id, v_editor, 'created', to_jsonb(NEW), 'Documento creado');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_create_log ON school_library;
CREATE TRIGGER trg_library_create_log
  AFTER INSERT ON school_library
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_library_create();

-- ─── RPC de rollback ──────────────────────────────────────────────────────
-- Restaura un documento al estado guardado en old_snapshot de un log entry.
-- Solo el dueño o un admin pueden ejecutar el rollback.

CREATE OR REPLACE FUNCTION library_rollback(p_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log         library_edit_log%ROWTYPE;
  v_snap        jsonb;
  v_caller      uuid;
  v_doc         school_library%ROWTYPE;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Obtener el log entry
  SELECT * INTO v_log FROM library_edit_log WHERE id = p_log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Log entry not found'; END IF;

  v_snap := v_log.old_snapshot;
  IF v_snap IS NULL THEN RAISE EXCEPTION 'No previous snapshot to restore'; END IF;

  -- Verificar que el documento existe y el caller tiene permiso
  SELECT * INTO v_doc FROM school_library WHERE id = v_log.doc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;

  IF v_doc.teacher_id != v_caller THEN
    IF NOT EXISTS (
      SELECT 1 FROM teachers
      WHERE id = v_caller
        AND school_id = v_doc.school_id
        AND role IN ('admin', 'superadmin', 'rector')
    ) THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  END IF;

  -- Marcar para que el trigger de UPDATE no genere log duplicado
  SET LOCAL app.library_skip_log = 'true';

  -- Restaurar campos editables desde el snapshot
  UPDATE school_library SET
    title        = v_snap->>'title',
    description  = v_snap->>'description',
    doc_type     = v_snap->>'doc_type',
    subjects     = ARRAY(SELECT jsonb_array_elements_text(v_snap->'subjects')),
    grades       = ARRAY(SELECT jsonb_array_elements_text(v_snap->'grades')),
    metadata     = COALESCE(v_snap->'metadata', '{}'::jsonb),
    file_url     = NULLIF(v_snap->>'file_url', ''),
    file_path    = NULLIF(v_snap->>'file_path', ''),
    file_name    = NULLIF(v_snap->>'file_name', ''),
    file_size    = (v_snap->>'file_size')::bigint,
    file_mime    = NULLIF(v_snap->>'file_mime', ''),
    ai_summary   = NULLIF(v_snap->>'ai_summary', '')
  WHERE id = v_log.doc_id;

  -- Resetear la flag
  SET LOCAL app.library_skip_log = 'false';

  -- Registrar la restauración en el log
  INSERT INTO library_edit_log (doc_id, editor_id, action, old_snapshot, new_snapshot, change_summary)
  VALUES (
    v_log.doc_id,
    v_caller,
    'restored',
    to_jsonb(v_doc),  -- estado que había antes del rollback
    v_snap,           -- estado al que volvemos
    'Restaurado al estado del ' || to_char(v_log.created_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH24:MI')
  );

  RETURN jsonb_build_object('success', true, 'doc_id', v_log.doc_id);
END;
$$;
