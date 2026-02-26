
-- Create SECURITY DEFINER function to get user's conversation IDs without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_conversation_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_conversation_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_conversation_ids TO authenticated;

-- Fix conversation_members SELECT policy
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
CREATE POLICY "Members can view conversation members"
ON public.conversation_members FOR SELECT
USING (conversation_id IN (SELECT public.get_my_conversation_ids()));

-- Fix conversations SELECT policy
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
USING (id IN (SELECT public.get_my_conversation_ids()));

-- Fix messages SELECT policy
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
USING (conversation_id IN (SELECT public.get_my_conversation_ids()));

-- Fix messages INSERT policy
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (sender_id = auth.uid() AND conversation_id IN (SELECT public.get_my_conversation_ids()));

-- Fix messages UPDATE policy
DROP POLICY IF EXISTS "Users can update message status" ON public.messages;
CREATE POLICY "Users can update message status"
ON public.messages FOR UPDATE
USING (conversation_id IN (SELECT public.get_my_conversation_ids()));
