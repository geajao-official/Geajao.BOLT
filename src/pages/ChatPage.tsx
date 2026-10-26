// src/components/ChatPage.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import {
  getConversations,
  getMessages,
  markMessagesRead,
  sendMessage,
  getOrCreateConversation,
  getGroups,
  getGroupMessages,
  sendGroupMessage,
  createGroup,
  leaveGroup,
} from '@/lib/chat';
import { Conversation, Message, Friend, ChatGroup, ChatGroupMessage } from '@/types';
import { getFriends } from '@/lib/friends';
import {
  ArrowLeft,
  Send,
  MessageCircle,
  Loader2,
  Plus,
  X,
  Users,
  Check,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
} from 'lucide-react';

type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface ChatPageProps {
  onBack: () => void;
  onSignOut: () => void;
  onOpenProfile: (userId: string) => void;
  initialFriendId?: string | null;
  initialConversationId?: string | null;
  initialGroupId?: string | null;
  notificationBell?: React.ReactNode;
}

export default function ChatPage({ onBack, onSignOut, initialFriendId, initialConversationId, initialGroupId, onOpenProfile, notificationBell }: ChatPageProps) {
  const { profile } = useAuth();
  
  // --- WebRTC Voice Call State & Logic (With Push Trigger & ICE Queueing) ---
  const [callState, setCallState] = useState<CallState>('idle');
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const incomingOfferRef = useRef<any>(null);
  const callStateRef = useRef<CallState>(callState);
  const iceCandidateQueueRef = useRef<any[]>([]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
  }, []);

  const currentUserId = profile?.id || '';

  const flushIceQueue = async (pc: RTCPeerConnection) => {
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding queued ICE candidate:', e);
      }
    }
  };

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel(`user-call:${currentUserId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'call-signal' }, async ({ payload }: { payload: any }) => {
        const { type, senderId, payload: data } = payload;
        const currentState = callStateRef.current;

        if (type === 'incoming-call' && currentState === 'idle') {
          setRemoteUserId(senderId);
          setCallState('incoming');
        } else if (type === 'offer') {
          incomingOfferRef.current = data;
        } else if (type === 'answer') {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data));
            await flushIceQueue(peerConnectionRef.current);
            setCallState('connected');
          }
        } else if (type === 'ice-candidate') {
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data));
            } catch (e) {
              console.error('Error adding ICE candidate:', e);
            }
          } else {
            iceCandidateQueueRef.current.push(data);
          }
        } else if (type === 'hangup') {
          endCall(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

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
        remoteAudioRef.current.play().catch((err) => {
          console.error('Error attempting to play remote audio stream:', err);
        });
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
    await supabase.channel(`user-call:${targetId}`).send({
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

      // 1. Send WebRTC real-time signaling data
      await sendSignal(targetUserId, 'incoming-call', {});
      await sendSignal(targetUserId, 'offer', offer);

      // 2. Insert a row into a 'push_triggers' table to alert background push notifications
      await supabase.from('push_triggers').insert({
        recipient_id: targetUserId,
        sender_id: currentUserId,
        title: 'Incoming Voice Call',
        body: `${profile?.full_name || 'Someone'} is calling you...`
      });

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

      const pc = createPeerConnection(remoteUserId);

      if (incomingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
        await flushIceQueue(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(remoteUserId, 'answer', answer);
        incomingOfferRef.current = null;
      }
    } catch (error) {
      console.error('Error answering call:', error);
      endCall();
    }
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

    incomingOfferRef.current = null;
    iceCandidateQueueRef.current = [];
    setCallState('idle');
    setRemoteUserId(null);
    setIsMuted(false);
  };
  // ---------------------------------------------

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeFriend, setActiveFriend] = useState<Conversation | null>(null);
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMessages, setGroupMessages] = useState<ChatGroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
    try {
      const groupData = await getGroups();
      setGroups(groupData);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('conversations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  useEffect(() => {
    if (initialFriendId && profile) {
      (async () => {
        try {
          const convId = await getOrCreateConversation(initialFriendId);
          await fetchConversations();
          openConversation(convId);
        } catch (err) {
          console.error('Failed to open conversation:', err);
        }
      })();
    } else if (initialConversationId && profile) {
      (async () => {
        try {
          await fetchConversations();
          openConversation(initialConversationId);
        } catch (err) {
          console.error('Failed to open conversation:', err);
        }
      })();
    } else if (initialGroupId && profile) {
      (async () => {
        try {
          await fetchConversations();
          openGroup(initialGroupId);
        } catch (err) {
          console.error('Failed to open group:', err);
        }
      })();
    }
  }, [initialFriendId, initialConversationId, initialGroupId, profile]);

  const openConversation = useCallback(async (convId: string) => {
    setActiveConvId(convId);
    setActiveGroup(null);
    setLoadingMessages(true);
    setMessages([]);
    setGroupMessages([]);

    try {
      const msgs = await getMessages(convId);
      setMessages(msgs);
      await markMessagesRead(convId);
      await fetchConversations();
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
    setLoadingMessages(false);
  }, [fetchConversations]);

  const openGroup = useCallback(async (groupId: string) => {
    setActiveConvId(groupId);
    setActiveFriend(null);
    setLoadingMessages(true);
    setMessages([]);
    setGroupMessages([]);

    try {
      const msgs = await getGroupMessages(groupId);
      setGroupMessages(msgs);
      await fetchConversations();
    } catch (err) {
      console.error('Failed to fetch group messages:', err);
    }
    setLoadingMessages(false);
  }, [fetchConversations]);

  const [showNewChat, setShowNewChat] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newChatLoading, setNewChatLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!showNewChat) return;
    getFriends()
      .then(setFriends)
      .catch(() => setFriends([]));
  }, [showNewChat]);

  const handleStartNewChat = async (friendId: string) => {
    setNewChatLoading(friendId);
    try {
      const convId = await getOrCreateConversation(friendId);
      setShowNewChat(false);
      await fetchConversations();
      await openConversation(convId);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
    setNewChatLoading(null);
  };

  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');

  const toggleMember = (friendId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    setCreatingGroup(true);
    setGroupError('');
    try {
      const groupId = await createGroup(groupName.trim(), selectedMembers);
      setShowNewGroup(false);
      setGroupName('');
      setSelectedMembers([]);
      await fetchConversations();
      await openGroup(groupId);
    } catch (err: any) {
      setGroupError(err?.message || 'Could not create group. Please try again.');
    }
    setCreatingGroup(false);
  };

  const handleLeaveGroup = async (groupId: string) => {
    try {
      await leaveGroup(groupId);
      setActiveConvId(null);
      await fetchConversations();
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
  };

  useEffect(() => {
    if (activeConvId) {
      const conv = conversations.find((c) => c.conversation_id === activeConvId);
      setActiveFriend(conv || null);
      const grp = groups.find((g) => g.group_id === activeConvId);
      setActiveGroup(grp || null);
    } else {
      setActiveFriend(null);
      setActiveGroup(null);
    }
  }, [activeConvId, conversations, groups]);

  useEffect(() => {
    if (!activeConvId) return;

    const isGroup = !!activeGroup;

    const channel = supabase
      .channel(`messages-${activeConvId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: isGroup ? 'chat_group_messages' : 'messages',
      }, async () => {
        if (isGroup) {
          const msgs = await getGroupMessages(activeConvId);
          setGroupMessages(msgs);
        } else {
          const msgs = await getMessages(activeConvId);
          setMessages(msgs);
          await markMessagesRead(activeConvId);
        }
        await fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConvId, activeGroup, fetchConversations]);

  const [groupMembersCache, setGroupMembersCache] = useState<Record<string, { full_name: string }>>({});

  useEffect(() => {
    if (!activeGroup) {
      setGroupMembersCache({});
      return;
    }
    import('@/lib/chat').then(({ getGroupMembers }) =>
      getGroupMembers(activeGroup.group_id)
        .then((members) => {
          const cache: Record<string, { full_name: string }> = {};
          for (const m of members) cache[m.user_id] = { full_name: m.full_name };
          setGroupMembersCache(cache);
        })
        .catch(() => setGroupMembersCache({}))
    );
  }, [activeGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, groupMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeConvId) return;
    setSending(true);
    try {
      if (activeGroup) {
        await sendGroupMessage(activeConvId, inputText.trim());
        setGroupMessages(await getGroupMessages(activeConvId));
      } else {
        await sendMessage(activeConvId, inputText.trim());
        setMessages(await getMessages(activeConvId));
      }
      setInputText('');
      await fetchConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const formatMessageTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-future relative isolate flex h-[100dvh] min-h-0 min-w-0 overflow-hidden text-amber-50 bg-[#060913]">
      <div className="chat-grid pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
      <div className="chat-aurora chat-aurora-one pointer-events-none absolute z-0" aria-hidden="true" />
      <div className="chat-aurora chat-aurora-two pointer-events-none absolute z-0" aria-hidden="true" />

      {/* Sidebar - Conversation List */}
      <div className={`chat-sidebar relative z-10 flex min-h-0 min-w-0 flex-col border-r border-amber-500/20 ${activeConvId ? 'hidden md:flex' : 'flex'} w-full shrink-0 md:w-80`}>
        <header className="chat-header border-b border-amber-500/20 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="rounded-lg p-1.5 text-amber-400/80 transition hover:bg-amber-500/10 hover:text-amber-200"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-200">
                Messages
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewGroup(true)}
                className="chat-icon-button flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 transition hover:border-amber-400 hover:text-amber-200"
                aria-label="New group"
              >
                <Users size={16} />
              </button>
              <button
                onClick={() => setShowNewChat(true)}
                className="chat-primary-icon flex h-9 w-9 items-center justify-center rounded-xl text-slate-950 font-bold transition active:scale-95"
                aria-label="New chat"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </header>

        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={24} className="animate-spin text-amber-400" />
            </div>
          ) : conversations.length === 0 && groups.length === 0 ? (
            <div className="px-4 py-20 text-center">
              <MessageCircle size={32} className="mx-auto mb-3 text-amber-500/40" />
              <p className="text-xs text-amber-400/50">
                No conversations yet. Start chatting with your friends from the Friends page.
              </p>
            </div>
          ) : (
            <>
              {groups.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-amber-400/60">
                    Groups
                  </p>
                  {groups.map((group) => (
                    <button
                      key={group.group_id}
                      onClick={() => openGroup(group.group_id)}
                      className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                        activeConvId === group.group_id
                          ? 'chat-selected'
                          : 'hover:bg-amber-500/10'
                      }`}
                    >
                      <div className="chat-group-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-950 font-bold">
                        <Users size={18} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-semibold text-amber-100">{group.name}</p>
                          {group.last_message_at && (
                            <span className="shrink-0 text-[10px] font-medium text-amber-400/50">
                              {formatTime(group.last_message_at)}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-amber-400/60">
                          {group.last_message || `${group.member_count} members`}
                        </p>
                      </div>
                      {group.unread_count > 0 && (
                        <span className="chat-unread flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold text-slate-950">
                          {group.unread_count}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
              {conversations.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-amber-400/60">
                    Direct messages
                  </p>
                  {conversations.map((conv) => (
                    <button
                      key={conv.conversation_id}
                      onClick={() => openConversation(conv.conversation_id)}
                      className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                        activeConvId === conv.conversation_id
                          ? 'chat-selected'
                          : 'hover:bg-amber-500/10'
                      }`}
                    >
                      <Avatar name={conv.friend_name} avatarUrl={conv.friend_avatar_url} size={10} />
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-amber-100">{conv.friend_name}</p>
                            <BadgeRow badge={conv.friend_badge ?? null} isAdmin={conv.friend_is_admin ?? false} size="xs" />
                          </div>
                          {conv.last_message_at && (
                            <span className="shrink-0 text-[10px] font-medium text-amber-400/50">
                              {formatTime(conv.last_message_at)}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-amber-400/60">
                          {conv.last_message || 'No messages yet'}
                        </p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="chat-unread flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold text-slate-950">
                          {conv.unread_count}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeConvId && activeFriend ? (
        <div className="chat-panel relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Active Friend Header with Call Button */}
          <header className="chat-header flex items-center justify-between border-b border-amber-500/20 px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveConvId(null)}
                className="rounded-lg p-1.5 text-amber-400/80 transition hover:bg-amber-500/10 hover:text-amber-200 md:hidden"
              >
                <ArrowLeft size={20} />
              </button>
              <Avatar name={activeFriend.friend_name} avatarUrl={activeFriend.friend_avatar_url} size={9} />
              <div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenProfile(activeFriend.friend_id)}
                    className="font-bold text-amber-100 transition hover:text-amber-300"
                  >
                    {activeFriend.friend_name}
                  </button>
                  <BadgeRow badge={activeFriend.friend_badge ?? null} isAdmin={activeFriend.friend_is_admin ?? false} size="xs" />
                </div>
                <p className="text-xs font-medium text-amber-400/60">@{activeFriend.friend_username}</p>
              </div>
            </div>

            {/* Voice Call Button */}
            <button
              onClick={() => startCall(activeFriend.friend_id)}
              className="chat-icon-button flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 transition hover:border-amber-400 hover:text-amber-200"
              title="Start Voice Call"
            >
              <Phone size={18} />
            </button>
          </header>

          {/* Messages */}
          <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
            {loadingMessages ? (
              <div className="flex justify-center py-20">
                <Loader2 size={24} className="animate-spin text-amber-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-xs text-amber-400/50">No messages yet. Say hello!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === profile?.id;
                  return (
                    <div
                      key={msg.message_id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isOwn
                            ? 'chat-bubble-own text-amber-50'
                            : 'chat-bubble-other text-amber-100'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p
                          className={`mt-1 text-[10px] font-medium ${
                            isOwn ? 'text-amber-200/70' : 'text-amber-400/50'
                          }`}
                        >
                          {formatMessageTime(msg.created_at)}
                          {isOwn && msg.read_at && ' · Read'}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="chat-composer border-t border-amber-500/20 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="chat-message-input min-w-0 flex-1 rounded-2xl border border-amber-500/20 bg-[#101733] px-4 py-3 text-sm text-amber-100 placeholder-amber-400/40 transition focus:border-amber-400/60 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={sending || !inputText.trim()}
                className="chat-send flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-950 font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : activeConvId && activeGroup ? (
        <div className="chat-panel relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Active Group Header */}
          <header className="chat-header flex items-center gap-3 border-b border-amber-500/20 px-4 py-4">
            <button
              onClick={() => setActiveConvId(null)}
              className="rounded-lg p-1.5 text-amber-400/80 transition hover:bg-amber-500/10 hover:text-amber-200 md:hidden"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="chat-group-avatar flex h-10 w-10 items-center justify-center rounded-2xl text-slate-950 font-bold">
              <Users size={16} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-100">{activeGroup.name}</p>
              <p className="text-xs font-medium text-amber-400/60">{activeGroup.member_count} members</p>
            </div>
            {activeGroup.created_by === profile?.id && (
              <button
                onClick={() => handleLeaveGroup(activeGroup.group_id)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-400/80 transition hover:bg-rose-500/10 hover:text-rose-400"
              >
                Delete group
              </button>
            )}
          </header>

          {/* Group Messages */}
          <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            {loadingMessages ? (
              <div className="flex justify-center py-20">
                <Loader2 size={24} className="animate-spin text-amber-400" />
              </div>
            ) : groupMessages.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-xs text-amber-400/50">No messages yet. Say hello!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groupMessages.map((msg) => {
                  const isOwn = msg.sender_id === profile?.id;
                  const sender = groupMembersCache[msg.sender_id];
                  return (
                    <div
                      key={msg.message_id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isOwn
                            ? 'chat-bubble-own text-amber-50'
                            : 'chat-bubble-other text-amber-100'
                        }`}
                      >
                        {!isOwn && sender && (
                          <p className="mb-0.5 text-[10px] font-bold text-amber-300">
                            {sender.full_name}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p
                          className={`mt-1 text-[10px] font-medium ${
                            isOwn ? 'text-amber-200/70' : 'text-amber-400/50'
                          }`}
                        >
                          {formatMessageTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Group Composer */}
          <div className="chat-composer border-t border-amber-500/20 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message ${activeGroup.name}...`}
                className="chat-message-input min-w-0 flex-1 rounded-2xl border border-amber-500/20 bg-[#101733] px-4 py-3 text-sm text-amber-100 placeholder-amber-400/40 transition focus:border-amber-400/60 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={sending || !inputText.trim()}
                className="chat-send flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-950 font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center">
            <MessageCircle size={48} className="mx-auto mb-4 text-amber-500/30" />
            <p className="text-sm text-amber-400/50">Select a conversation to start chatting</p>
          </div>
        </div>
      )}

      {/* New Chat Picker Modal */}
      {showNewChat && (
        <div className="chat-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="chat-modal w-full max-w-sm rounded-3xl border border-amber-500/30 p-4 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-amber-200">New Chat</h2>
              <button
                onClick={() => setShowNewChat(false)}
                className="rounded-lg p-1 text-amber-400/60 transition hover:text-amber-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {friends.length === 0 ? (
                <p className="py-8 text-center text-xs text-amber-400/50">
                  Add friends first to start a chat.
                </p>
              ) : (
                friends.map((friend) => (
                  <button
                    key={friend.friend_id}
                    onClick={() => handleStartNewChat(friend.friend_id)}
                    disabled={newChatLoading === friend.friend_id}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    <Avatar name={friend.friend_name} avatarUrl={friend.friend_avatar_url} size={9} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-amber-100 truncate">{friend.friend_name}</p>
                        <BadgeRow badge={friend.friend_badge ?? null} isAdmin={friend.friend_is_admin ?? false} size="xs" />
                      </div>
                      <p className="text-xs text-amber-400/60 truncate">@{friend.friend_username}</p>
                    </div>
                    {newChatLoading === friend.friend_id && (
                      <Loader2 size={16} className="animate-spin text-amber-400" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="chat-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="chat-modal w-full max-w-sm rounded-3xl border border-amber-500/30 p-4 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-amber-200">New Group</h2>
              <button
                onClick={() => { setShowNewGroup(false); setGroupError(''); }}
                className="rounded-lg p-1 text-amber-400/60 transition hover:text-amber-200"
              >
                <X size={18} />
              </button>
            </div>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              maxLength={50}
              className="chat-message-input mb-3 w-full rounded-xl border border-amber-500/20 bg-[#101733] px-4 py-3 text-sm text-amber-100 placeholder-amber-400/40 transition focus:border-amber-400/60 focus:outline-none"
            />
            <p className="mb-2 text-xs font-medium text-amber-400/60">
              {selectedMembers.length > 0
                ? `${selectedMembers.length} selected`
                : 'Pick at least one friend'}
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {friends.length === 0 ? (
                <p className="py-8 text-center text-xs text-amber-400/50">
                  Add friends first to create a group.
                </p>
              ) : (
                friends.map((friend) => {
                  const selected = selectedMembers.includes(friend.friend_id);
                  return (
                    <button
                      key={friend.friend_id}
                      onClick={() => toggleMember(friend.friend_id)}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                        selected ? 'bg-amber-500/20 border border-amber-500/30' : 'hover:bg-amber-500/10'
                      }`}
                    >
                      <Avatar name={friend.friend_name} avatarUrl={friend.friend_avatar_url} size={9} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-amber-100 truncate">{friend.friend_name}</p>
                          <BadgeRow badge={friend.friend_badge ?? null} isAdmin={friend.friend_is_admin ?? false} size="xs" />
                        </div>
                        <p className="text-xs text-amber-400/60 truncate">@{friend.friend_username}</p>
                      </div>
                      {selected && <Check size={16} className="text-amber-300" />}
                    </button>
                  );
                })
              )}
            </div>
            {groupError && (
              <p className="mt-2 text-xs text-rose-400">{groupError}</p>
            )}
            <button
              onClick={handleCreateGroup}
              disabled={creatingGroup || !groupName.trim() || selectedMembers.length === 0}
              className="chat-create-button mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creatingGroup ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
              Create Group
            </button>
          </div>
        </div>
      )}

      {/* --- Embedded Voice Call Modal UI --- */}
      {callState !== 'idle' && (
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
                  onClick={toggleMute}
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
                  onClick={answerCall}
                  className="p-4 rounded-full bg-green-600 hover:bg-green-700 transition-all shadow-lg animate-bounce"
                  title="Answer Call"
                >
                  <Phone size={22} />
                </button>
              )}

              <button
                onClick={() => endCall(true)}
                className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all shadow-lg"
                title="End Call"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Styling */}
      <style>{`
        .chat-future {
          isolation: isolate;
          background:
            radial-gradient(ellipse at 50% 15%, rgba(217, 119, 6, .15), transparent 50%),
            linear-gradient(180deg, #060913 0%, #0c1126 50%, #060913 100%);
          color: #fef3c7;
        }
        .chat-grid {
          background-image:
            linear-gradient(rgba(245, 158, 11, .06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245, 158, 11, .06) 1px, transparent 1px);
          background-size: 38px 38px;
          mask-image: radial-gradient(ellipse at 50% 40%, black 0%, transparent 80%);
          opacity: .45;
        }
        .chat-aurora { filter: blur(110px); opacity: .18; }
        .chat-aurora-one { top: -18rem; left: 20%; background: #d97706; }
        .chat-aurora-two { right: -16rem; bottom: -18rem; background: #92400e; }
        .chat-sidebar {
          background: linear-gradient(180deg, rgba(16, 23, 51, .96), rgba(10, 15, 36, .98)) !important;
          border-right-color: rgba(245, 158, 11, .2) !important;
          box-shadow: 18px 0 70px rgba(0, 0, 0, .4);
        }
        .chat-panel {
          background: linear-gradient(145deg, rgba(16, 23, 51, .8), rgba(10, 15, 36, .92)) !important;
        }
        .chat-header {
          background: rgba(10, 15, 36, .92) !important;
          border-color: rgba(245, 158, 11, .2) !important;
          backdrop-filter: blur(22px);
        }
        .chat-scroll button.chat-selected {
          border-color: rgba(245, 158, 11, .4) !important;
          background: linear-gradient(105deg, rgba(217, 119, 6, .25), rgba(146, 64, 14, .15)) !important;
          box-shadow: inset 3px 0 #f59e0b, 0 8px 28px rgba(0, 0, 0, .25);
        }
        .chat-scroll button:hover:not(.chat-selected) {
          border-color: rgba(245, 158, 11, .2);
          background: rgba(217, 119, 6, .1);
        }
        .chat-future input {
          background: rgba(10, 15, 36, .92) !important;
          border-color: rgba(245, 158, 11, .2) !important;
        }
        .chat-future input:focus {
          border-color: rgba(245, 158, 11, .7) !important;
          box-shadow: 0 0 0 3px rgba(217, 119, 6, .15);
        }
        .chat-panel .chat-composer {
          background: rgba(10, 15, 36, .94) !important;
          border-color: rgba(245, 158, 11, .2) !important;
        }
        .chat-message-input {
          background: rgba(16, 23, 51, .9) !important;
          border-color: rgba(245, 158, 11, .2) !important;
        }
        .chat-primary-icon, .chat-send, .chat-create-button {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%);
          box-shadow: 0 5px 25px rgba(217, 119, 6, .35);
        }
        .chat-primary-icon:hover, .chat-send:hover:not(:disabled), .chat-create-button:hover:not(:disabled) {
          box-shadow: 0 7px 30px rgba(217, 119, 6, .5);
        }
        .chat-icon-button {
          background: rgba(217, 119, 6, .12);
          border-color: rgba(245, 158, 11, .25) !important;
        }
        .chat-group-avatar, .chat-unread { 
          background: linear-gradient(135deg, #fbbf24, #f59e0b, #d97706); 
        }
        .chat-bubble-own {
          background: linear-gradient(135deg, #b45309, #78350f);
          border: 1px solid rgba(253, 230, 138, .25);
          box-shadow: 0 8px 28px rgba(180, 83, 9, .25);
        }
        .chat-bubble-other {
          background: rgba(16, 23, 51, .92);
          border: 1px solid rgba(245, 158, 11, .15);
        }
        .chat-modal-backdrop { background: rgba(6, 9, 19, .85); }
        .chat-modal {
          background: linear-gradient(145deg, rgba(16, 23, 51, .99), rgba(10, 15, 36, .99));
          border-color: rgba(245, 158, 11, .3) !important;
          box-shadow: 0 24px 90px rgba(0, 0, 0, .6), 0 0 50px rgba(217, 119, 6, .15);
        }
        .chat-scroll { scrollbar-color: rgba(245, 158, 11, .25) transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, .25); }
      `}</style>
    </div>
  );
}