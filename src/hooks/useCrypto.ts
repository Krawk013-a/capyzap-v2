import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateKeyPair, exportKey, importKey } from "@/lib/crypto";

const DB_NAME = "CapyCrypto";
const STORE_NAME = "keys";
const KEY_NAME = "e2ee_private_key";

/**
 * Hook para gerenciar as chaves de criptografia do usuário.
 */
export function useCrypto() {
    const { user } = useAuth();
    const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
    const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Salva/Recupera do IndexedDB (Seguro, pois não sai do dispositivo)
    const accessDB = useCallback(async (mode: IDBTransactionMode) => {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, []);

    const saveKeysLocally = async (privJwk: any, pubJwk: any) => {
        const db = await accessDB("readwrite");
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(privJwk, KEY_NAME);
        store.put(pubJwk, "e2ee_public_key");
    };

    const getKeysLocally = async () => {
        const db = await accessDB("readonly");
        return new Promise<{ priv: any, pub: any }>((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const reqPriv = store.get(KEY_NAME);
            const reqPub = store.get("e2ee_public_key");

            let priv: any = null;
            let pub: any = null;

            reqPriv.onsuccess = () => {
                priv = reqPriv.result;
                if (pub !== undefined) resolve({ priv, pub });
            };
            reqPub.onsuccess = () => {
                pub = reqPub.result;
                if (priv !== undefined) resolve({ priv, pub });
            };
        });
    };

    useEffect(() => {
        if (!user) return;

        const initKeys = async () => {
            try {
                // 1. Tentar pegar chaves locais
                const localKeys = await getKeysLocally();

                if (localKeys.priv && localKeys.pub) {
                    const priv = await importKey(localKeys.priv, "private");
                    const pub = await importKey(localKeys.pub, "public");
                    setPrivateKey(priv);
                    setPublicKey(pub);
                    setIsReady(true);

                    // Garantir que o Supabase está atualizado
                    await (supabase as any)
                        .from("user_public_keys")
                        .upsert({ user_id: user.id, public_key_jwk: localKeys.pub });

                    return;
                }

                // 2. Se não tem par completo local, gera um novo
                console.log("Gerando novo par de chaves E2EE...");
                const pair = await generateKeyPair();
                const privJwk = await exportKey(pair.privateKey);
                const pubJwk = await exportKey(pair.publicKey);

                // 3. Salva localmente e no Supabase
                await saveKeysLocally(privJwk, pubJwk);
                await (supabase as any)
                    .from("user_public_keys")
                    .upsert({ user_id: user.id, public_key_jwk: pubJwk });

                setPrivateKey(pair.privateKey);
                setPublicKey(pair.publicKey);
                setIsReady(true);
            } catch (err) {
                console.error("Falha ao inicializar E2EE:", err);
            }
        };

        initKeys();
    }, [user]);

    /**
     * Busca a chave pública de outro usuário no Supabase.
     */
    const getOtherPublicKey = async (otherUserId: string): Promise<CryptoKey | null> => {
        try {
            const { data, error } = await (supabase as any)
                .from("user_public_keys")
                .select("public_key_jwk")
                .eq("user_id", otherUserId)
                .maybeSingle();

            if (error) throw error;

            if (data?.public_key_jwk) {
                return await importKey(data.public_key_jwk, "public");
            }

            console.warn(`Chave pública não encontrada para o usuário ${otherUserId}. As mensagens para ele não serão criptografadas.`);
            return null;
        } catch (err) {
            console.error("Erro ao buscar chave pública do destinatário:", err);
            return null;
        }
    };

    return { privateKey, publicKey, isReady, getOtherPublicKey };
}
