import { useEffect, useRef, useState } from 'react';
import { CallState } from '../types/call';

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

  useEffect(() => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabaseClient.channel(`user-call:${currentUserId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'call-signal' }, async ({ payload }: { payload: any }) => {
        const { type, senderId, payload: data } = payload;

        if (type === 'incoming-call' && callState === 'idle') {
          setRemoteUserId(senderId);
          setCallState('incoming');
        } else if (type === 'offer' && peerConnectionRef.current) {
          await handleReceiveOffer(senderId, data);
        } else if (type === 'answer' && peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data));
          setCallState('connected');
        } else if (type === 'ice-candidate' && peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data));
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        } else if (type === 'hangup') {
          endCall(false);
        }
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [currentUserId, callState]);

  const createPeerConnection = (targetId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(targetId, 'ice-candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  };

  const sendSignal = async (targetId: string, type: string, payload: any) => {
    await supabaseClient.channel(`user-call:${targetId}`).send({
      type: 'broadcast',
      event: 'call-signal',
      payload: { type, senderId: currentUserId, payload },
    });
  };

  const startCall = async (targetUserId: string) => {
    try {
      setRemoteUserId(targetUserId);
      setCallState('calling');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal(targetUserId, 'incoming-call', {});
      await sendSignal(targetUserId, 'offer', offer);
    } catch (error) {
      console.error('Error starting call:', error);
      endCall();
    }
  };

  const answerCall = async () => {
    if (!remoteUserId) return;
    try {
      setCallState('connected');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      createPeerConnection(remoteUserId);
    } catch (error) {
      console.error('Error answering call:', error);
      endCall();
    }
  };

  const handleReceiveOffer = async (senderId: string, offer: any) => {
    const pc = peerConnectionRef.current || createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal(senderId, 'answer', answer);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  const endCall = (notifyRemote = true) => {
    if (remoteUserId && notifyRemote) {
      sendSignal(remoteUserId, 'hangup', {});
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setCallState('idle');
    setRemoteUserId(null);
    setIsMuted(false);
  };

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
