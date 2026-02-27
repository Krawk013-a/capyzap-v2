import { Check, CheckCheck, Mic, Play, Pause, Reply, Paperclip, Info, Star } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { MessageInfoDialog } from "./MessageInfoDialog";
import { useAuth } from "@/hooks/useAuth";

export interface Message {
  id: string;
  content: string;
  type: "text" | "audio" | "image" | "file" | "system" | "sticker";
  sender: "me" | "other";
  senderName?: string;
  time: string;
  status?: "sent" | "delivered" | "read";
  audioDuration?: string;
  audioUrl?: string;
  transcription?: string;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
  reactions?: { emoji: string; user_ids: string[] }[];
  is_encrypted?: boolean;
}

function StatusIcon({ status }: { status?: string }) {
  if (!status) return null;
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5" style={{ color: "hsl(210, 100%, 52%)" }} />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
}

function AudioPlayer({ duration, audioUrl, transcription }: { duration?: string; audioUrl?: string; transcription?: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current && audioUrl) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="min-w-[200px]">
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-primary/40"
                style={{ height: `${Math.random() * 16 + 4}px` }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{duration || "0:00"}</span>
        </div>
        <Mic className="h-4 w-4 text-primary/60 flex-shrink-0" />
      </div>
      {transcription && (
        <div className="mt-2 rounded-md bg-accent/50 px-3 py-2 text-sm text-accent-foreground italic">
          📝 {transcription}
        </div>
      )}
    </div>
  );
}

import { decryptText } from "@/lib/crypto";
import { useCrypto } from "@/hooks/useCrypto";

function DecryptedText({ content, isEncrypted, isMine }: { content: string, isEncrypted: boolean, isMine: boolean }) {
  const { privateKey } = useCrypto();
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const LIMIT = 300;

  useEffect(() => {
    const handleDecrypt = async () => {
      if (!isEncrypted || !content) {
        setDecryptedText(content);
        return;
      }

      if (!privateKey) {
        // Chave ainda não carregou — vai tentar de novo quando privateKey mudar
        setDecryptedText(null);
        return;
      }

      // Novo formato: E2EE:cifra_destinatario|cifra_remetente
      if (content.startsWith("E2EE:")) {
        const parts = content.substring(5).split("|");
        if (parts.length === 2) {
          const textToDecrypt = isMine ? parts[1] : parts[0];

          // Se a parte correspondente estiver vazia (mandou sem a chave)
          if (!textToDecrypt || textToDecrypt.trim() === "") {
            setDecryptedText("🔒 Esta mensagem não foi criptografada para o seu dispositivo.");
            return;
          }

          const result = await decryptText(textToDecrypt, privateKey);
          setDecryptedText(result);
          return;
        }
      }

      // Formato antigo (sem E2EE: prefix) — só o destinatário consegue ler
      if (isMine) {
        setDecryptedText("🔒 Mensagem legível apenas no dispositivo do destinatário.");
        return;
      }

      const result = await decryptText(content, privateKey);
      setDecryptedText(result);
    };

    handleDecrypt();
  }, [content, isEncrypted, privateKey, isMine]);

  if (isEncrypted && !privateKey) {
    return <p className="text-sm text-muted-foreground italic">🔒 Carregando chaves de criptografia...</p>;
  }

  if (decryptedText === null && isEncrypted) {
    return <p className="text-sm text-muted-foreground italic">🔒 Descriptografando...</p>;
  }

  const textToShow = decryptedText || content;
  const shouldTruncate = textToShow.length > LIMIT;
  const displayText = shouldTruncate && !isExpanded ? textToShow.slice(0, LIMIT) + "..." : textToShow;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p className="text-sm text-foreground whitespace-pre-wrap break-words overflow-hidden min-w-0">
        {displayText}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] font-bold text-primary uppercase hover:underline text-left w-fit"
        >
          {isExpanded ? "Ler menos" : "Ler mais"}
        </button>
      )}
    </div>
  );
}

export function MessageBubble({
  message,
  onReply,
  onReact,
  onFavorite
}: {
  message: Message;
  onReply?: (msg: Message) => void;
  onReact?: (emoji: string) => void;
  onFavorite?: (url: string) => void;
}) {
  const { user } = useAuth();
  const [infoOpen, setInfoOpen] = useState(false);
  const isMine = message.sender === "me";

  if (message.type === "system") {
    return (
      <div className="flex justify-center my-2 animate-fade-in">
        <span className="bg-muted px-3 py-1 rounded-full text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`group flex ${isMine ? "justify-end" : "justify-start"} animate-fade-in`}>
      {/* Reply button - appears on hover */}
      {isMine && onReply && (
        <div className="self-center flex flex-col gap-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onReply(message)}
            className="rounded-full p-1.5 hover:bg-accent"
            title="Responder"
          >
            <Reply className="h-4 w-4 text-muted-foreground" />
          </button>
          {message.type === "sticker" && onFavorite && (
            <button
              onClick={() => onFavorite(message.audioUrl || "")}
              className="rounded-full p-1.5 hover:bg-accent text-yellow-500"
              title="Favoritar Figurinha"
            >
              <Star className="h-4 w-4 fill-current" />
            </button>
          )}
          {onReact && (
            <button
              onClick={() => onReact("👍")}
              className="rounded-full p-1.5 hover:bg-accent"
              title="Reagir"
            >
              <span className="text-xs opacity-60">❤️</span>
            </button>
          )}
          {isMine && (
            <button
              onClick={() => setInfoOpen(true)}
              className="rounded-full p-1.5 hover:bg-accent"
              title="Dados da Mensagem"
            >
              <Info className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}
      <div
        className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 shadow-sm break-all min-w-0 ${isMine
          ? "bg-capyzap-bubble-sent rounded-tr-sm"
          : "bg-capyzap-bubble-received rounded-tl-sm"
          }`}
      >
        {message.senderName && !isMine && (
          <p className="text-xs font-semibold text-primary mb-1">{message.senderName}</p>
        )}

        {/* Reply quote */}
        {message.replyTo && (
          <div className="mb-2 rounded-lg border-l-[3px] border-primary bg-accent/50 px-3 py-1.5">
            <p className="text-xs font-semibold text-primary">{message.replyTo.senderName}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[250px]">{message.replyTo.content}</p>
          </div>
        )}

        {message.type === "sticker" ? (
          <div className="w-[160px] h-[160px] animate-in zoom-in-50 duration-300">
            <img
              src={message.audioUrl}
              alt="Sticker"
              className="w-full h-full object-contain"
            />
          </div>
        ) : message.type === "audio" ? (
          <AudioPlayer duration={message.audioDuration} audioUrl={message.audioUrl} transcription={message.transcription} />
        ) : message.type === "image" ? (
          <div className="relative overflow-hidden rounded-lg">
            <img
              src={message.audioUrl}
              alt="Anexo"
              className="max-h-[300px] w-auto object-contain cursor-pointer transition-opacity hover:opacity-90"
              onClick={() => window.open(message.audioUrl, '_blank')}
            />
          </div>
        ) : message.type === "file" ? (
          <a
            href={message.audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg bg-accent/30 p-2 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10">
              <Paperclip className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.content}</p>
              <p className="text-[10px] text-muted-foreground">Clique para baixar</p>
            </div>
          </a>
        ) : (message.type as string) === "sticker" ? (
          <div className="w-[160px] h-[160px] animate-in zoom-in-50 duration-300">
            <img
              src={message.audioUrl}
              alt="Sticker"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <DecryptedText
              content={message.content}
              isEncrypted={!!message.is_encrypted}
              isMine={isMine}
            />
          </div>
        )}

        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-muted-foreground">{message.time}</span>
          {isMine && <StatusIcon status={message.status} />}
        </div>

        {/* Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`absolute -bottom-4 ${isMine ? "right-0" : "left-0"} flex flex-wrap gap-1 z-10`}>
            {message.reactions.map((r, i) => (
              <div
                key={i}
                className="flex items-center bg-card border rounded-full px-1.5 pt-0.5 pb-1 shadow-sm text-xs hover:bg-accent transition-colors"
                title={`${r.user_ids.length} reações`}
              >
                {r.emoji} <span className="ml-1 text-[10px] font-bold text-muted-foreground">{r.user_ids.length}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Reply button - other side */}
      {!isMine && (onReply || onReact) && (
        <div className="self-center flex flex-col gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="rounded-full p-1.5 hover:bg-accent"
              title="Responder"
            >
              <Reply className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {message.type === "sticker" && onFavorite && (
            <button
              onClick={() => onFavorite(message.audioUrl || "")}
              className="rounded-full p-1.5 hover:bg-accent text-yellow-500"
              title="Favoritar Figurinha"
            >
              <Star className="h-4 w-4 fill-current" />
            </button>
          )}
          {onReact && (
            <button
              onClick={() => onReact("👍")}
              className="rounded-full p-1.5 hover:bg-accent"
              title="Reagir"
            >
              <span className="text-xs opacity-60">❤️</span>
            </button>
          )}
        </div>
      )}
      <MessageInfoDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        messageId={message.id}
      />
    </div>
  );
}
