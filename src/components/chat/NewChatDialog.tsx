import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserResult {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
  isGroup?: boolean;
}

export function NewChatDialog({ open, onClose, onCreated, isGroup = false }: NewChatDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setUsers([]);
      setSelected([]);
      setGroupName("");
    }
  }, [open]);

  useEffect(() => {
    const searchUsers = async () => {
      if (search.length < 2 || !user) return;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .neq("user_id", user.id)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        .limit(10);
      setUsers((data as UserResult[]) || []);
    };

    const t = setTimeout(searchUsers, 300);
    return () => clearTimeout(t);
  }, [search, user]);

  const toggleUser = (u: UserResult) => {
    if (isGroup) {
      setSelected((prev) =>
        prev.find((s) => s.user_id === u.user_id)
          ? prev.filter((s) => s.user_id !== u.user_id)
          : [...prev, u]
      );
    } else {
      setSelected([u]);
    }
  };

  const handleCreate = async () => {
    if (!user || selected.length === 0) return;
    setCreating(true);

    try {
      // For DM, check if conversation already exists
      if (!isGroup && selected.length === 1) {
        const { data: myConvs } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", user.id);

        if (myConvs) {
          for (const mc of myConvs) {
            const { data: otherMember } = await supabase
              .from("conversation_members")
              .select("user_id")
              .eq("conversation_id", (mc as any).conversation_id)
              .eq("user_id", selected[0].user_id)
              .single();

            if (otherMember) {
              // Check it's not a group
              const { data: conv } = await supabase
                .from("conversations")
                .select("is_group")
                .eq("id", (mc as any).conversation_id)
                .single();

              if (conv && !(conv as any).is_group) {
                onCreated((mc as any).conversation_id);
                onClose();
                setCreating(false);
                return;
              }
            }
          }
        }
      }

      // Create new conversation
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({
          is_group: isGroup,
          group_name: isGroup ? groupName || "Novo Grupo" : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error || !conv) throw error;

      // Add members
      const members = [
        { conversation_id: (conv as any).id, user_id: user.id },
        ...selected.map((s) => ({ conversation_id: (conv as any).id, user_id: s.user_id })),
      ];

      await supabase.from("conversation_members").insert(members);

      onCreated((conv as any).id);
      onClose();
    } catch (err) {
      console.error("Error creating conversation:", err);
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isGroup ? "Novo Grupo" : "Nova Conversa"}</DialogTitle>
          <DialogDescription>{isGroup ? "Selecione os membros do grupo" : "Busque um contato para conversar"}</DialogDescription>
        </DialogHeader>

        {isGroup && (
          <Input
            placeholder="Nome do grupo"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="mb-2"
          />
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Selected users */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((s) => (
              <span
                key={s.user_id}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
              >
                {s.first_name}
                <button onClick={() => toggleUser(s)} className="ml-1 text-primary/60 hover:text-primary">×</button>
              </span>
            ))}
          </div>
        )}

        {/* User results */}
        <div className="max-h-60 overflow-y-auto scrollbar-thin space-y-1">
          {users.map((u) => {
            const isSelected = selected.some((s) => s.user_id === u.user_id);
            return (
              <button
                key={u.user_id}
                onClick={() => toggleUser(u)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent ${
                  isSelected ? "bg-accent" : ""
                }`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {u.first_name[0]}{u.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-left text-sm font-medium">{u.first_name} {u.last_name}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
          {search.length >= 2 && users.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</p>
          )}
          {search.length < 2 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Digite pelo menos 2 letras para buscar</p>
          )}
        </div>

        <Button onClick={handleCreate} disabled={selected.length === 0 || creating} className="w-full">
          {creating ? "Criando..." : isGroup ? "Criar Grupo" : "Iniciar Conversa"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
