// src/components/VoiceCallModal.tsx
import React from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { CallState } from '../types/call';

interface VoiceCallModalProps {
  callState: CallState;
  remoteUserId: string | null;
  isMuted: boolean;
  onAnswer: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  callState,
  remoteUserId,
  isMuted,
  onAnswer,
  onEndCall,
  onToggleMute,
}) => {
  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl text-white w-80">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-2xl font-bold mb-4 shadow-lg animate-pulse">
          {remoteUserId ? remoteUserId.slice(0, 2).toUpperCase() : '🎙️'}
        </div>

        <h3 className="text-xl font-semibold mb-1">
          {callState === 'incoming' && 'Incoming Voice Call...'}
          {callState === 'calling' && 'Calling...'}
          {callState === 'connected' && 'Connected'}
        </h3>
        <p className="text-sm text-gray-400 mb-8 truncate max-w-[200px]">
          User: {remoteUserId}
        </p>

        <div className="flex items-center gap-4">
          {callState === 'connected' && (
            <button
              onClick={onToggleMute}
              className={`p-4 rounded-full transition-all ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}

          {callState === 'incoming' && (
            <button
              onClick={onAnswer}
              className="p-4 rounded-full bg-green-600 hover:bg-green-700 transition-all shadow-lg animate-bounce"
              title="Answer Call"
            >
              <Phone size={22} />
            </button>
          )}

          <button
            onClick={onEndCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all shadow-lg"
            title="End Call"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};