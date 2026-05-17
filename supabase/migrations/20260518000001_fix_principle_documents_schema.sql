-- principle_documents was created with principle_id FK (NOT NULL) referencing
-- school_principles, but PrinciplesPage.jsx inserts using school_id/year/month.
-- Fix: add the missing columns, make principle_id nullable, fix RLS.

-- 1. Add missing columns
ALTER TABLE principle_documents
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS year      integer,
  ADD COLUMN IF NOT EXISTS month     integer;

-- 2. Make principle_id nullable (was NOT NULL, blocking all inserts)
ALTER TABLE principle_documents
  ALTER COLUMN principle_id DROP NOT NULL;

-- 3. Drop broken write policy (references principle_id + school_principles join)
DROP POLICY IF EXISTS "principle_docs_write" ON principle_documents;

-- 4. New write policy: any authenticated teacher of the school
CREATE POLICY "principle_docs_write" ON principle_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.school_id = principle_documents.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.id = auth.uid()
        AND t.school_id = principle_documents.school_id
    )
  );

-- 5. Index for the queries used in loadDocs
CREATE INDEX IF NOT EXISTS principle_documents_school_year_month
  ON principle_documents (school_id, year, month);
