import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ConversationWithDetails {
  id: string;
  is_group: boolean;
  group_name: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_time: string | null;
  last_message_sender_id?: string | null;
  is_encrypted?: boolean;
  unread_count: number;
  other_user_name: string | null;
  other_user_id: string | null;
  other_user_avatar_url: string | null;
  other_user_online: boolean;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Get all conversation IDs for this user
    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!memberData || memberData.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = memberData.map((m: any) => m.conversation_id);

    // Get conversations
    const { data: convData } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convData) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // For each conversation, get last message and other member info
    const enriched: ConversationWithDetails[] = await Promise.all(
      convData.map(async (conv: any) => {
        // Last message
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, type, created_at, sender_id, is_encrypted")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Other members for DM name
        let otherUserName: string | null = null;
        let otherUserId: string | null = null;
        let otherUserAvatarUrl: string | null = null;
        if (!conv.is_group) {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conv.id)
            .neq("user_id", user.id)
            .limit(1);

          if (members && members.length > 0) {
            otherUserId = (members[0] as any).user_id;
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name, avatar_url")
              .eq("user_id", otherUserId!)
              .maybeSingle();
            if (profile) {
              otherUserName = `${(profile as any).first_name} ${(profile as any).last_name}`.trim();
              otherUserAvatarUrl = (profile as any).avatar_url;
            }
          }
        }

        let lastMessageContent = lastMsg
          ? (lastMsg as any).type === "audio"
            ? "🎵 Áudio"
            : (lastMsg as any).type === "image"
              ? "📷 Imagem"
              : (lastMsg as any).type === "file"
                ? "📄 Arquivo"
                : (lastMsg as any).content || ""
          : "";

        return {
          id: conv.id,
          is_group: conv.is_group,
          group_name: conv.group_name,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_message: lastMessageContent,
          last_message_time: lastMsg ? (lastMsg as any).created_at : null,
          last_message_sender_id: lastMsg ? (lastMsg as any).sender_id : null,
          is_encrypted: lastMsg ? (lastMsg as any).is_encrypted : false,
          unread_count: 0,
          other_user_name: otherUserName,
          other_user_id: otherUserId,
          other_user_avatar_url: otherUserAvatarUrl,
          other_user_online: false,
        };
      })
    );

    // Ordenar por horário da última mensagem (mais recente primeiro)
    enriched.sort((a, b) => {
      if (!a.last_message_time && !b.last_message_time) return 0;
      if (!a.last_message_time) return 1;
      if (!b.last_message_time) return -1;
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });

    setConversations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for new messages to refresh list
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
}
