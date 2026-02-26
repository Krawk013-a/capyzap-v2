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
    const { user } = useAuth();
    const [isCalling, setIsCalling] = useState(false);
    const [isIncomingCall, setIsIncomingCall] = useState(false);
    const [callerId, setCallerId] = useState<string | null>(null);
    const [callerName, setCallerName] = useState<string | null>(null);
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);

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

    const setupPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(rtcConfig);

        pc.onicecandidate = (event) => {
            if (event.candidate && channelRef.current && callerId) {
                channelRef.current.send({
                    type: "broadcast",
                    event: "call:ice-candidate",
                    payload: { candidate: event.candidate, to: callerId }
                });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        peerConnection.current = pc;
        return pc;
    }, [callerId]);

    useEffect(() => {
        if (!user) return;

        // Canal de sinalização global para chamadas
        const channel = supabase.channel(`calls:${user.id}`, {
            config: {
                broadcast: { self: false },
            },
        });

        channel
            .on("broadcast", { event: "call:initiate" }, ({ payload }) => {
                if (callStatus !== 'idle') return; // Já está em outra chamada
                setCallerId(payload.from);
                setCallerName(payload.fromName);
                setIsIncomingCall(true);
                setCallStatus('ringing');
            })
            .on("broadcast", { event: "call:offer" }, async ({ payload }) => {
                if (!peerConnection.current) setupPeerConnection();
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await peerConnection.current?.createAnswer();
                await peerConnection.current?.setLocalDescription(answer);

                channel.send({
                    type: "broadcast",
                    event: "call:answer",
                    payload: { answer, to: payload.from }
                });
            })
            .on("broadcast", { event: "call:answer" }, async ({ payload }) => {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(payload.answer));
                setCallStatus('connected');
            })
            .on("broadcast", { event: "call:ice-candidate" }, async ({ payload }) => {
                if (payload.candidate) {
                    await peerConnection.current?.addIceCandidate(new RTCIceCandidate(payload.candidate));
                }
            })
            .on("broadcast", { event: "call:hangup" }, () => {
                cleanup();
                toast.info("Chamada encerrada pelo outro usuário.");
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, callStatus, setupPeerConnection, cleanup]);

    const initiateCall = async (targetUserId: string, targetUserName: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            setCallerId(targetUserId);
            setIsCalling(true);
            setCallStatus('calling');

            const pc = setupPeerConnection();
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            channelRef.current.send({
                type: "broadcast",
                event: "call:initiate",
                payload: { from: user?.id, fromName: `${user?.user_metadata?.first_name || 'Alguém'}`, to: targetUserId }
            });

            // Envia a oferta real
            setTimeout(() => {
                channelRef.current.send({
                    type: "broadcast",
                    event: "call:offer",
                    payload: { offer, from: user?.id, to: targetUserId }
                });
            }, 500);

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
            setCallStatus('connected');

            const pc = setupPeerConnection();
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            setIsIncomingCall(false);
            setIsCalling(true);
        } catch (err) {
            console.error("Erro ao aceitar chamada:", err);
            toast.error("Erro ao acessar microfone.");
            rejectCall();
        }
    };

    const rejectCall = () => {
        if (channelRef.current && callerId) {
            channelRef.current.send({
                type: "broadcast",
                event: "call:hangup",
                payload: { to: callerId }
            });
        }
        cleanup();
    };

    const endCall = () => {
        if (channelRef.current && callerId) {
            channelRef.current.send({
                type: "broadcast",
                event: "call:hangup",
                payload: { to: callerId }
            });
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
