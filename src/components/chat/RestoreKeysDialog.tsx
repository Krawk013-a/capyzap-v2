import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Lock, LogOut } from "lucide-react";
import { restorePrivateKey } from "@/lib/crypto";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { saveKeysLocally } from "@/providers/CryptoProvider";

interface RestoreKeysDialogProps {
    open: boolean;
    encryptedKey: string;
    onRestored: () => void;
}

export function RestoreKeysDialog({ open, encryptedKey, onRestored }: RestoreKeysDialogProps) {
    console.log("[Crypto] RestoreKeysDialog MONTADO. Key length:", encryptedKey?.length);
    const [passphrase, setPassphrase] = useState("");
    const [loading, setLoading] = useState(false);
    const { signOut, profile } = useAuth();

    const handleRestore = async () => {
        if (passphrase.length < 1) return;

        setLoading(true);
        try {
            const privateKey = await restorePrivateKey(encryptedKey, passphrase);

            // Se restaurou, precisamos da chave pública do perfil para salvar o par completo
            // No CryptoProvider, a chave pública já está no Supabase.
            // Vamos assumir que a chave pública pode ser baixada do perfil.

            const { data: profData } = await (window as any).supabase
                .from("profiles")
                .select("public_key")
                .eq("user_id", profile?.user_id)
                .single();

            if (!profData?.public_key) throw new Error("Chave pública não encontrada no perfil.");

            const publicKeyJwk = JSON.parse(profData.public_key);
            const publicKey = await window.crypto.subtle.importKey(
                "jwk",
                publicKeyJwk,
                { name: "RSA-OAEP", hash: "SHA-256" },
                true,
                ["encrypt"]
            );

            // Salva no IndexedDB
            await saveKeysLocally(privateKey, publicKey);

            toast.success("Chaves restauradas com sucesso! Mensagens descriptografadas.");
            onRestored();
        } catch (err) {
            console.error("Erro na restauração:", err);
            toast.error("Senha incorreta ou falha na restauração.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-4 dark:bg-blue-900/30">
                        <KeyRound className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <DialogTitle className="text-center">Sincronização Detectada</DialogTitle>
                    <DialogDescription className="text-center">
                        Encontramos um backup de segurança para suas mensagens. Digite sua Senha de Backup para continuar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="pass-restore">Senha de Backup</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="pass-restore"
                                type="password"
                                placeholder="Sua senha de segurança"
                                className="pl-10"
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleRestore()}
                                autoFocus
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between flex-row gap-2">
                    <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
                        <LogOut className="mr-2 h-4 w-4" /> Sair
                    </Button>
                    <Button onClick={handleRestore} disabled={loading || !passphrase}>
                        {loading ? "Restaurando..." : "Desbloquear Mensagens"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
