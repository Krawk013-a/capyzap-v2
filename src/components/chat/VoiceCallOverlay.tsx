import React from "react";
import { useCall } from "@/providers/CallProvider";
import { Phone, PhoneOff, Mic, MicOff, User, X, Volume1, Volume2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect } from "react";

export function VoiceCallOverlay() {
    const {
        isCalling, isIncomingCall, callerName, callStatus,
        acceptCall, rejectCall, endCall, remoteStream,
        isMuted, isSpeakerOn, toggleMute, toggleSpeaker
    } = useCall();

    const audioRef = useRef<HTMLAudioElement>(null);

    console.log("[VoIP Overlay] Renderizando. Estado:", { isCalling, isIncomingCall, callStatus, callerName, hasRemoteStream: !!remoteStream });

    useEffect(() => {
        if (audioRef.current && remoteStream) {
            console.log("[VoIP] Anexando stream remoto ao elemento de áudio...", remoteStream.id);
            audioRef.current.srcObject = remoteStream;

            // Garantir que o áudio não esteja mudo
            audioRef.current.muted = false;
            audioRef.current.volume = 1.0;

            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.error("[VoIP] Erro ao dar play no áudio automático:", e);
                    // Tenta play de novo em caso de erro (alguns browsers exigem isso)
                });
            }
        }
    }, [remoteStream]);

    if (!isCalling && !isIncomingCall) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
                <div className="bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 flex flex-col items-center gap-8 shadow-2xl border border-white/10 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50" />

                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary border-2 border-primary/30 animate-pulse">
                            <User size={48} />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white mb-1">{callerName || "Chamada"}</h2>
                            <p className="text-zinc-400 capitalize flex items-center justify-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                {callStatus === 'ringing' ? (isIncomingCall ? 'Recebendo...' : 'Tocando...') :
                                    callStatus === 'calling' ? 'Chamando...' :
                                        callStatus === 'connected' ? 'Em chamada' : 'Conectando...'}
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col gap-8 w-full">
                        {/* Controles de Áudio (Mudo/Viva-voz) */}
                        <div className="flex justify-center gap-6">
                            <button
                                onClick={toggleMute}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                                title={isMuted ? "Desmutar" : "Mutar"}
                            >
                                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                            </button>
                            <button
                                onClick={toggleSpeaker}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isSpeakerOn ? 'bg-primary text-white' : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                                title={isSpeakerOn ? "Fone normal" : "Viva-voz"}
                            >
                                {isSpeakerOn ? <Volume2 size={24} /> : <Volume1 size={24} />}
                            </button>
                        </div>

                        {/* Botões Principais */}
                        <div className="flex justify-center gap-8">
                            {isIncomingCall && callStatus === 'ringing' ? (
                                <>
                                    <button
                                        onClick={rejectCall}
                                        className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all hover:scale-110"
                                    >
                                        <X size={32} />
                                    </button>
                                    <button
                                        onClick={acceptCall}
                                        className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all hover:scale-110"
                                    >
                                        <Phone size={32} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={endCall}
                                    className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all hover:scale-110"
                                >
                                    <PhoneOff size={32} />
                                </button>
                            )}
                        </div>
                    </div>

                    <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
