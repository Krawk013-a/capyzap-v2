import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useTyping(conversationId: string | null) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase.channel(`typing-${conversationId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const map = new Map<string, string>();
        Object.entries(state).forEach(([userId, presences]) => {
          if (userId !== user.id) {
            const p = presences[0] as any;
            if (p?.typing) {
              map.set(userId, p.name || "Alguém");
            }
          }
        });
        setTypingUsers(map);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ typing: false, name: "" });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, user]);

  const startTyping = useCallback(async () => {
    if (!channelRef.current || !user) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("user_id", user.id)
        .single();
      const name = profile ? (profile as any).first_name : "Alguém";
      await channelRef.current.track({ typing: true, name });
    }

    // Reset the timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      isTypingRef.current = false;
      if (channelRef.current) {
        await channelRef.current.track({ typing: false, name: "" });
      }
    }, 3000);
  }, [user]);

  const stopTyping = useCallback(async () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    if (channelRef.current) {
      await channelRef.current.track({ typing: false, name: "" });
    }
  }, []);

  return { typingUsers, startTyping, stopTyping };
}
