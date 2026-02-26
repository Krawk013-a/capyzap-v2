import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCheck, Clock, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReadInfo {
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    read_at: string;
}

interface MessageInfoDialogProps {
    open: boolean;
    onClose: () => void;
    messageId: string;
}

export function MessageInfoDialog({ open, onClose, messageId }: MessageInfoDialogProps) {
    const [reads, setReads] = useState<ReadInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (open && messageId) {
            fetchReads();

            const channel = supabase
                .channel(`message-reads-${messageId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "message_reads",
                        filter: `message_id=eq.${messageId}`,
                    },
                    () => {
                        fetchReads();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [open, messageId]);

    const fetchReads = async () => {
        setLoading(true);
        const { data: readData } = await (supabase as any)
            .from("message_reads")
            .select("user_id, read_at")
            .eq("message_id", messageId);

        if (readData && readData.length > 0) {
            const userIds = readData.map((r: any) => r.user_id);
            const { data: profiles } = await supabase
                .from("profiles")
                .select("user_id, first_name, last_name, avatar_url")
                .in("user_id", userIds);

            if (profiles) {
                const enriched = readData.map((r: any) => {
                    const p = profiles.find((prof) => prof.user_id === r.user_id);
                    return {
                        ...r,
                        first_name: p?.first_name || "Membro",
                        last_name: p?.last_name || "",
                        avatar_url: p?.avatar_url || null,
                    };
                });
                setReads(enriched);
            }
        } else {
            setReads([]);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        <DialogTitle>Dados da Mensagem</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="p-6 pt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CheckCheck className="h-3.5 w-3.5 text-blue-500" /> Lido por
                    </h4>

                    <ScrollArea className="max-h-[300px] pr-4">
                        {loading && reads.length === 0 ? (
                            <div className="flex justify-center py-8">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        ) : reads.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Ninguém visualizou ainda.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {reads.sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime()).map((read) => (
                                    <div key={read.user_id} className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarImage src={read.avatar_url || undefined} />
                                            <AvatarFallback className="bg-primary/5 text-primary">
                                                {read.first_name[0]}
                                                {read.last_name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {read.first_name} {read.last_name}
                                            </p>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                <span>{format(new Date(read.read_at), "eeee, HH:mm", { locale: ptBR })}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
