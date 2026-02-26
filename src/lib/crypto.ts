/**
 * Utilitários de Criptografia de Ponta-a-Ponta (E2EE)
 * Usando a Web Crypto API (Nativa do Navegador)
 */

// Configurações do algoritmo RSA-OAEP
const ALGORITHM = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
};

/**
 * Gera um novo par de chaves RSA para o usuário.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
        ALGORITHM,
        true, // Chave privada pode ser exportada (para guardar no IndexedDB)
        ["encrypt", "decrypt"]
    );
}

/**
 * Exporta uma chave para o formato JWK (JSON Web Key) para salvar no banco ou localmente.
 */
export async function exportKey(key: CryptoKey): Promise<any> {
    return await window.crypto.subtle.exportKey("jwk", key);
}

/**
 * Importa uma chave do formato JWK.
 */
export async function importKey(jwk: any, type: "public" | "private"): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        ALGORITHM,
        true,
        type === "public" ? ["encrypt"] : ["decrypt"]
    );
}

/**
 * Encripta um texto usando a chave pública do destinatário.
 */
export async function encryptText(text: string, publicKey: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        data
    );

    // Converte ArrayBuffer para Base64 para envio no JSON
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

/**
 * Decripta um texto usando a chave privada do usuário logado.
 */
export async function decryptText(encryptedBase64: string, privateKey: CryptoKey): Promise<string> {
    try {
        const encryptedData = new Uint8Array(
            atob(encryptedBase64).split("").map((c) => c.charCodeAt(0))
        );

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedData
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (err) {
        // Console error removido para não poluir o log do usuário, já mostramos na UI
        return "🔒 Esta mensagem foi criptografada com uma chave antiga e não pode ser lida.";
    }
}
