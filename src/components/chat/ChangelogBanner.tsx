import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

export const APP_VERSION = "0.12.1";

export interface ChangelogVersion {
  version: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG_HISTORY: ChangelogVersion[] = [
  {
    version: "0.12.1",
    date: "27 de Fev, 2026",
    title: "Correção de Bugs v0.12.1 🐛🔧",
    items: [
      "🔐 Correção de criptografia E2EE: Resolvido problema que impedia contas novas de ler mensagens",
      "🎨 Privacidade de Figurinhas: Figurinhas agora são visíveis apenas para quem as criou",
      "📋 Ordenação da Sidebar: Conversas agora seguem ordem cronológica correta",
      "🧹 Limpeza de logs: Removidos toasts e logs de debug desnecessários",
      "⚠️ Mensagens Antigas: O objetivo desta atualização foi a correção de bugs previstos com a implementação da criptografia E2EE. Mensagens antigas podem continuar criptografadas com a necessidade de uso da chave de descriptografia. Novas mensagens serão criptografadas diretamente pelo Banco de Dados",
    ]
  },
  {
    version: "0.12.0",
    date: "26 de Fev, 2026",
    title: "Ligações, Backup & Controles v0.12.0 📞🔐🎛️",
    items: [
      "📞 Chamadas de Voz (Beta): Ligue para seus contatos em tempo real via WebRTC",
      "🎛️ Controles de Chamada: Mudo, Viva-voz e interface premium de ligação",
      "🔔 Notificações de Chamada: Receba alertas mesmo com o app em segundo plano",
      "🔐 Backup de Segurança E2EE: Sincronize suas chaves entre dispositivos",
      "🔒 Restaurar Mensagens: Recupere suas mensagens criptografadas em novos aparelhos",
      "🎵 Toques Sonoros: Ringtone ao receber e tom de chamada ao ligar",
      "🛡️ Tela Sempre Ativa: A tela não apaga durante chamadas",
    ]
  },
  {
    version: "0.10.0",
    date: "26 de Fev, 2026",
    title: "Segurança & Figurinhas v0.10.0 🔐🎨",
    items: [
      "🛡️ Criptografia E2EE: Suas DMs agora são protegidas de ponta-a-ponta",
      "⭐ Favoritar Figurinhas: Salve figurinhas no seu menu de favoritos",
      "🧪 Fase Experimental: Performance em otimização contínua para dispositivos",
      "🎮 Galeria Pessoal: Crie figurinhas e envie manualmente para mais controle",
    ]
  },
  {
    version: "0.9.5",
    date: "26 de Fev, 2026",
    title: "Figurinhas & Onboarding v0.9.0 🎨",
    items: [
      "Sistema de Figurinhas (Stickers)",
      "Criação automática de figurinhas a partir de fotos",
      "Favoritar figurinhas de outras pessoas",
      "Tour interativo de Onboarding (PWA e Notificações)",
    ]
  },
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
