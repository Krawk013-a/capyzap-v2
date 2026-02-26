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

    const saveKeyLocally = async (jwk: any) => {
        const db = await accessDB("readwrite");
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(jwk, KEY_NAME);
    };

    const getKeyLocally = async () => {
        const db = await accessDB("readonly");
        return new Promise<any>((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(KEY_NAME);
            req.onsuccess = () => resolve(req.result);
        });
    };

    useEffect(() => {
        if (!user) return;

        const initKeys = async () => {
            try {
                // 1. Tentar pegar chave local
                let localJwk = await getKeyLocally();

                if (localJwk) {
                    const priv = await importKey(localJwk, "private");
                    setPrivateKey(priv);

                    // Buscar a pública correspondente
                    const { data } = await (supabase as any)
                        .from("user_public_keys")
                        .select("public_key_jwk")
                        .eq("user_id", user.id)
                        .maybeSingle();

                    if (data?.public_key_jwk) {
                        const pub = await importKey(data.public_key_jwk, "public");
                        setPublicKey(pub);
                    }

                    setIsReady(true);
                    return;
                }

                // 2. Se não tem local, gera um par novo
                console.log("Gerando novo par de chaves E2EE...");
                const pair = await generateKeyPair();
                const privJwk = await exportKey(pair.privateKey);
                const pubJwk = await exportKey(pair.publicKey);

                // 3. Salva privada no PC e pública no Supabase
                await saveKeyLocally(privJwk);
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
