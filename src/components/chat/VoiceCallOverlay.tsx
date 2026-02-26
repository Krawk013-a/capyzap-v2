import React from "react";
import { useCall } from "@/providers/CallProvider";
import { Phone, PhoneOff, Mic, MicOff, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";

export function VoiceCallOverlay() {
    const {
        isCalling, isIncomingCall, callerName, callStatus,
        acceptCall, rejectCall, endCall
    } = useCall();

    if (!isCalling && !isIncomingCall) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-6 right-6 z-[100] w-80 overflow-hidden rounded-2xl border bg-card/95 p-6 shadow-2xl backdrop-blur-sm"
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <Avatar className="h-20 w-20 border-2 border-primary shadow-lg ring-4 ring-primary/10">
                            <AvatarFallback className="bg-primary/5 text-primary text-2xl font-bold">
                                {callerName ? callerName[0].toUpperCase() : <User />}
                            </AvatarFallback>
                        </Avatar>
                        {callStatus === 'connected' && (
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-card"
                            />
                        )}
                    </div>

                    <div className="text-center">
                        <h3 className="text-lg font-bold text-foreground">
                            {callerName || "Chamada de Voz"}
                        </h3>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {callStatus === 'ringing' ? (isIncomingCall ? 'Recebendo chamada...' : 'Chamando...') :
                                callStatus === 'connected' ? 'Em chamada' :
                                    callStatus === 'calling' ? 'Iniciando...' : 'Desconectado'}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        {isIncomingCall && callStatus === 'ringing' ? (
                            <>
                                <button
                                    onClick={rejectCall}
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-110 active:scale-95"
                                    title="Recusar"
                                >
                                    <PhoneOff className="h-6 w-6" />
                                </button>
                                <button
                                    onClick={acceptCall}
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                                    title="Aceitar"
                                >
                                    <Phone className="h-6 w-6" />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={endCall}
                                className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-110 active:scale-95"
                                title="Desligar"
                            >
                                <PhoneOff className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
