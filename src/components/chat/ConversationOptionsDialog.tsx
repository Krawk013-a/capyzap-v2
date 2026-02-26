import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Check, UserPlus, UserMinus, Pencil, Trash2, LogOut, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Member {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

interface UserResult {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface ConversationOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  isGroup: boolean;
  groupName: string;
  createdBy: string | null;
  onDeleted: () => void;
  onUpdated: () => void;
}

type View = "main" | "editGroup" | "addMembers" | "removeMembers";

export function ConversationOptionsDialog({
  open,
  onClose,
  conversationId,
  isGroup,
  groupName,
  createdBy,
  onDeleted,
  onUpdated,
}: ConversationOptionsDialogProps) {
  const { user } = useAuth();
  const [view, setView] = useState<View>("main");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit group state
  const [newGroupName, setNewGroupName] = useState(groupName);
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);

  // Add members state
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<UserResult[]>([]);

  const isOwner = createdBy === user?.id;

  useEffect(() => {
    if (open) {
      setView("main");
      setNewGroupName(groupName);
      setSearch("");
      setSearchResults([]);
      setSelectedToAdd([]);
      fetchMembers();
      fetchGroupInfo();
    }
  }, [open, conversationId]);

  const fetchGroupInfo = async () => {
    if (!isGroup) return;
    const { data } = await (supabase as any)
      .from("conversations")
      .select("group_avatar_url")
      .eq("id", conversationId)
      .maybeSingle();
    if (data) setGroupAvatarUrl(data.group_avatar_url);
  };

  const fetchMembers = async () => {
    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("id, user_id")
      .eq("conversation_id", conversationId);

    if (!memberData) return;

    const userIds = memberData.map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", userIds);

    const profileMap = new Map<string, { first_name: string; last_name: string }>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    setMembers(
      memberData.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        first_name: profileMap.get(m.user_id)?.first_name || "",
        last_name: profileMap.get(m.user_id)?.last_name || "",
      }))
    );
  };

  // Search users for adding
  useEffect(() => {
    if (view !== "addMembers" || search.length < 2 || !user) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .neq("user_id", user.id)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        .limit(10);

      // Filter out existing members
      const memberIds = new Set(members.map((m) => m.user_id));
      setSearchResults(((data as UserResult[]) || []).filter((u) => !memberIds.has(u.user_id)));
    }, 300);
    return () => clearTimeout(t);
  }, [search, view, user, members]);

  const handleEditGroup = async () => {
    if (!newGroupName.trim()) return;
    setLoading(true);
    await supabase
      .from("conversations")
      .update({ group_name: newGroupName.trim() })
      .eq("id", conversationId);

    // Send system message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user?.id,
      content: `${user?.id === createdBy ? "O administrador" : "Um membro"} alterou o nome do grupo para "${newGroupName.trim()}"`,
      type: "system"
    });

    toast({ title: "Grupo atualizado", description: "Nome do grupo alterado com sucesso." });
    setLoading(false);
    onUpdated();
    setView("main");
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setLoading(true);
    const inserts = selectedToAdd.map((u) => ({
      conversation_id: conversationId,
      user_id: u.user_id,
    }));
    await supabase.from("conversation_members").insert(inserts);

    // System messages
    for (const u of selectedToAdd) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user?.id,
        content: `${u.first_name} foi adicionado ao grupo`,
        type: "system"
      });
    }

    toast({ title: "Membros adicionados", description: `${selectedToAdd.length} membro(s) adicionado(s).` });
    setLoading(false);
    setSelectedToAdd([]);
    setSearch("");
    await fetchMembers();
    onUpdated();
    setView("main");
  };

  const handleRemoveMember = async (member: Member) => {
    setLoading(true);
    await supabase.from("conversation_members").delete().eq("id", member.id);

    // System message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user?.id,
      content: `${member.first_name} foi removido do grupo`,
      type: "system"
    });

    toast({ title: "Membro removido", description: `${member.first_name} foi removido do grupo.` });
    setLoading(false);
    await fetchMembers();
    onUpdated();
  };

  const handleLeaveConversation = async () => {
    if (!user) return;
    setLoading(true);
    await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    toast({ title: "Você saiu da conversa" });
    setLoading(false);
    onDeleted();
    onClose();
  };

  const handleDeleteConversation = async () => {
    setLoading(true);
    // Delete messages first, then members, then conversation
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
    await supabase.from("conversation_members").delete().eq("conversation_id", conversationId);
    await supabase.from("conversations").delete().eq("id", conversationId);
    toast({ title: "Conversa apagada", description: "A conversa foi removida permanentemente." });
    setLoading(false);
    setConfirmDelete(false);
    onDeleted();
    onClose();
  };

  const toggleAddUser = (u: UserResult) => {
    setSelectedToAdd((prev) =>
      prev.find((s) => s.user_id === u.user_id)
        ? prev.filter((s) => s.user_id !== u.user_id)
        : [...prev, u]
    );
  };

  const getInitials = (first: string, last: string) =>
    `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "?";

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          {view === "main" && (
            <>
              <DialogHeader>
                <DialogTitle>{isGroup ? groupName || "Grupo" : "Opções da Conversa"}</DialogTitle>
                <div className="flex justify-center py-4">
                  <Avatar className="h-24 w-24 border-2 border-primary/10 shadow-lg">
                    <AvatarImage src={groupAvatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/5 text-primary text-2xl font-bold">
                      <Users className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <DialogDescription>
                  {isGroup ? `${members.length} membros` : "Gerenciar esta conversa"}
                </DialogDescription>
              </DialogHeader>

              {/* Members list for groups */}
              {isGroup && (
                <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-1 border rounded-lg p-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(m.first_name, m.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm font-medium truncate">
                        {m.first_name} {m.last_name}
                        {m.user_id === createdBy && (
                          <span className="ml-1 text-xs text-muted-foreground">(admin)</span>
                        )}
                        {m.user_id === user?.id && (
                          <span className="ml-1 text-xs text-muted-foreground">(você)</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {isGroup && isOwner && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setView("editGroup")}
                    >
                      <Pencil className="h-4 w-4" /> Editar nome do grupo
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setView("addMembers")}
                    >
                      <UserPlus className="h-4 w-4" /> Adicionar membros
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setView("removeMembers")}
                    >
                      <UserMinus className="h-4 w-4" /> Remover membros
                    </Button>
                  </>
                )}

                {isGroup && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                    onClick={handleLeaveConversation}
                    disabled={loading}
                  >
                    <LogOut className="h-4 w-4" /> Sair do grupo
                  </Button>
                )}

                {(isOwner || !isGroup) && (
                  <Button
                    variant="destructive"
                    className="w-full justify-start gap-2"
                    onClick={() => setConfirmDelete(true)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" /> Apagar conversa
                  </Button>
                )}
              </div>
            </>
          )}

          {view === "editGroup" && (
            <>
              <DialogHeader>
                <DialogTitle>Editar Grupo</DialogTitle>
                <DialogDescription>Altere o nome do grupo</DialogDescription>
              </DialogHeader>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nome do grupo"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setView("main")} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleEditGroup} disabled={loading || !newGroupName.trim()} className="flex-1">
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </>
          )}

          {view === "addMembers" && (
            <>
              <DialogHeader>
                <DialogTitle>Adicionar Membros</DialogTitle>
                <DialogDescription>Busque contatos para adicionar ao grupo</DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {selectedToAdd.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedToAdd.map((s) => (
                    <span
                      key={s.user_id}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                    >
                      {s.first_name}
                      <button onClick={() => toggleAddUser(s)} className="ml-1 text-primary/60 hover:text-primary">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
                {searchResults.map((u) => {
                  const isSel = selectedToAdd.some((s) => s.user_id === u.user_id);
                  return (
                    <button
                      key={u.user_id}
                      onClick={() => toggleAddUser(u)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent ${isSel ? "bg-accent" : ""}`}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {getInitials(u.first_name, u.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-left text-sm font-medium">
                        {u.first_name} {u.last_name}
                      </span>
                      {isSel && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
                {search.length < 2 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Digite pelo menos 2 letras
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setView("main")} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleAddMembers} disabled={loading || selectedToAdd.length === 0} className="flex-1">
                  {loading ? "Adicionando..." : `Adicionar (${selectedToAdd.length})`}
                </Button>
              </div>
            </>
          )}

          {view === "removeMembers" && (
            <>
              <DialogHeader>
                <DialogTitle>Remover Membros</DialogTitle>
                <DialogDescription>Toque em um membro para removê-lo do grupo</DialogDescription>
              </DialogHeader>
              <div className="max-h-60 overflow-y-auto scrollbar-thin space-y-1">
                {members
                  .filter((m) => m.user_id !== user?.id)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {getInitials(m.first_name, m.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm font-medium">
                        {m.first_name} {m.last_name}
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveMember(m)}
                        disabled={loading}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                {members.filter((m) => m.user_id !== user?.id).length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Não há outros membros para remover
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => setView("main")} className="w-full">
                Voltar
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as mensagens serão apagadas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Apagando..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
