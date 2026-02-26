import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

export const APP_VERSION = "0.8.0";

export interface ChangelogVersion {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG_HISTORY: ChangelogVersion[] = [
  {
    version: "0.8.0",
    date: "26/02/2026",
    title: "Quem Visualizou? v0.8.0 👁️",
    items: [
      "👁️ Info da Mensagem: Veja quem leu suas mensagens e a que horas",
      "👥 Rastreio em Grupos: Saiba exatamente quem visualizou em tempo real",
      "⚡ Otimizações de Performance: Carregamento de mensagens mais fluido",
    ],
  },
  {
    version: "0.7.0",
    date: "26/02/2026",
    title: "Reações & Grupos Pro v0.7.0 🎭",
    items: [
      "❤️ Reações com Emoji: Segure ou clique para reagir às mensagens",
      "✅ Confirmação de Leitura: Agora você sabe quando leram sua mensagem",
      "📸 Avatares de Grupo: Grupos agora podem ter sua própria identidade visual",
      "📢 Mensagens de Sistema: Avisos de novos membros ou mudanças no grupo",
    ],
  },
  {
    version: "0.6.0",
    date: "26/02/2026",
    title: "Anexos & Avatars v0.6.0 📸",
    items: [
      "📁 Suporte para envio de fotos e documentos (anexos)",
      "🖼️ Exibição de avatars na barra lateral e cabeçalho do chat",
      "🔄 Atualização instantânea da foto de perfil",
      "🏎️ Correção de erros 406 e melhorias de estabilidade",
      "📜 Histórico de atualizações acessível pelo menu",
    ],
  },
  {
    version: "0.5.0",
    date: "26/02/2026",
    title: "Grupos & Gerenciamento v0.5.0 👥",
    items: [
      "👥 Gerenciamento de grupos: adicionar/remover membros",
      "🗑️ Apagar conversas com confirmação",
      "🚪 Sair de grupos",
      "📋 Lista de membros do grupo com indicação de admin",
    ],
  },
];

export const CHANGELOG = CHANGELOG_HISTORY[0];

const STORAGE_KEY = `capyzap-changelog-seen-${APP_VERSION}`;

export function ChangelogBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative border-b bg-accent/60 px-4 py-3 animate-in slide-in-from-top duration-300">
      <button onClick={dismiss} className="absolute right-2 top-2 rounded-full p-1 hover:bg-accent">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-foreground">{CHANGELOG.title}</span>
      </div>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {CHANGELOG.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function VersionFooter() {
  return (
    <div className="border-t px-4 py-1.5 text-center">
      <span className="text-[10px] text-muted-foreground">
        CapyZap v{APP_VERSION} • Em desenvolvimento 🚧
      </span>
    </div>
  );
}
