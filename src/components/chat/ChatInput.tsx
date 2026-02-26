import { useState, useRef, useEffect } from "react";
import { Smile, Mic, Send, X, Paperclip, FileIcon, ImageIcon } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useTheme } from "next-themes";
import { type Message } from "./MessageBubble";

interface ChatInputProps {
  onSendMessage: (content: string, replyToId?: string) => void;
  onSendAudio?: (blob: Blob, duration: number) => void;
  onSendFile?: (file: File) => void;
  onTyping?: () => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export function ChatInput({ onSendMessage, onSendAudio, onSendFile, onTyping, replyingTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  // Focus input when replying
  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    if (showEmoji) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  const handleSend = () => {
    if (selectedFile) {
      onSendFile?.(selectedFile);
      setSelectedFile(null);
      if (message.trim()) {
        onSendMessage(message.trim(), replyingTo?.id);
        setMessage("");
      }
    } else if (message.trim()) {
      onSendMessage(message.trim(), replyingTo?.id);
      setMessage("");
      setShowEmoji(false);
      onCancelReply?.();
      if (inputRef.current) inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage((prev) => prev + emoji.native);
    inputRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    // Reset input value so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (onSendAudio) onSendAudio(blob, recordingTime);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      intervalRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = (send: boolean) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current) {
      if (send) {
        mediaRecorderRef.current.stop();
      } else {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
      }
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    onTyping?.();
  };

  return (
    <div className="relative border-t bg-card px-3 py-2">
      {/* Emoji Picker */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full left-2 mb-2 z-50">
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            locale="pt"
            previewPosition="none"
            skinTonePosition="search"
          />
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-[3px] border-primary bg-accent/50 px-3 py-2 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">{replyingTo.senderName || (replyingTo.sender === "me" ? "Você" : "")}</p>
            <p className="text-xs text-muted-foreground truncate">
              {replyingTo.type === "audio" ? "🎵 Áudio" : replyingTo.content}
            </p>
          </div>
          <button onClick={onCancelReply} className="rounded-full p-1 hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* File Preview */}
      {selectedFile && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border bg-accent/30 px-3 py-2 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10">
            {selectedFile.type.startsWith("image/") ? (
              <ImageIcon className="h-5 w-5 text-primary" />
            ) : (
              <FileIcon className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{selectedFile.name}</p>
            <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={() => setSelectedFile(null)} className="rounded-full p-1 hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {isRecording ? (
        <div className="flex items-center gap-3 animate-fade-in">
          <button onClick={() => stopRecording(false)} className="rounded-full p-2 hover:bg-destructive/10">
            <X className="h-5 w-5 text-destructive" />
          </button>
          <div className="flex flex-1 items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-destructive animate-pulse-soft" />
            <span className="text-sm font-medium text-foreground">{formatTime(recordingTime)}</span>
            <span className="text-sm text-muted-foreground">Gravando...</span>
          </div>
          <button
            onClick={() => stopRecording(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className={`mb-1 rounded-full p-2 hover:bg-accent transition-colors ${showEmoji ? "bg-accent text-primary" : ""}`}
            title="Emoji"
          >
            <Smile className="h-5 w-5 text-muted-foreground" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="mb-1 rounded-full p-2 hover:bg-accent transition-colors"
            title="Anexar arquivo"
          >
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Mensagem"
            rows={1}
            className="flex-1 resize-none rounded-2xl border-0 bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {message.trim() || selectedFile ? (
            <button onClick={handleSend} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105">
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={startRecording} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105" title="Gravar áudio">
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
