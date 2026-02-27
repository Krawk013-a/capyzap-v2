import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { encryptText } from "@/lib/crypto";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  audio_url: string | null;
  audio_duration: number | null;
  transcription: string | null;
  status: string;
  created_at: string;
  sender_name?: string;
  reply_to?: string | null;
  reply_to_content?: string | null;
  reply_to_sender_name?: string | null;
  is_encrypted?: boolean;
  reactions?: { emoji: string; user_id: string }[];
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return;
    setLoading(true);

    const { data } = await (supabase as any)
      .from("messages")
      .select("*, message_reactions(emoji, user_id)")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) {
      // Enrich with sender names
      const senderIds = [...new Set(data.map((m: any) => m.sender_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", senderIds);

      const profileMap = new Map<string, string>();
      (profiles || []).forEach((p: any) => {
        profileMap.set(p.user_id, `${p.first_name} ${p.last_name}`.trim());
      });

      // Build reply data map
      const replyIds = data.filter((m: any) => m.reply_to).map((m: any) => m.reply_to);
      let replyMap = new Map<string, { content: string; sender_name: string }>();
      if (replyIds.length > 0) {
        const { data: replyMsgs } = await supabase
          .from("messages")
          .select("id, content, sender_id, type")
          .in("id", replyIds);
        (replyMsgs || []).forEach((r: any) => {
          replyMap.set(r.id, {
            content: r.type === "audio" ? "🎵 Áudio" : r.content || "",
            sender_name: profileMap.get(r.sender_id) || "Desconhecido",
          });
        });
      }

      setMessages(
        data.map((m: any) => {
          const reply = m.reply_to ? replyMap.get(m.reply_to) : null;
          return {
            ...m,
            sender_name: profileMap.get(m.sender_id) || "Desconhecido",
            reply_to_content: reply?.content || null,
            reply_to_sender_name: reply?.sender_name || null,
          };
        })
      );

      // Mark unread messages as read
      const unreadIds = data
        .filter((m: any) => m.sender_id !== user.id && m.status !== "read")
        .map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase
          .from("messages")
          .update({ status: "read" })
          .in("id", unreadIds);
      }
    }
    setLoading(false);
  }, [conversationId, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as any;
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? { ...m, status: updated.status } : m))
            );
            return;
          }
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as any;
            // Get sender name
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("user_id", newMsg.sender_id)
              .maybeSingle();

            const senderName = profile
              ? `${(profile as any).first_name} ${(profile as any).last_name}`.trim()
              : "Desconhecido";

            // Get reply info
            let replyContent: string | null = null;
            let replySenderName: string | null = null;
            if (newMsg.reply_to) {
              const { data: replyMsg } = await supabase
                .from("messages")
                .select("content, sender_id, type")
                .eq("id", newMsg.reply_to)
                .maybeSingle();
              if (replyMsg) {
                replyContent = (replyMsg as any).type === "audio" ? "🎵 Áudio" : (replyMsg as any).content || "";
                const { data: rProfile } = await supabase
                  .from("profiles")
                  .select("first_name, last_name")
                  .eq("user_id", (replyMsg as any).sender_id)
                  .maybeSingle();
                replySenderName = rProfile
                  ? `${(rProfile as any).first_name} ${(rProfile as any).last_name}`.trim()
                  : "Desconhecido";
              }
            }

            setMessages((prev) => {
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return [...prev, { ...newMsg, sender_name: senderName, reply_to_content: replyContent, reply_to_sender_name: replySenderName }];
            });

            // Auto-mark as read if from other user
            if (newMsg.sender_id !== user?.id) {
              await supabase
                .from("messages")
                .update({ status: "read" })
                .eq("id", newMsg.id);

              // Track individual read
              await (supabase as any)
                .from("message_reads")
                .insert({ message_id: newMsg.id, user_id: user?.id })
                .select()
                .maybeSingle(); // Use maybeSingle to avoid error if already read
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const sendMessage = async (
    content: string,
    type: "text" | "audio" | "image" | "file" | "sticker" = "text",
    fileUrl?: string,
    audioDuration?: number,
    replyTo?: string,
    stickerUrl?: string,
    encryptionKey?: CryptoKey | null, // Chave do destinatário
    ownPublicKey?: CryptoKey | null // Sua própria chave pública
  ) => {
    if (!conversationId || !user) return;

    let finalContent = content;
    let isEncrypted = false;

    // Só encriptar se AMBAS as chaves estiverem disponíveis (destinatário + remetente)
    // Se apenas uma estiver presente, envia como texto plano para evitar mensagens ilegíveis
    if (type === "text" && content && encryptionKey && ownPublicKey) {
      try {
        const encForOther = await encryptText(content, encryptionKey);
        const encForMe = await encryptText(content, ownPublicKey);

        finalContent = `E2EE:${encForOther}|${encForMe}`;
        isEncrypted = true;
      } catch (err) {
        console.error("Erro ao encriptar:", err);
        // Falha na encriptação → enviar como texto plano
      }
    }

    const insertData: any = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: type === "text" ? finalContent : (type === "sticker" ? "Figurinha" : (type === "file" ? content : null)),
      type,
      audio_url: fileUrl || (type === "sticker" ? stickerUrl : null),
      audio_duration: audioDuration || null,
    };
    if (replyTo) insertData.reply_to = replyTo;
    if (isEncrypted) insertData.is_encrypted = true;

    await supabase.from("messages").insert(insertData);

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  };

  const markAsRead = async () => {
    if (!conversationId || !user) return;

    // Get unread messages from others
    const { data: unread } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .eq("status", "sent");

    if (!unread || unread.length === 0) return;

    // Bulk update status
    await supabase
      .from("messages")
      .update({ status: "read" })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .eq("status", "sent");

    // Individually track reads
    for (const msg of unread) {
      await (supabase as any)
        .from("message_reads")
        .insert({ message_id: msg.id, user_id: user.id })
        .select()
        .maybeSingle();
    }
  };

  const sendSystemMessage = async (content: string) => {
    if (!conversationId) return;
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user?.id,
      content,
      type: "system",
    });
  };

  return { messages, loading, sendMessage, sendSystemMessage, markAsRead, refetch: fetchMessages };
}
