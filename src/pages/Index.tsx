import { useState, useEffect, useRef } from "react";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { ProfileDialog } from "@/components/chat/ProfileDialog";
import { ChangelogDialog } from "@/components/chat/ChangelogDialog";
import { OnboardingTour } from "@/components/chat/OnboardingTour";
import { useConversations } from "@/hooks/useConversations";
import { usePresence } from "@/hooks/usePresence";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const { conversations, loading, refetch } = useConversations();
  const { isOnline } = usePresence();
  const { user } = useAuth();
  const activeChatRef = useRef(activeChat);

  // Keep ref in sync
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Notification for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;
          if (activeChatRef.current === msg.conversation_id) return;

          // Get sender name
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", msg.sender_id)
            .maybeSingle();

          const senderName = profile
            ? `${(profile as any).first_name} ${(profile as any).last_name}`.trim()
            : "Alguém";

          const content = msg.type === "audio" ? "🎵 Áudio" : msg.content || "Nova mensagem";
          const truncated = content.length > 60 ? content.slice(0, 60) + "…" : content;

          // In-app toast
          toast({ title: senderName, description: truncated });

          // Browser native notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const notif = new Notification(`CapyZap - ${senderName}`, {
                body: truncated,
                icon: "/favicon.ico",
                tag: msg.conversation_id, // replaces previous from same conv
              });
              notif.onclick = () => {
                window.focus();
                setActiveChat(msg.conversation_id);
                notif.close();
              };
            } catch { }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleBack = () => setActiveChat(null);

  const handleCreated = (id: string) => {
    setActiveChat(id);
    refetch();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/30">
      <div className={`w-full flex-shrink-0 border-r md:w-[380px] lg:w-[420px] ${activeChat ? "hidden md:block" : "block"}`}>
        <ChatSidebar
          conversations={conversations}
          activeChat={activeChat}
          onSelectChat={setActiveChat}
          onNewChat={() => setNewChatOpen(true)}
          onNewGroup={() => setNewGroupOpen(true)}
          onEditProfile={() => setProfileOpen(true)}
          onOpenChangelog={() => setChangelogOpen(true)}
          loading={loading}
          isOnline={isOnline}
        />
      </div>
      <div className={`flex-1 ${activeChat ? "block" : "hidden md:block"}`}>
        <ChatArea
          chatId={activeChat}
          onBack={handleBack}
          isOnline={isOnline}
          onConversationDeleted={() => {
            setActiveChat(null);
            refetch();
          }}
          onConversationUpdated={refetch}
        />
      </div>

      <NewChatDialog open={newChatOpen} onClose={() => setNewChatOpen(false)} onCreated={handleCreated} />
      <NewChatDialog open={newGroupOpen} onClose={() => setNewGroupOpen(false)} onCreated={handleCreated} isGroup />
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      <OnboardingTour />
    </div>
  );
};

export default Index;
