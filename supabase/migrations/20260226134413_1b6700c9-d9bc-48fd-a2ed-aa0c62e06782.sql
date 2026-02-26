
-- Allow conversation creators to delete their conversations
CREATE POLICY "Creators can delete conversations"
ON public.conversations FOR DELETE
USING (created_by = auth.uid());

-- Allow members to delete messages in their conversations (for conversation deletion)
CREATE POLICY "Members can delete messages in their conversations"
ON public.messages FOR DELETE
USING (conversation_id IN (SELECT get_my_conversation_ids()));

-- Allow any member to delete their membership (leave)
-- Already exists for user_id = auth.uid(), but we need owners to remove others
CREATE POLICY "Owners can remove members"
ON public.conversation_members FOR DELETE
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE created_by = auth.uid()
  )
);
