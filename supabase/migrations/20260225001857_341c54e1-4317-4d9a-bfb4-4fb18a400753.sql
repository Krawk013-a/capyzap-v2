
-- Fix INSERT policy for conversations (current one is RESTRICTIVE, needs to be PERMISSIVE)
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix INSERT policy for conversation_members
DROP POLICY IF EXISTS "Users can add members" ON public.conversation_members;
CREATE POLICY "Users can add members"
ON public.conversation_members FOR INSERT
TO authenticated
WITH CHECK (true);
