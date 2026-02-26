import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateKeyPair, exportKey, importKey } from "@/lib/crypto";
import { RestoreKeysDialog } from "@/components/chat/RestoreKeysDialog";

const DB_NAME = "CapyCrypto";
const STORE_NAME = "keys";
const KEY_NAME = "e2ee_private_key";

interface CryptoContextType {
    privateKey: CryptoKey | null;
    publicKey: CryptoKey | null;
    isReady: boolean;
    getOtherPublicKey: (otherUserId: string) => Promise<CryptoKey | null>;
}

const CryptoContext = createContext<CryptoContextType | undefined>(undefined);

// Helper para IndexedDB fora do componente para ser exportável
async function accessDB() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveKeysLocally(privateKey: CryptoKey, publicKey: CryptoKey) {
    const privJwk = await exportKey(privateKey);
    const pubJwk = await exportKey(publicKey);

    const db = await accessDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(privJwk, KEY_NAME);
    store.put(pubJwk, "e2ee_public_key");
    return new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
    });
}

export function CryptoProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
    const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [showRestoreDialog, setShowRestoreDialog] = useState(false);

    const getKeysLocally = async () => {
        try {
            const db = await accessDB();
            return new Promise<{ priv: any, pub: any }>((resolve) => {
                const tx = db.transaction(STORE_NAME, "readonly");
                const store = tx.objectStore(STORE_NAME);
                const reqPriv = store.get(KEY_NAME);
                const reqPub = store.get("e2ee_public_key");

                let priv: any = undefined;
                let pub: any = undefined;

                const check = () => {
                    if (priv !== undefined && pub !== undefined) {
                        resolve({ priv, pub });
                    }
                };

                reqPriv.onsuccess = () => { priv = reqPriv.result; check(); };
                reqPriv.onerror = () => { priv = null; check(); };
                reqPub.onsuccess = () => { pub = reqPub.result; check(); };
                reqPub.onerror = () => { pub = null; check(); };
            });
        } catch (e) {
            return { priv: null, pub: null };
        }
    };

    const initKeys = useCallback(async () => {
        if (!user || isInitializing) return;
        setIsInitializing(true);
        try {
            // 1. Tentar pegar chaves locais
            const localKeys = await getKeysLocally();

            if (localKeys.priv && localKeys.pub) {
                const priv = await importKey(localKeys.priv, "private");
                const pub = await importKey(localKeys.pub, "public");
                setPrivateKey(priv);
                setPublicKey(pub);
                setIsReady(true);
                return;
            }

            // 2. Se não tem local, mas tem backup no servidor
            if ((profile as any)?.encrypted_private_key) {
                setShowRestoreDialog(true);
                return;
            }

            // 3. Se não tem nada, gera um novo
            console.log("Gerando novo par de chaves E2EE...");
            const pair = await generateKeyPair();
            const privJwk = await exportKey(pair.privateKey);
            const pubJwk = await exportKey(pair.publicKey);

            await saveKeysLocally(pair.privateKey, pair.publicKey);

            // Salvar chave pública no Supabase (seja qual for a tabela que estamos usando)
            // Aqui usamos profiles para guardar a chave pública agora por simplicidade e sync
            await supabase
                .from("profiles")
                .update({ public_key: JSON.stringify(pubJwk) } as any)
                .eq("user_id", user.id);

            // Mantemos a user_public_keys para retrocompatibilidade se existir
            await (supabase as any)
                .from("user_public_keys")
                .upsert({ user_id: user.id, public_key_jwk: pubJwk });

            setPrivateKey(pair.privateKey);
            setPublicKey(pair.publicKey);
            setIsReady(true);
        } catch (err) {
            console.error("Falha ao inicializar E2EE:", err);
        } finally {
            setIsInitializing(false);
        }
    }, [user, profile, isInitializing]);

    useEffect(() => {
        if (!user || isReady) return;
        initKeys();
    }, [user, isReady, initKeys]);

    const getOtherPublicKey = async (otherUserId: string): Promise<CryptoKey | null> => {
        try {
            // Primeiro tentar via profiles
            const { data: profData } = await supabase
                .from("profiles")
                .select("public_key")
                .eq("user_id", otherUserId)
                .maybeSingle();

            if (profData?.public_key) {
                return await importKey(JSON.parse(profData.public_key), "public");
            }

            // Fallback para user_public_keys
            const { data, error } = await (supabase as any)
                .from("user_public_keys")
                .select("public_key_jwk")
                .eq("user_id", otherUserId)
                .maybeSingle();

            if (error) throw error;
            if (data?.public_key_jwk) {
                return await importKey(data.public_key_jwk, "public");
            }
            return null;
        } catch (err) {
            console.error("Erro ao buscar chave pública do destinatário:", err);
            return null;
        }
    };

    return (
        <CryptoContext.Provider value={{ privateKey, publicKey, isReady, getOtherPublicKey }}>
            {children}
            {showRestoreDialog && (profile as any)?.encrypted_private_key && (
                <RestoreKeysDialog
                    open={showRestoreDialog}
                    encryptedKey={(profile as any).encrypted_private_key}
                    onRestored={() => {
                        setShowRestoreDialog(false);
                        window.location.reload(); // Recarregar para re-inicializar com chaves locais
                    }}
                />
            )}
        </CryptoContext.Provider>
    );
}

export const useCryptoContext = () => {
    const context = useContext(CryptoContext);
    if (!context) {
        throw new Error("useCryptoContext must be used within a CryptoProvider");
    }
    return context;
};
