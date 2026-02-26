import { ArrowLeft, MoreVertical, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageBubble, type Message } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { OnlineIndicator } from "./OnlineIndicator";
import { ConversationOptionsDialog } from "./ConversationOptionsDialog";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { usePresence } from "@/hooks/usePresence";
import { useTyping } from "@/hooks/useTyping";
import { useReactions } from "@/hooks/useReactions";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toggleFavoriteSticker } from "@/lib/stickers";
import { useCrypto } from "@/hooks/useCrypto";

interface ChatAreaProps {
  chatId: string | null;
  onBack: () => void;
  isOnline?: (userId: string | null) => boolean;
  onConversationDeleted?: () => void;
  onConversationUpdated?: () => void;
}

export function ChatArea({ chatId, onBack, isOnline, onConversationDeleted, onConversationUpdated }: ChatAreaProps) {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useMessages(chatId);
  const { typingUsers, startTyping, stopTyping } = useTyping(chatId);
  const { toggleReaction } = useReactions();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatName, setChatName] = useState("");
  const [chatInitials, setChatInitials] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { getOtherPublicKey } = useCrypto();
  const [recipientPublicKey, setRecipientPublicKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    if (otherUserId && !isGroup) {
      getOtherPublicKey(otherUserId).then(setRecipientPublicKey);
    } else {
      setRecipientPublicKey(null);
    }
  }, [otherUserId, isGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch chat name
  useEffect(() => {
    if (!chatId || !user) return;

    const fetchInfo = async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("is_group, group_name, created_by")
        .eq("id", chatId)
        .maybeSingle();

      if (conv) setCreatedBy((conv as any).created_by);

      if (conv && (conv as any).is_group) {
        setChatName((conv as any).group_name || "Grupo");
        setChatInitials("GP");
        setIsGroup(true);
        setOtherUserId(null);
        setAvatarUrl((conv as any).group_avatar_url || null);
      } else {
        setIsGroup(false);
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", chatId)
          .neq("user_id", user.id)
          .limit(1);

        if (members && members.length > 0) {
          const uid = (members[0] as any).user_id;
          setOtherUserId(uid);
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, avatar_url")
            .eq("user_id", uid)
            .maybeSingle();

          if (profile) {
            const name = `${(profile as any).first_name} ${(profile as any).last_name}`.trim();
            setChatName(name);
            setAvatarUrl((profile as any).avatar_url);
            setChatInitials(name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase());
          }
        }
      }
    };
    fetchInfo();
  }, [chatId, user]);

  if (!chatId) {
    return <EmptyState />;
  }

  const handleSend = (content: string, replyToId?: string) => {
    stopTyping();
    // Passamos a chave pública se for uma DM segura
    sendMessage(content, "text", undefined, undefined, replyToId, undefined, recipientPublicKey);
  };

  const handleSendAudio = async (blob: Blob, duration: number) => {
    if (!user || !chatId) return;
    const fileName = `${user.id}/${Date.now()}.webm`;
    const { error } = await supabase.storage.from("audio-messages").upload(fileName, blob, {
      contentType: "audio/webm",
    });
    if (error) {
      console.error("Upload error:", error);
      return;
    }
    const { data: urlData } = supabase.storage.from("audio-messages").getPublicUrl(fileName);
    sendMessage("", "audio", urlData.publicUrl, duration);
  };

  const handleSendFile = async (file: File) => {
    if (!user || !chatId) return;
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("audio-messages").upload(fileName, file);

    if (error) {
      console.error("Upload error:", error);
      return;
    }

    const { data: urlData } = supabase.storage.from("audio-messages").getPublicUrl(fileName);
    const type = file.type.startsWith("image/") ? "image" : "file";

    sendMessage(file.name, type, urlData.publicUrl);
  };

  const typingNames = Array.from(typingUsers.values());
  const typingText = typingNames.length > 0
    ? typingNames.length === 1
      ? `${typingNames[0]} está digitando...`
      : `${typingNames.join(", ")} estão digitando...`
    : null;

  const online = isOnline?.(isGroup ? null : otherUserId);

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
  };

  const handleSendSticker = (url: string) => {
    sendMessage("", "sticker", url);
  };

  const handleFavoriteSticker = async (url: string) => {
    if (!user) return;
    const isAdded = await toggleFavoriteSticker(url, user.id);
    if (isAdded) {
      // Opcional: mostrar um brinde/toast
      console.log("Figurinha favoritada!");
    } else {
      console.log("Figurinha removida dos favoritos.");
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card px-3 py-2">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-accent md:hidden">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="relative">
          <Avatar className="h-10 w-10 border shadow-sm">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {isGroup ? <Users className="h-5 w-5" /> : chatInitials}
            </AvatarFallback>
          </Avatar>
          {!isGroup && online && <OnlineIndicator online={true} />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground truncate leading-tight">{chatName}</h2>
          {typingText ? (
            <p className="text-[10px] text-primary animate-pulse truncate">{typingText}</p>
          ) : isGroup ? (
            <p className="text-[10px] text-muted-foreground truncate">Clique para detalhes</p>
          ) : online ? (
            <p className="text-[10px]" style={{ color: "hsl(var(--capyzap-online))" }}>online</p>
          ) : (
            <p className="text-[10px] text-muted-foreground">offline</p>
          )}
        </div>
        <button className="rounded-full p-2 hover:bg-accent" onClick={() => setOptionsOpen(true)}>
          <MoreVertical className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-2"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Diga oi! 👋
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              onReply={handleReply}
              message={{
                id: msg.id,
                content: msg.content || "",
                type: msg.type as any,
                sender: msg.sender_id === user?.id ? "me" : "other",
                senderName: msg.sender_id !== user?.id ? msg.sender_name : undefined,
                time: new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                status: msg.status as "sent" | "delivered" | "read",
                audioDuration: msg.audio_duration ? `${Math.floor(msg.audio_duration / 60)}:${String(Math.floor(msg.audio_duration % 60)).padStart(2, "0")}` : undefined,
                audioUrl: msg.audio_url || undefined,
                transcription: msg.transcription || undefined,
                replyTo: msg.reply_to && msg.reply_to_content ? {
                  id: msg.reply_to,
                  content: msg.reply_to_content,
                  senderName: (msg as any).reply_to_sender_name || "Desconhecido",
                } : undefined,
                reactions: (msg.reactions || []).reduce((acc: any[], r: any) => {
                  const existing = acc.find(a => a.emoji === r.emoji);
                  if (existing) {
                    existing.user_ids.push(r.user_id);
                  } else {
                    acc.push({ emoji: r.emoji, user_ids: [r.user_id] });
                  }
                  return acc;
                }, []),
                is_encrypted: msg.is_encrypted,
              }}
              onReact={(emoji) => toggleReaction(msg.id, emoji)}
              onFavorite={handleFavoriteSticker}
            />
          ))
        )}
        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="flex justify-start animate-in fade-in duration-200">
            <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 shadow-sm border">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-muted-foreground"
                    style={{ animation: `typing-dot 1.4s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSendMessage={handleSend}
        onSendAudio={handleSendAudio}
        onSendFile={handleSendFile}
        onSendSticker={handleSendSticker}
        onTyping={startTyping}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Conversation Options */}
      <ConversationOptionsDialog
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        conversationId={chatId}
        isGroup={isGroup}
        groupName={chatName}
        createdBy={createdBy}
        onDeleted={() => {
          setOptionsOpen(false);
          onConversationDeleted?.();
        }}
        onUpdated={() => {
          onConversationUpdated?.();
          // Re-fetch chat info
          if (chatId && user) {
            supabase
              .from("conversations")
              .select("group_name")
              .eq("id", chatId)
              .single()
              .then(({ data }) => {
                if (data) setChatName((data as any).group_name || "Grupo");
              });
          }
        }}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="hidden md:flex h-full flex-col items-center justify-center bg-muted/30">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent">
          <Users className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">CapyZap Web</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Envie e receba mensagens. Selecione uma conversa para começar.
          </p>
        </div>
      </div>
    </div>
  );
}
