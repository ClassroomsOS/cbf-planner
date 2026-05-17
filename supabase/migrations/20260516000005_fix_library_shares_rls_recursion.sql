-- Fix: RLS infinite recursion between school_library and library_shares
-- The policy shares_doc_owner_read on library_shares did:
--   EXISTS (SELECT 1 FROM school_library sl WHERE sl.id = doc_id AND sl.teacher_id = auth.uid())
-- This triggered school_library's library_shared_read policy which queries library_shares → cycle.
-- Per CLAUDE.md Gotcha #8: child table policies must NEVER SELECT from parent table.
-- The doc owner already sees shares via shares_owner_manage (shared_by = auth.uid()).

DROP POLICY IF EXISTS "shares_doc_owner_read" ON public.library_shares;
