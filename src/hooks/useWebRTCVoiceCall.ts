import { useCallback, useEffect, useRef, useState } from 'react';
import { CallSignal, CallState } from '../types/call';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTCVoiceCall(supabaseClient: any, currentUserId: string) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<any>(null);

  const ensureRemoteAudio = useCallback(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      remoteAudioRef.current = audio;
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setIsMuted(false);
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const sendSignal = useCallback(
    async (targetId: string, type: CallSignal['type'], payload: any) => {
      if (!supabaseClient || !currentUserId || !targetId || !channelRef.current) {
        return;
      }

      const signal: CallSignal = {
        type,
        senderId: currentUserId,
        targetId,
        payload,
      };

      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'call-signal',
          payload: signal,
        });
      } catch (error) {
        console.error('Error sending call signal:', error);
      }
    },
    [currentUserId, supabaseClient],
  );

  const endCall = useCallback(
    (notifyRemote = true) => {
      if (remoteUserId && notifyRemote) {
        void sendSignal(remoteUserId, 'hangup', {});
      }

      stopLocalStream();
      cleanupPeerConnection();
      setCallState('idle');
      setRemoteUserId(null);
    },
    [cleanupPeerConnection, remoteUserId, sendSignal, stopLocalStream],
  );

  const createPeerConnection = useCallback(
    (targetId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal(targetId, 'ice-candidate', event.candidate.toJSON());
        }
      };

      pc.ontrack = (event) => {
        ensureRemoteAudio();
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0] || null;
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      peerConnectionRef.current = pc;
      return pc;
    },
    [ensureRemoteAudio, sendSignal],
  );

  const handleIncomingOffer = useCallback(
    async (senderId: string, offer: RTCSessionDescriptionInit) => {
      const pc = peerConnectionRef.current || createPeerConnection(senderId);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(senderId, 'answer', answer);
        setRemoteUserId(senderId);
        setCallState('connected');
      } catch (error) {
        console.error('Error handling incoming offer:', error);
        endCall();
      }
    },
    [createPeerConnection, endCall, sendSignal],
  );

  useEffect(() => {
    if (!currentUserId || !supabaseClient) {
      return;
    }

    const channel = supabaseClient.channel(`voice-call:${currentUserId}`);
    channelRef.current = channel;

    const subscription = channel
      .on('broadcast', { event: 'call-signal' }, async (payload: any) => {
        const signal = payload?.payload as CallSignal | undefined;

        if (!signal || signal.targetId !== currentUserId) {
          return;
        }

        if (signal.type === 'incoming-call') {
          setRemoteUserId(signal.senderId);
          setCallState('incoming');
          return;
        }

        if (signal.type === 'offer' && signal.payload) {
          await handleIncomingOffer(signal.senderId, signal.payload as RTCSessionDescriptionInit);
          return;
        }

        if (signal.type === 'answer' && signal.payload && peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit),
            );
            setCallState('connected');
          } catch (error) {
            console.error('Error setting answer:', error);
          }
          return;
        }

        if (signal.type === 'ice-candidate' && signal.payload && peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(signal.payload as RTCIceCandidateInit),
            );
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
          return;
        }

        if (signal.type === 'hangup') {
          endCall(false);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe?.();
      supabaseClient.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUserId, endCall, handleIncomingOffer, supabaseClient]);

  const startLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    localStreamRef.current = stream;
    return stream;
  }, []);

  const startCall = useCallback(
    async (targetUserId: string) => {
      try {
        const stream = await startLocalStream();
        const pc = createPeerConnection(targetUserId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        setRemoteUserId(targetUserId);
        setCallState('calling');

        await sendSignal(targetUserId, 'incoming-call', {});
        await sendSignal(targetUserId, 'offer', offer);

        if (stream) {
          stream.getAudioTracks().forEach((track) => {
            track.enabled = true;
          });
        }
      } catch (error) {
        console.error('Error starting call:', error);
        endCall();
      }
    },
    [createPeerConnection, endCall, sendSignal, startLocalStream],
  );

  const answerCall = useCallback(async () => {
    if (!remoteUserId) {
      return;
    }

    try {
      const stream = await startLocalStream();
      if (!peerConnectionRef.current) {
        createPeerConnection(remoteUserId);
      }

      setCallState('connected');
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    } catch (error) {
      console.error('Error answering call:', error);
      endCall();
    }
  }, [createPeerConnection, endCall, remoteUserId, startLocalStream]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) {
      return;
    }

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  }, []);

  return {
    callState,
    remoteUserId,
    isMuted,
    startCall,
    answerCall,
    endCall,
    toggleMute,
  };
}
