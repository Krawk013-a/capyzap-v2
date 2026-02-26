import { useState, useEffect } from "react";
import { Search, Plus, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { type ConversationWithDetails } from "@/hooks/useConversations";
import { OnlineIndicator } from "./OnlineIndicator";
import { SettingsMenu } from "./SettingsMenu";
import { NotificationBanner } from "./NotificationBanner";
import { ChangelogBanner, VersionFooter } from "./ChangelogBanner";
import capyzapLogo from "@/assets/capyzap-logo.png";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCrypto } from "@/hooks/useCrypto";
import { decryptText } from "@/lib/crypto";

interface ChatSidebarProps {
  conversations: ConversationWithDetails[];
  activeChat: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onEditProfile: () => void;
  onOpenChangelog: () => void;
  loading: boolean;
  isOnline: (userId: string | null) => boolean;
}

function LastMessagePreview({ content, isEncrypted, isMine }: { content: string | null, isEncrypted?: boolean, isMine: boolean }) {
  const { privateKey } = useCrypto();
  const [decryptedText, setDecryptedText] = useState<string | null>(null);

  useEffect(() => {
    const handleDecrypt = async () => {
      if (isEncrypted && privateKey && content) {
        let textToDecrypt = content;

        if (content.startsWith("E2EE:")) {
          const parts = content.substring(5).split("|");
          if (parts.length === 2) {
            textToDecrypt = isMine ? parts[1] : parts[0];
            if (!textToDecrypt) {
              setDecryptedText("🔒 Mensagem criptografada");
              return;
            }
          }
        }

        const result = await decryptText(textToDecrypt, privateKey);
        if (result.startsWith("🔒 Esta mensagem")) {
          setDecryptedText("🔒 Mensagem protegida");
        } else {
          setDecryptedText(result);
        }
      } else {
        setDecryptedText(content);
      }
    };

    handleDecrypt();
  }, [content, isEncrypted, privateKey, isMine]);

  const display = decryptedText || (isEncrypted ? "..." : content || "Nenhuma mensagem");

  return (
    <span className="text-sm text-muted-foreground truncate">
      {display}
    </span>
  );
}

export function ChatSidebar({ conversations, activeChat, onSelectChat, onNewChat, onNewGroup, onEditProfile, onOpenChangelog, loading, isOnline }: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const { profile } = useAuth();

  const filtered = conversations.filter((c) => {
    const name = c.is_group ? c.group_name : c.other_user_name;
    return (name || "").toLowerCase().includes(search.toLowerCase());
  });

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: ptBR });
    } catch {
      return "";
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={capyzapLogo} alt="CapyZap" className="h-8 w-8 rounded-full" />
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">CapyZap</h1>
            {profile && (
              <p className="text-xs text-muted-foreground">{profile.first_name} {profile.last_name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onNewGroup} className="rounded-full p-2 transition-colors hover:bg-accent" title="Novo grupo">
            <Users className="h-5 w-5 text-muted-foreground" />
          </button>
          <button onClick={onNewChat} className="rounded-full p-2 transition-colors hover:bg-accent" title="Nova conversa">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </button>
          <SettingsMenu onEditProfile={onEditProfile} onOpenChangelog={onOpenChangelog} />
        </div>
      </div>

      {/* Changelog Banner */}
      <ChangelogBanner />

      {/* Notification Banner */}
      <NotificationBanner />

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted border-0 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda. Comece uma nova!"}
          </div>
        ) : (
          filtered.map((conv) => {
            const name = conv.is_group ? conv.group_name : conv.other_user_name;
            const online = !conv.is_group && isOnline(conv.other_user_id);
            return (
              <button
                key={conv.id}
                onClick={() => onSelectChat(conv.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 ${activeChat === conv.id ? "bg-accent" : ""
                  }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-12 w-12 border shadow-sm">
                    <AvatarImage src={(conv.is_group ? (conv as any).group_avatar_url : conv.other_user_avatar_url) || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {conv.is_group ? <Users className="h-6 w-6" /> : getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <OnlineIndicator online={online} size="md" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate">{name || "Conversa"}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatTime(conv.last_message_time)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <LastMessagePreview
                      content={conv.last_message}
                      isEncrypted={conv.is_encrypted}
                      isMine={conv.last_message_sender_id === profile?.user_id}
                    />
                    {conv.unread_count > 0 && (
                      <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Version Footer */}
      <VersionFooter />
    </div>
  );
}
