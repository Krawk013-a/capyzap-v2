import { useState, useEffect, useRef } from "react";
import { Smile, Star, Plus, X, Search, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createSticker } from "@/lib/stickers";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Sticker {
    id: string;
    url: string;
}

interface StickerPickerProps {
    onSelect: (url: string) => void;
    onClose: () => void;
}

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
    const { user } = useAuth();
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [favorites, setFavorites] = useState<Sticker[]>([]);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            fetchStickers();
            fetchFavorites();
        }
    }, [user]);

    const fetchStickers = async () => {
        const { data } = await (supabase as any)
            .from("stickers")
            .select("id, url")
            .order("created_at", { ascending: false })
            .limit(50);
        if (data) setStickers(data);
    };

    const fetchFavorites = async () => {
        const { data } = await (supabase as any)
            .from("sticker_favorites")
            .select("sticker_id, stickers(id, url)")
            .eq("user_id", user?.id);

        if (data) {
            const favs = data.map((d: any) => d.stickers).filter(Boolean);
            setFavorites(favs);
        }
    };

    const handleCreateSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            setLoading(true);
            try {
                const url = await createSticker(file, user.id);
                if (url) {
                    // onSelect(url); // Removido: Não enviar automaticamente ao criar
                    fetchStickers();
                } else {
                    alert("Não foi possível criar a figurinha. Se o problema persistir, tente fechar outras abas do CapyZap abertas.");
                }
            } catch (err) {
                console.error("Erro no seletor:", err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="flex flex-col h-[400px] w-[350px] bg-card border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between p-3 border-b">
                <h3 className="text-sm font-semibold">Figurinhas</h3>
                <button onClick={onClose} className="p-1 hover:bg-accent rounded-full">
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            <Tabs defaultValue="all" className="flex-1 flex flex-col">
                <TabsList className="grid grid-cols-2 mx-3 mt-2">
                    <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
                    <TabsTrigger value="favs" className="text-xs flex items-center gap-1">
                        <Star className="h-3 w-3" /> Favoritas
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="flex-1 overflow-hidden p-0 m-0">
                    <ScrollArea className="h-full px-3 py-2">
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                                className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                            >
                                {loading ? (
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                ) : (
                                    <>
                                        <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="text-[10px] text-muted-foreground mt-1">Criar</span>
                                    </>
                                )}
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleCreateSticker}
                                className="hidden"
                                accept="image/*"
                            />

                            {stickers.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => onSelect(s.url)}
                                    className="aspect-square rounded-lg overflow-hidden hover:scale-105 transition-transform bg-accent/10 p-1 flex items-center justify-center border border-transparent hover:border-primary/30"
                                >
                                    <img
                                        src={s.url}
                                        alt="Sticker"
                                        className="max-w-full max-h-full object-contain"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="favs" className="flex-1 overflow-hidden p-0 m-0">
                    <ScrollArea className="h-full px-3 py-2">
                        {favorites.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-10 opacity-40">
                                <Star className="h-10 w-10 mb-2" />
                                <p className="text-xs">Nenhuma figurinha favoritada</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {favorites.map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => onSelect(s.url)}
                                        className="aspect-square rounded-lg overflow-hidden hover:scale-105 transition-transform bg-accent/10 p-1 flex items-center justify-center border border-transparent hover:border-primary/30"
                                    >
                                        <img
                                            src={s.url}
                                            alt="Sticker"
                                            className="max-w-full max-h-full object-contain"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            <div className="p-3 bg-accent/30 text-center">
                <p className="text-[10px] text-muted-foreground">Experimente criar suas próprias figurinhas!</p>
            </div>
        </div>
    );
}
