-- Fix RLS for conversation creation with returning/select
-- When inserting with `select=*`, PostgREST needs SELECT permission on the inserted row.
-- Allow creators to read their newly-created conversation even before members are inserted.

DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR id IN (SELECT public.get_my_conversation_ids())
);