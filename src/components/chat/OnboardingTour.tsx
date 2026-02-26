import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Monitor, Bell, Smartphone, Check, Smile, Star } from "lucide-react";

const STEPS = [
    {
        title: "Bem-vindo ao CapyZap! 🧢💨",
        description: "Prepare-se para a comunicação mais rápida e divertida. Vamos te mostrar o básico para você começar agora!",
        icon: <Sparkles className="h-10 w-10 text-primary" />,
    },
    {
        title: "Instale como um App (PWA) 📱",
        description: "Você sabia? Pode usar o CapyZap como um aplicativo real! No Chrome, clique no ícone de instalar na barra de busca (no PC) ou em 'Adicionar à tela inicial' no menu do navegador (no celular).",
        icon: <Smartphone className="h-10 w-10 text-blue-500" />,
    },
    {
        title: "Figurinhas & Favoritos 🎨",
        description: "Mande uma foto no chat para criar suas figurinhas instantaneamente! Recebeu uma figurinha top? Clique na estrela amarela para salvar na sua coleção!",
        icon: <Smile className="h-10 w-10 text-orange-500" />,
    },
    {
        title: "Ative Notificações 🔔",
        description: "Não perca nenhuma mensagem. Vá no menu de configurações e ative as notificações push para saber sempre que alguém te chamar.",
        icon: <Bell className="h-10 w-10 text-yellow-500" />,
    },
    {
        title: "Tudo Pronto! 🚀",
        description: "Explore os grupos, colecione figurinhas e divirta-se. O CapyZap está voando por sua conta!",
        icon: <Check className="h-10 w-10 text-green-500" />,
    }
];

export function OnboardingTour() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if (user) {
            checkTourStatus();
        }
    }, [user]);

    const checkTourStatus = async () => {
        const { data } = await supabase
            .from("profiles")
            .select("has_seen_tour")
            .eq("user_id", user?.id)
            .maybeSingle();

        if (data && !(data as any).has_seen_tour) {
            setOpen(true);
        }
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            finishTour();
        }
    };

    const finishTour = async () => {
        setOpen(false);
        await supabase
            .from("profiles")
            .update({ has_seen_tour: true } as any)
            .eq("user_id", user?.id);
    };

    if (!open) return null;

    const step = STEPS[currentStep];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="flex flex-col items-center gap-4 py-4">
                    <div className="rounded-full bg-accent p-4">
                        {step.icon}
                    </div>
                    <DialogTitle className="text-center text-xl font-bold">
                        {step.title}
                    </DialogTitle>
                    <DialogDescription className="text-center text-muted-foreground leading-relaxed">
                        {step.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-center gap-1.5 py-4">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full transition-colors ${i === currentStep ? "bg-primary" : "bg-muted"}`}
                        />
                    ))}
                </div>

                <DialogFooter className="sm:justify-center">
                    <Button onClick={handleNext} className="w-full sm:w-32">
                        {currentStep === STEPS.length - 1 ? "Começar!" : "Próximo"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
