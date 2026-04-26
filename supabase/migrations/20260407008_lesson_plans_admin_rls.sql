-- ── lesson_plans: admin/rector/superadmin access ───────────────────────────
-- Allows admin, superadmin, and rector to read and update any lesson plan
-- from a teacher who belongs to the same school.
-- The existing teacher-owner policy (teacher_id = auth.uid()) is NOT touched.

CREATE POLICY "lesson_plans_admin_school" ON lesson_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM teachers actor
      WHERE actor.id = auth.uid()
        AND actor.role IN ('admin', 'superadmin', 'rector')
        AND actor.school_id = (
          SELECT owner.school_id
          FROM teachers owner
          WHERE owner.id = lesson_plans.teacher_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM teachers actor
      WHERE actor.id = auth.uid()
        AND actor.role IN ('admin', 'superadmin', 'rector')
        AND actor.school_id = (
          SELECT owner.school_id
          FROM teachers owner
          WHERE owner.id = lesson_plans.teacher_id
        )
    )
  );

-- document_feedback table (if not already created in prod)
-- FeedbackModal relies on this table.
CREATE TABLE IF NOT EXISTS document_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES schools(id),
  entity_type  text NOT NULL CHECK (entity_type IN ('guide','news','agenda')),
  entity_id    uuid NOT NULL,
  entity_title text,
  author_id    uuid NOT NULL REFERENCES teachers(id),
  body         text NOT NULL,
  resolved     boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE document_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_school_read" ON document_feedback
  FOR SELECT USING (school_id = get_my_school_id());

CREATE POLICY "feedback_author_insert" ON document_feedback
  FOR INSERT WITH CHECK (author_id = auth.uid() AND school_id = get_my_school_id());

CREATE POLICY "feedback_author_update" ON document_feedback
  FOR UPDATE USING (author_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS doc_feedback_entity_idx ON document_feedback (entity_type, entity_id);
