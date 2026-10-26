export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

export interface CallSignal {
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  senderId: string;
  targetId: string;
  payload?: any;
}
