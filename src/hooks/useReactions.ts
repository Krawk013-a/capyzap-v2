import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useReactions() {
    const { user } = useAuth();

    const toggleReaction = async (messageId: string, emoji: string) => {
        if (!user) return;

        // Check if user already reacted with this specific emoji
        const { data: existing } = await (supabase as any)
            .from("message_reactions")
            .select("id")
            .eq("message_id", messageId)
            .eq("user_id", user.id)
            .eq("emoji", emoji)
            .maybeSingle();

        if (existing) {
            // Remove reaction
            await (supabase as any)
                .from("message_reactions")
                .delete()
                .eq("id", existing.id);
        } else {
            // Add reaction
            await (supabase as any)
                .from("message_reactions")
                .insert({
                    message_id: messageId,
                    user_id: user.id,
                    emoji: emoji,
                });
        }
    };

    return { toggleReaction };
}
