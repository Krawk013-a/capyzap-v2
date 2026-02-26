import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CallContextType {
    isCalling: boolean;
    isIncomingCall: boolean;
    callerId: string | null;
    callerName: string | null;
    callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
    initiateCall: (targetUserId: string, targetUserName: string) => void;
    acceptCall: () => void;
    rejectCall: () => void;
    endCall: () => void;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const [isCalling, setIsCalling] = useState(false);
    const [isIncomingCall, setIsIncomingCall] = useState(false);
    const [callerId, setCallerId] = useState<string | null>(null);
    const [callerName, setCallerName] = useState<string | null>(null);
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const receiveChannelRef = useRef<any>(null);

    // Configuração dos servidores STUN (Google)
    const rtcConfig = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
        ],
    };

    const cleanup = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if (remoteStream) {
            setRemoteStream(null);
        }
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        setIsCalling(false);
        setIsIncomingCall(false);
        setCallerId(null);
        setCallerName(null);
        setCallStatus('idle');
    }, [localStream, remoteStream]);

    const sendSignal = useCallback(async (targetId: string, event: string, payload: any) => {
        const tempChannel = supabase.channel(`calls:${targetId}`);
        tempChannel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
                await tempChannel.send({
                    type: "broadcast",
                    event,
                    payload: { ...payload, from: user?.id, to: targetId }
                });
                // Podemos remover o canal temporário logo após o envio se não for persistente
                // Mas para ICE candidates pode ser melhor manter. No momento, removemos para evitar o aviso de fallback.
                setTimeout(() => supabase.removeChannel(tempChannel), 1000);
            }
        });
    }, [user?.id]);

    const setupPeerConnection = useCallback((targetId: string) => {
        const pc = new RTCPeerConnection(rtcConfig);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal(targetId, "call:ice-candidate", { candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        peerConnection.current = pc;
        return pc;
    }, [sendSignal]);

    useEffect(() => {
        if (!user) return;

        // Canal de sinalização para RECEBER chamadas
        const channel = supabase.channel(`calls:${user.id}`, {
            config: {
                broadcast: { self: false },
            },
        });

        channel
            .on("broadcast", { event: "call:initiate" }, ({ payload }) => {
                if (callStatus !== 'idle') return;
                setCallerId(payload.from);
                setCallerName(payload.fromName);
                setIsIncomingCall(true);
                setCallStatus('ringing');
            })
            .on("broadcast", { event: "call:offer" }, async ({ payload }) => {
                const pc = setupPeerConnection(payload.from);
                await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            })
            .on("broadcast", { event: "call:answer" }, async ({ payload }) => {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(payload.answer));
                setCallStatus('connected');
            })
            .on("broadcast", { event: "call:ice-candidate" }, async ({ payload }) => {
                if (payload.candidate) {
                    try {
                        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } catch (e) {
                        console.error("Erro ao adicionar ICE candidate:", e);
                    }
                }
            })
            .on("broadcast", { event: "call:hangup" }, () => {
                cleanup();
                toast.info("Chamada encerrada.");
            })
            .subscribe();

        receiveChannelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, callStatus, setupPeerConnection, cleanup]);

    const initiateCall = async (targetUserId: string, targetUserName: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            setCallerId(targetUserId);
            setCallerName(targetUserName);
            setIsCalling(true);
            setCallStatus('calling');

            const pc = setupPeerConnection(targetUserId);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Sinaliza o início
            await sendSignal(targetUserId, "call:initiate", {
                fromName: `${user?.user_metadata?.first_name || 'Alguém'}`
            });

            // Envia a oferta
            setTimeout(() => {
                sendSignal(targetUserId, "call:offer", { offer });
            }, 1000);

        } catch (err) {
            console.error("Erro ao iniciar chamada:", err);
            toast.error("Não foi possível acessar o microfone.");
            cleanup();
        }
    };

    const acceptCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);

            if (!peerConnection.current || !callerId) return;

            const pc = peerConnection.current;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await sendSignal(callerId, "call:answer", { answer });

            setIsIncomingCall(false);
            setIsCalling(true);
            setCallStatus('connected');
        } catch (err) {
            console.error("Erro ao aceitar chamada:", err);
            toast.error("Erro ao acessar microfone.");
            rejectCall();
        }
    };

    const rejectCall = () => {
        if (callerId) {
            sendSignal(callerId, "call:hangup", {});
        }
        cleanup();
    };

    const endCall = () => {
        if (callerId) {
            sendSignal(callerId, "call:hangup", {});
        }
        cleanup();
    };

    return (
        <CallContext.Provider value={{
            isCalling, isIncomingCall, callerId, callerName, callStatus,
            initiateCall, acceptCall, rejectCall, endCall,
            localStream, remoteStream
        }}>
            {children}
        </CallContext.Provider>
    );
}

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error("useCall must be used within a CallProvider");
    return context;
};
