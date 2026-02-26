import { supabase } from "@/integrations/supabase/client";

/**
 * Redimensiona uma imagem para 512x512px (padrão de figurinha) de forma performática.
 * Usa createImageBitmap para processamento off-thread (mais rápido em PCs fracos).
 */
export async function resizeImageForSticker(file: File): Promise<Blob> {
    const sourceBmp = await createImageBitmap(file);

    try {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext("2d", { alpha: true });

        if (!ctx) throw new Error("Não foi possível obter o contexto do canvas");

        // Calcula crop centralizado para manter aspecto 1:1
        const size = Math.min(sourceBmp.width, sourceBmp.height);
        const x = (sourceBmp.width - size) / 2;
        const y = (sourceBmp.height - size) / 2;

        ctx.clearRect(0, 0, 512, 512);

        // Desenha a imagem redimensionada
        ctx.drawImage(sourceBmp, x, y, size, size, 0, 0, 512, 512);

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Erro ao converter canvas para blob"));
            }, "image/webp", 0.5); // Qualidade balanceada para Chromebooks
        });
    } finally {
        sourceBmp.close(); // Libera memória da GPU imediatamente
    }
}

/**
 * Adiciona ou remove uma figurinha dos favoritos do usuário.
 */
export async function toggleFavoriteSticker(url: string, userId: string): Promise<boolean> {
    try {
        // Primeiro, encontrar o ID da figurinha pela URL
        const { data: sticker } = await supabase
            .from("stickers" as any)
            .select("id")
            .eq("url", url)
            .maybeSingle();

        if (!sticker) {
            // Se não existe na tabela stickers (figurinha de outro enviada sem estar no catálogo), cria ela
            const { data: newSticker, error: createError } = await (supabase as any)
                .from("stickers")
                .insert({ url, creator_id: null }) // null pois não foi o user que criou o arquivo original
                .select("id")
                .single();

            if (createError) throw createError;

            // Agora adiciona aos favoritos
            await supabase
                .from("sticker_favorites" as any)
                .insert({ user_id: userId, sticker_id: (newSticker as any).id });

            return true;
        }

        // Verifica se já é favorito
        const { data: existing } = await supabase
            .from("sticker_favorites" as any)
            .select("user_id")
            .eq("user_id", userId)
            .eq("sticker_id", (sticker as any).id)
            .maybeSingle();

        if (existing) {
            // Remove
            await supabase
                .from("sticker_favorites" as any)
                .delete()
                .eq("user_id", userId)
                .eq("sticker_id", (sticker as any).id);
            return false;
        } else {
            // Adiciona
            await supabase
                .from("sticker_favorites" as any)
                .insert({ user_id: userId, sticker_id: (sticker as any).id });
            return true;
        }
    } catch (err) {
        console.error("Erro ao favoritar figurinha:", err);
        return false;
    }
}
export async function createSticker(file: File, userId: string, retryCount = 0): Promise<string | null> {
    if (file.size > 10 * 1024 * 1024) {
        console.error("Arquivo muito grande. Limite de 10MB.");
        return null;
    }

    try {
        console.log(`Processando figurinha (Tentativa ${retryCount + 1})...`);
        const stickerBlob = await resizeImageForSticker(file);
        const fileName = `${userId}/${Date.now()}.webp`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("stickers")
            .upload(fileName, stickerBlob);

        if (uploadError) {
            if (uploadError.message?.includes("LockManager") && retryCount < 2) {
                console.warn("Retentando via LockManager...");
                await new Promise(r => setTimeout(r, 1000));
                return createSticker(file, userId, retryCount + 1);
            }
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from("stickers")
            .getPublicUrl(fileName);

        const { data: sticker, error: dbError } = await (supabase as any)
            .from("stickers")
            .insert({ url: publicUrl, creator_id: userId })
            .select()
            .single();

        if (dbError) throw dbError;

        console.log("Figurinha criada!");
        return publicUrl;
    } catch (err: any) {
        console.error("Erro ao criar figurinha:", err);
        if (err.message?.includes("timeout") && retryCount < 1) {
            return createSticker(file, userId, retryCount + 1);
        }
        return null;
    }
}
