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

// --- Auxiliares para Base64 ---
function b64encode(buf: ArrayBuffer | Uint8Array): string {
    const binary = String.fromCharCode(...new Uint8Array(buf));
    return btoa(binary);
}

function b64decode(str: string): Uint8Array {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// --- Key Backup & Restore ---
const BACKUP_ITERATIONS = 100000;

export async function backupPrivateKey(privateKey: CryptoKey, passphrase: string): Promise<{ encryptedKey: string, salt: string }> {
    // 1. Exporta para JWK
    const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
    const jwkString = JSON.stringify(jwk);
    const encoder = new TextEncoder();
    const data = encoder.encode(jwkString);

    // 2. Gera o salt
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    // 3. Deriva chave AES via PBKDF2
    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const aesKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: BACKUP_ITERATIONS,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    // 4. Criptografa com AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        data
    );

    // 5. Combina tudo
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return {
        encryptedKey: b64encode(combined),
        salt: b64encode(salt)
    };
}

export async function restorePrivateKey(encryptedKeyB64: string, passphrase: string): Promise<CryptoKey> {
    const combined = b64decode(encryptedKeyB64);
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);

    const encoder = new TextEncoder();

    // 1. Deriva a mesma chave AES
    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const aesKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: BACKUP_ITERATIONS,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    // 2. Decriptografa
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        data
    );

    // 3. Importa de volta
    const decoder = new TextDecoder();
    const jwkString = decoder.decode(decrypted);
    const jwk = JSON.parse(jwkString);

    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        ALGORITHM,
        true,
        ["decrypt"]
    );
}
