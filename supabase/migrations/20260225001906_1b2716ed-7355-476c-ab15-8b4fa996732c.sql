
-- Tighten conversations INSERT: only creator can insert their own
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Tighten conversation_members INSERT: must be authenticated
DROP POLICY IF EXISTS "Users can add members" ON public.conversation_members;
CREATE POLICY "Users can add members"
ON public.conversation_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
