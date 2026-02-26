import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PWAUpdater() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered:', r);
            // Opcional: checar atualizações periodicamente (ex: a cada 1h)
            if (r) {
                setInterval(() => {
                    r.update();
                }, 60 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    useEffect(() => {
        if (needRefresh) {
            toast('Nova versão disponível! 🚀', {
                description: 'Deseja atualizar o CapyZap agora para ver as novidades?',
                duration: Infinity,
                action: {
                    label: 'Atualizar',
                    onClick: () => updateServiceWorker(true),
                },
                cancel: {
                    label: 'Agora não',
                    onClick: () => close(),
                },
                icon: <RefreshCw className="h-4 w-4 animate-spin-slow" />,
            });
        }
    }, [needRefresh]);

    useEffect(() => {
        if (offlineReady) {
            toast.success('App pronto para uso offline! 🌐', {
                description: 'Você pode usar o CapyZap mesmo sem internet.',
            });
        }
    }, [offlineReady]);

    return null;
}
