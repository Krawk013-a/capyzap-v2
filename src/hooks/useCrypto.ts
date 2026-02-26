import { useCryptoContext } from "@/providers/CryptoProvider";

/**
 * Hook para gerenciar as chaves de criptografia do usuário.
 * Agora consome os dados do CryptoProvider global.
 */
export function useCrypto() {
    return useCryptoContext();
}
