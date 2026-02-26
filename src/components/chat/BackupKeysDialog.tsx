import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Lock, AlertTriangle } from "lucide-react";
import { backupPrivateKey } from "@/lib/crypto";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCrypto } from "@/hooks/useCrypto";
import { toast } from "sonner";

interface BackupKeysDialogProps {
    open: boolean;
    onClose: () => void;
}

export function BackupKeysDialog({ open, onClose }: BackupKeysDialogProps) {
    const [passphrase, setPassphrase] = useState("");
    const [confirmPassphrase, setConfirmPassphrase] = useState("");
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { privateKey } = useCrypto();

    const handleBackup = async () => {
        if (!privateKey || !user) return;
        if (passphrase.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres.");
            return;
        }
        if (passphrase !== confirmPassphrase) {
            toast.error("As senhas não coincidem.");
            return;
        }

        setLoading(true);
        try {
            const { encryptedKey, salt } = await backupPrivateKey(privateKey, passphrase);

            const { error } = await supabase
                .from("profiles")
                .update({
                    encrypted_private_key: encryptedKey,
                    key_backup_salt: salt
                } as any) // Typecast for custom columns if not yet generated
                .eq("user_id", user.id);

            if (error) throw error;

            toast.success("Backup realizado com sucesso! Suas chaves estão sincronizadas.");
            onClose();
        } catch (err) {
            console.error("Erro no backup:", err);
            toast.error("Falha ao realizar backup das chaves.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center">Backup de Chaves E2EE</DialogTitle>
                    <DialogDescription className="text-center">
                        Defina uma senha para proteger o backup de suas chaves. Você precisará dela para ler suas mensagens em outros aparelhos.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="passphrase">Senha de Backup</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="passphrase"
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                className="pl-10"
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm">Confirmar Senha</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="confirm"
                                type="password"
                                placeholder="Repita a senha"
                                className="pl-10"
                                value={confirmPassphrase}
                                onChange={(e) => setConfirmPassphrase(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                        <div className="flex gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                <strong>Importante:</strong> Se você esquecer essa senha, o CapyZap não poderá recuperar suas mensagens em novos dispositivos.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleBackup} disabled={loading || !passphrase}>
                        {loading ? "Salvando..." : "Ativar Sync Seguro"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
