import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

export function NotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;

    const check = () => {
      if (Notification.permission === "default" || Notification.permission === "denied") {
        if (!dismissed) setVisible(true);
      } else {
        setVisible(false);
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [dismissed]);

  const handleEnable = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    if (result === "granted") {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  if (!visible) return null;

  const isDenied = "Notification" in window && Notification.permission === "denied";

  return (
    <div className="animate-in slide-in-from-top-2 fade-in duration-300 mx-3 mt-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Notificações desativadas</p>
        <p className="text-xs text-muted-foreground">
          {isDenied
            ? "Ative nas configurações do navegador para receber alertas."
            : "Ative para ser notificado de novas mensagens."}
        </p>
      </div>
      {!isDenied && (
        <button
          onClick={handleEnable}
          className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ativar
        </button>
      )}
      <button onClick={handleDismiss} className="flex-shrink-0 rounded-full p-1 hover:bg-accent">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
