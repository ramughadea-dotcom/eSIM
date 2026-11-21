import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Contact2,
  Delete,
  Home,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  Moon,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smartphone,
  Sun,
  User as UserIcon,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  CallRecord,
  ChatMessage,
  ConversationItem,
  DemoOtpInfo,
  MobileScreenId,
  UserProfile,
} from '../types';
import { Avatar } from './Avatar';

interface MobileDeviceClientProps {
  deviceLabel?: string;
  defaultQuickEmail?: string;
  fullScreen?: boolean;
  globalDark: boolean;
  onToggleGlobalDark?: () => void;
  externalScreenRequest?: { screen: MobileScreenId; nonce: number } | null;
  onScreenChange?: (screen: MobileScreenId) => void;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export function MobileDeviceClient({
  deviceLabel,
  defaultQuickEmail,
  fullScreen = false,
  globalDark,
  onToggleGlobalDark,
  externalScreenRequest,
  onScreenChange,
}: MobileDeviceClientProps) {
  const [screen, setScreenState] = useState<MobileScreenId>('splash');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<UserProfile[]>([]);

  // Auth form states
  const [loginEmail, setLoginEmail] = useState(defaultQuickEmail ?? '');
  const [loginPassword, setLoginPassword] = useState(defaultQuickEmail ? 'esimconnect123' : '');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Demo OTP & Reset Password states
  const [pendingOtp, setPendingOtp] = useState<DemoOtpInfo | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState<DemoOtpInfo | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // App data states
  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);

  // Active Chat states
  const [activePeer, setActivePeer] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);

  // Dialer state
  const [dialInput, setDialInput] = useState('+91 9000');
  const [dialFeedback, setDialFeedback] = useState<string | null>(null);

  // Profile edit states
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  // Call & WebRTC states
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callPeer, setCallPeer] = useState<UserProfile | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [callStateText, setCallStateText] = useState('Calling...');
  const [callConnected, setCallConnected] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [iceStatus, setIceStatus] = useState<string>('new');
  const [copiedInvite, setCopiedInvite] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const ringIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const callPeerRef = useRef<UserProfile | null>(null);
  const activePeerRef = useRef<UserProfile | null>(null);
  const tokenRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  activeCallIdRef.current = activeCallId;
  callPeerRef.current = callPeer;
  activePeerRef.current = activePeer;
  tokenRef.current = token;

  const setScreen = setScreenState;

  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen, onScreenChange]);

  // Splash auto-advance
  useEffect(() => {
    if (screen !== 'splash') return;
    const timer = setTimeout(() => {
      setScreenState((curr) => (curr === 'splash' ? 'login' : curr));
    }, 1100);
    return () => clearTimeout(timer);
  }, [screen]);

  // Handle external screen requests from studio screen switcher
  useEffect(() => {
    if (!externalScreenRequest) return;
    const reqScreen = externalScreenRequest.screen;
    if (reqScreen === 'splash' || reqScreen === 'login' || reqScreen === 'register') {
      if (!tokenRef.current || reqScreen === 'splash') {
        setScreen(reqScreen);
      }
      return;
    }
    if (!tokenRef.current) {
      setAuthError('Sign in first to inspect authenticated screens.');
      setScreen('login');
      return;
    }
    if (reqScreen === 'private_chat' && !activePeerRef.current && directory.length > 0) {
      void openChatWithPeer(directory[0]);
      return;
    }
    if (reqScreen === 'incoming_call' || reqScreen === 'active_call') {
      return;
    }
    setScreen(reqScreen);
  }, [externalScreenRequest]);

  // Fetch demo accounts for quick sign-in
  useEffect(() => {
    fetch('/api/auth/demo-accounts')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.accounts)) setDemoAccounts(d.accounts);
      })
      .catch(() => {});
  }, []);

  // Call duration timer
  useEffect(() => {
    if (!callConnected) {
      setCallSeconds(0);
      return;
    }
    const id = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [callConnected]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const apiFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set('Content-Type', 'application/json');
      if (tokenRef.current) {
        headers.set('Authorization', `Bearer ${tokenRef.current}`);
      }
      const res = await fetch(path, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    },
    []
  );

  const refreshData = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const [meRes, contactsRes, dirRes, convoRes, callsRes] = await Promise.all([
        apiFetch('/api/users/me'),
        apiFetch('/api/users/contacts'),
        apiFetch(`/api/users/directory?q=${encodeURIComponent(contactSearch)}`),
        apiFetch('/api/messages/conversations'),
        apiFetch('/api/calls'),
      ]);
      setUser(meRes.user);
      setEditName(meRes.user.full_name);
      setEditBio(meRes.user.bio || '');
      setContacts(contactsRes.contacts || []);
      setDirectory(dirRes.users || []);
      setConversations(convoRes.conversations || []);
      setCalls(callsRes.calls || []);
    } catch {
      // Ignored during logout transitions
    }
  }, [apiFetch, contactSearch]);

  const stopRingtone = useCallback(() => {
    if (ringIntervalRef.current !== null) {
      window.clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
  }, []);

  const startRingtone = useCallback(
    (mode: 'incoming' | 'outgoing') => {
      stopRingtone();
      const playBurst = () => {
        try {
          const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!Ctx) return;
          if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') {
            void ctx.resume();
          }
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = mode === 'incoming' ? 520 : 440;
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.46);
        } catch {
          // Ignore autoplay restrictions before user gesture
        }
      };
      playBurst();
      ringIntervalRef.current = window.setInterval(playBurst, mode === 'incoming' ? 1600 : 2200);
    },
    [stopRingtone]
  );

  const cleanupWebRtc = useCallback(() => {
    stopRingtone();
    pcRef.current?.close();
    pcRef.current = null;
    pendingIceRef.current = [];
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setIsMuted(false);
    setCallConnected(false);
    setIncomingOffer(null);
    setMediaNotice(null);
    setIceStatus('new');
  }, [stopRingtone]);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale candidate
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    async (targetUserId: string) => {
      cleanupWebRtc();
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (ev) => {
        if (ev.candidate && activeCallIdRef.current) {
          socketRef.current?.emit('call:ice-candidate', {
            callId: activeCallIdRef.current,
            targetUserId,
            candidate: ev.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        setIceStatus(pc.iceConnectionState);
      };

      pc.ontrack = (ev) => {
        if (remoteAudioRef.current && ev.streams[0]) {
          remoteAudioRef.current.srcObject = ev.streams[0];
          void remoteAudioRef.current.play().catch(() => {});
        }
      };

      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = stream;
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        } else {
          pc.addTransceiver('audio', { direction: 'recvonly' });
          setMediaNotice('Audio signaling active (no browser mic detected)');
        }
      } catch {
        pc.addTransceiver('audio', { direction: 'recvonly' });
        setMediaNotice('Microphone access blocked — listening only');
      }

      return pc;
    },
    [cleanupWebRtc]
  );

  // Manage Socket.IO lifecycle when token changes
  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const sock = io('/', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = sock;

    sock.on('presence:update', () => {
      void refreshData();
    });

    sock.on('message:new', (payload: { message: ChatMessage; sender: UserProfile }) => {
      if (activePeerRef.current?.id === payload.message.sender_id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, { ...payload.message, status: 'read' }];
        });
        sock.emit('message:read', { peerId: payload.message.sender_id });
      }
      void refreshData();
    });

    sock.on('message:status', (payload: { messageId: string; status: 'delivered' | 'read' }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, status: payload.status } : m))
      );
    });

    sock.on('messages:read', (payload: { peerId: string; messageIds: string[] }) => {
      if (activePeerRef.current?.id === payload.peerId) {
        setMessages((prev) =>
          prev.map((m) => (payload.messageIds.includes(m.id) ? { ...m, status: 'read' } : m))
        );
      }
    });

    sock.on('typing:start', (payload: { userId: string }) => {
      if (activePeerRef.current?.id === payload.userId) setPeerTyping(true);
    });
    sock.on('typing:stop', (payload: { userId: string }) => {
      if (activePeerRef.current?.id === payload.userId) setPeerTyping(false);
    });

    sock.on(
      'call:incoming',
      (payload: { callId: string; caller: UserProfile; sdpOffer: RTCSessionDescriptionInit | null }) => {
        setActiveCallId(payload.callId);
        setCallPeer(payload.caller);
        setIncomingOffer(payload.sdpOffer);
        setCallStateText('Incoming voice call');
        startRingtone('incoming');
        setScreen('incoming_call');
      }
    );

    sock.on('call:accepted', async (payload: { callId: string; sdpAnswer: RTCSessionDescriptionInit | null }) => {
      stopRingtone();
      if (pcRef.current && payload.sdpAnswer) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdpAnswer));
          await flushPendingIce(pcRef.current);
        } catch {
          // Ignore SDP mismatch in local fallback
        }
      }
      setCallConnected(true);
      setCallStateText('Connected');
    });

    sock.on('call:rejected', (payload: { reason?: string }) => {
      cleanupWebRtc();
      setActiveCallId(null);
      setDialFeedback(payload.reason || 'Call declined');
      setScreen('home');
      void refreshData();
    });

    sock.on('call:ice-candidate', async (payload: { candidate: RTCIceCandidateInit }) => {
      if (!payload.candidate) return;
      if (pcRef.current && pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          // Safe ignore
        }
      } else {
        pendingIceRef.current.push(payload.candidate);
      }
    });

    sock.on('call:ended', () => {
      cleanupWebRtc();
      setActiveCallId(null);
      setScreen('home');
      void refreshData();
    });

    sock.on('account:suspended', () => {
      cleanupWebRtc();
      setToken(null);
      setUser(null);
      setAuthError('Account was suspended by an administrator.');
      setScreen('login');
    });

    void refreshData();

    return () => {
      sock.disconnect();
      cleanupWebRtc();
    };
  }, [token, cleanupWebRtc, flushPendingIce, refreshData, setScreen, startRingtone, stopRingtone]);

  // Refetch directory when search changes
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      apiFetch(`/api/users/directory?q=${encodeURIComponent(contactSearch)}`)
        .then((d) => setDirectory(d.users || []))
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [contactSearch, token, apiFetch]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setToken(data.token);
      setUser(data.user);
      setScreen('home');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName: regName, email: regEmail, password: regPassword }),
      });
      setToken(data.token);
      setUser(data.user);
      setPendingOtp(data.demoOtp);
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setAuthError(null);
    try {
      const data = await apiFetch('/api/auth/demo-otp/verify', {
        method: 'POST',
        body: JSON.stringify({ code: otpInput }),
      });
      setUser(data.user);
      setPendingOtp(null);
      setOtpInput('');
      setStatusNotice('Demo OTP verified');
      if (screen === 'register') setScreen('home');
    } catch (err) {
      setAuthError((err as Error).message);
    }
  }

  async function openChatWithPeer(peer: UserProfile) {
    setActivePeer(peer);
    setPeerTyping(false);
    setScreen('private_chat');
    try {
      const data = await apiFetch(`/api/messages/${peer.id}`);
      setMessages(data.messages || []);
      void refreshData();
    } catch {
      setMessages([]);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activePeer || !messageDraft.trim()) return;
    const body = messageDraft.trim();
    setMessageDraft('');
    socketRef.current?.emit('typing:stop', { peerId: activePeer.id });
    try {
      const data = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ receiverId: activePeer.id, body }),
      });
      setMessages((prev) => [...prev, data.message]);
      void refreshData();
    } catch {
      // Ignore error
    }
  }

  async function initiateCall(peer: UserProfile) {
    setDialFeedback(null);
    setCallPeer(peer);
    setCallConnected(false);
    setCallStateText('Connecting...');
    setScreen('active_call');
    startRingtone('outgoing');

    const pc = await createPeerConnection(peer.id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current?.emit(
      'call:initiate',
      { calleeId: peer.id, sdpOffer: offer },
      (ack: { ok: boolean; callId?: string; error?: string }) => {
        if (!ack?.ok || !ack.callId) {
          cleanupWebRtc();
          setDialFeedback(ack?.error || 'User is offline');
          setScreen('home');
          void refreshData();
          return;
        }
        setActiveCallId(ack.callId);
        setCallStateText('Ringing...');
      }
    );
  }

  async function acceptIncomingCall() {
    if (!activeCallId || !callPeer) return;
    stopRingtone();
    const pc = await createPeerConnection(callPeer.id);
    let answer: RTCSessionDescriptionInit | null = null;
    if (incomingOffer) {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      await flushPendingIce(pc);
      answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
    }
    socketRef.current?.emit('call:accept', {
      callId: activeCallId,
      callerId: callPeer.id,
      sdpAnswer: answer,
    });
    void remoteAudioRef.current?.play().catch(() => {});
    setCallConnected(true);
    setCallStateText('Connected');
    setScreen('active_call');
  }

  function rejectIncomingCall() {
    if (activeCallId && callPeer) {
      socketRef.current?.emit('call:reject', {
        callId: activeCallId,
        callerId: callPeer.id,
        reason: 'Call declined',
      });
    }
    cleanupWebRtc();
    setActiveCallId(null);
    setScreen('home');
    void refreshData();
  }

  function endActiveCall() {
    if (activeCallId && callPeer) {
      socketRef.current?.emit('call:end', {
        callId: activeCallId,
        peerId: callPeer.id,
        durationSeconds: callSeconds,
      });
    }
    cleanupWebRtc();
    setActiveCallId(null);
    setScreen('home');
    void refreshData();
  }

  async function dialByNumber() {
    setDialFeedback(null);
    try {
      const data = await apiFetch(`/api/users/lookup?number=${encodeURIComponent(dialInput)}`);
      await initiateCall(data.user);
    } catch (err) {
      setDialFeedback((err as Error).message);
    }
  }

  function handleLogout() {
    cleanupWebRtc();
    socketRef.current?.disconnect();
    setToken(null);
    setUser(null);
    setPendingOtp(null);
    setActivePeer(null);
    setScreen('login');
  }

  const formatTimer = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const showBottomTabs =
    user &&
    ['home', 'contacts', 'dialer', 'chat_list', 'profile'].includes(screen);

  return (
    <div className={`flex flex-col items-center ${fullScreen ? 'w-full' : ''}`}>
      {deviceLabel && !fullScreen && (
        <div className="mb-2 flex w-full max-w-[390px] items-center justify-between px-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          <span>{deviceLabel}</span>
          {user && (
            <span className="font-mono tabular-nums text-teal-700 dark:text-teal-400">
              {user.demo_virtual_number}
            </span>
          )}
        </div>
      )}

      {/* Hidden audio element for remote WebRTC audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline muted={!isSpeaker} className="hidden" />

      {/* App Shell Container (Fullscreen native feel on mobile/fullScreen, Android bezel on desktop studio) */}
      <div
        className={
          fullScreen
            ? 'relative flex h-[calc(100vh-57px)] w-full max-w-2xl flex-col overflow-hidden border-x border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
            : 'relative flex h-[760px] w-full max-w-[390px] flex-col overflow-hidden rounded-[36px] border-[6px] border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 shadow-xl'
        }
      >
        {!fullScreen && (
          <div
            className={`flex h-9 shrink-0 items-center justify-between px-6 text-[11px] font-medium tabular-nums ${
              screen === 'incoming_call' || screen === 'active_call'
                ? 'bg-slate-950 text-slate-200'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-200/70 dark:border-slate-800'
            }`}
          >
            <span>20:44</span>
            <div className="h-3.5 w-16 rounded-full bg-slate-900 dark:bg-slate-800" />
            <span>Internet · Wi-Fi</span>
          </div>
        )}

        {/* Screen Viewport */}
        <div className="flex-1 overflow-y-auto">
          {/* 1. SPLASH SCREEN */}
          {screen === 'splash' && (
            <div className="flex h-full flex-col items-center justify-center bg-white dark:bg-slate-950 px-8 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-700 text-white shadow-sm">
                <Smartphone className="h-9 w-9" />
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                eSIM Connect
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Open-source internet calling & messaging
              </p>
              <button
                type="button"
                onClick={() => setScreen('login')}
                className="mt-8 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
              >
                Continue to Sign In
              </button>
            </div>
          )}

          {/* 2. LOGIN SCREEN */}
          {screen === 'login' && (
            <div className="flex min-h-full flex-col justify-center bg-white dark:bg-slate-950 p-6">
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {showResetForm ? 'Reset Password' : 'Sign in to eSIM Connect'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Internet VoIP & chat using India (+91) demo IDs. Not a real SIM or telecom service.
                </p>
              </div>

              {!showResetForm ? (
                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none"
                    />
                  </div>

                  {authError && (
                    <p className="rounded-lg bg-red-50 dark:bg-red-950/50 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                      {authError}
                    </p>
                  )}
                  {statusNotice && (
                    <p className="rounded-lg bg-teal-50 dark:bg-teal-950/50 px-3 py-2 text-xs text-teal-800 dark:text-teal-300">
                      {statusNotice}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 transition-colors"
                  >
                    {authLoading ? 'Signing in...' : 'Sign In'}
                  </button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetForm(true);
                        setResetEmail(loginEmail);
                        setAuthError(null);
                      }}
                      className="text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400"
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError(null);
                        setScreen('register');
                      }}
                      className="font-semibold text-teal-700 dark:text-teal-400"
                    >
                      Create Account
                    </button>
                  </div>

                  {/* Quick local test switcher */}
                  {demoAccounts.length > 0 && (
                    <div className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-4">
                      <p className="mb-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Quick-fill seeded local demo accounts (password: <code className="font-mono">esimconnect123</code>)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {demoAccounts.map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setLoginEmail(acc.email);
                              setLoginPassword('esimconnect123');
                            }}
                            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-left hover:border-teal-600 transition-colors"
                          >
                            <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                              {acc.full_name}
                            </div>
                            <div className="truncate font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                              {acc.demo_virtual_number}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              ) : (
                <div className="space-y-3.5">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Account email"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                  {!resetOtp ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setAuthError(null);
                        try {
                          const d = await apiFetch('/api/auth/password-reset/request', {
                            method: 'POST',
                            body: JSON.stringify({ email: resetEmail }),
                          });
                          setResetOtp(d.demoOtp);
                        } catch (err) {
                          setAuthError((err as Error).message);
                        }
                      }}
                      className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Generate Demo Reset OTP
                    </button>
                  ) : (
                    <>
                      <div className="rounded-xl bg-teal-50 dark:bg-teal-950/60 p-3 text-xs text-teal-900 dark:text-teal-200">
                        <div className="font-mono text-sm font-bold">Demo OTP: {resetOtp.code}</div>
                        <div className="mt-1 opacity-85">{resetOtp.disclaimer}</div>
                      </div>
                      <input
                        type="text"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="Enter 6-digit Demo OTP"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="password"
                        value={resetNewPass}
                        onChange={(e) => setResetNewPass(e.target.value)}
                        placeholder="New password (min 6 chars)"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setAuthError(null);
                          try {
                            await apiFetch('/api/auth/password-reset/confirm', {
                              method: 'POST',
                              body: JSON.stringify({
                                email: resetEmail,
                                code: resetCode,
                                newPassword: resetNewPass,
                              }),
                            });
                            setShowResetForm(false);
                            setResetOtp(null);
                            setStatusNotice('Password updated. Sign in with your new password.');
                          } catch (err) {
                            setAuthError((err as Error).message);
                          }
                        }}
                        className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
                      >
                        Confirm Password Reset
                      </button>
                    </>
                  )}
                  {authError && <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>}
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetForm(false);
                      setResetOtp(null);
                    }}
                    className="w-full py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. REGISTRATION + DEMO OTP SCREEN */}
          {screen === 'register' && (
            <div className="flex min-h-full flex-col justify-center bg-white dark:bg-slate-950 p-6">
              {!pendingOtp ? (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Create eSIM Connect ID
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Generates a unique App ID and an India (+91 9000X) Demo Virtual Number.
                  </p>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Password (min 6 chars)"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                  {authError && <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>}
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    {authLoading ? 'Creating ID...' : 'Register & Generate Demo ID'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen('login')}
                    className="w-full py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Already registered? Sign In
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Demo OTP Verification
                  </h2>
                  <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/60 p-4">
                    <div className="text-xs font-medium text-teal-800 dark:text-teal-300">
                      Local Test Code (Demo Only)
                    </div>
                    <div className="mt-1 font-mono text-2xl font-bold tracking-widest text-teal-900 dark:text-teal-100">
                      {pendingOtp.code}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-teal-800/80 dark:text-teal-300/80">
                      {pendingOtp.disclaimer}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="Enter 6-digit Demo OTP"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-slate-100"
                  />
                  {authError && <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>}
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Verify Demo OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingOtp(null);
                      setScreen('home');
                    }}
                    className="w-full py-2 text-xs text-slate-500 dark:text-slate-400"
                  >
                    Skip for now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. HOME DASHBOARD */}
          {screen === 'home' && user && (
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {user.full_name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {user.app_user_id} · {user.otp_verified ? 'Verified' : 'Unverified'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScreen('settings')}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              {dialFeedback && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                  {dialFeedback}
                </div>
              )}

              {/* Virtual ID & Share Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <button
                  type="button"
                  onClick={() => setScreen('demo_number')}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between text-xs text-teal-700 dark:text-teal-400 font-medium">
                    <span>Your App Virtual ID · India (+91)</span>
                    <span>Internet VoIP</span>
                  </div>
                  <div className="mt-1.5 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {user.demo_virtual_number}
                  </div>
                </button>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Share ID with a friend to call/chat live
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const shareText = `Call or chat with me on eSIM Connect (${window.location.origin}) — ID: ${user.demo_virtual_number} (${user.app_user_id})`;
                      await navigator.clipboard.writeText(shareText);
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 1800);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700/10 px-2.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-700/20 whitespace-nowrap"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {copiedInvite ? 'Copied Link' : 'Share ID'}
                  </button>
                </div>
              </div>

              {/* Recent Calls */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Recent Calls
                  </h3>
                  <button
                    type="button"
                    onClick={() => setScreen('dialer')}
                    className="text-xs font-medium text-teal-700 dark:text-teal-400"
                  >
                    Open Dialer
                  </button>
                </div>
                {calls.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No calls recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {calls.slice(0, 3).map((call) => {
                      const isOut = call.caller_id === user.id;
                      const peerName = isOut ? call.callee_name : call.caller_name;
                      const peerId = isOut ? call.callee_id : call.caller_id;
                      const peerObj = directory.find((u) => u.id === peerId);
                      return (
                        <div key={call.id} className="flex items-center justify-between px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {call.status === 'missed' || call.status === 'rejected' ? (
                              <PhoneMissed className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                            ) : isOut ? (
                              <PhoneOutgoing className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
                            ) : (
                              <PhoneIncoming className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                {peerName}
                              </div>
                              <div className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                                {call.status} · {call.duration_seconds}s
                              </div>
                            </div>
                          </div>
                          {peerObj && (
                            <button
                              type="button"
                              onClick={() => initiateCall(peerObj)}
                              className="flex h-9 w-9 items-center justify-center rounded-full text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50"
                              aria-label={`Call ${peerName}`}
                            >
                              <Phone className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Recent Messages */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Recent Messages
                  </h3>
                  <button
                    type="button"
                    onClick={() => setScreen('chat_list')}
                    className="text-xs font-medium text-teal-700 dark:text-teal-400"
                  >
                    All Chats
                  </button>
                </div>
                <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  {conversations.slice(0, 3).map((convo) => (
                    <button
                      key={convo.peer.id}
                      type="button"
                      onClick={() => openChatWithPeer(convo.peer)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <Avatar
                        name={convo.peer.full_name}
                        src={convo.peer.avatar_url}
                        sizeClass="w-9 h-9"
                        online={convo.peer.is_online === 1}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {convo.peer.full_name}
                          </span>
                          {convo.unreadCount > 0 && (
                            <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                              {convo.unreadCount} new
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {convo.lastMessage.body}
                        </p>
                      </div>
                    </button>
                  ))}
                  {conversations.length === 0 && (
                    <p className="px-3.5 py-3 text-xs text-slate-500 dark:text-slate-400">
                      No messages yet.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* 5. CONTACTS SCREEN */}
          {screen === 'contacts' && user && (
            <div className="p-4 space-y-3.5">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Directory & Contacts
              </h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search name, ESC ID, or +91 9000X"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2">
                {directory.map((peer) => {
                  const isSaved = contacts.some((c) => c.id === peer.id);
                  return (
                    <div
                      key={peer.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={peer.full_name}
                          src={peer.avatar_url}
                          sizeClass="w-10 h-10"
                          online={peer.is_online === 1}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {peer.full_name}
                          </div>
                          <div className="font-mono text-[11px] tabular-nums text-teal-700 dark:text-teal-400">
                            {peer.demo_virtual_number}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {peer.is_online === 1 ? 'Online' : 'Offline'} · {peer.app_user_id}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isSaved && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch('/api/users/contacts', {
                                method: 'POST',
                                body: JSON.stringify({ contactUserId: peer.id }),
                              });
                              void refreshData();
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Save Contact"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openChatWithPeer(peer)}
                          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Message"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => initiateCall(peer)}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700/10 text-teal-700 dark:text-teal-400 hover:bg-teal-700/20"
                          title="Voice Call"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. DIALER SCREEN */}
          {screen === 'dialer' && user && (
            <div className="flex h-full flex-col justify-between p-5">
              <div className="text-center">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  India (+91) App-to-App Internet Dialer
                </p>
                <div className="mt-3 min-h-[36px] font-mono text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
                  {dialInput || '+91'}
                </div>
                {dialFeedback && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{dialFeedback}</p>
                )}
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {directory.slice(0, 3).map((peer) => (
                    <button
                      key={peer.id}
                      type="button"
                      onClick={() => setDialInput(peer.demo_virtual_number)}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-teal-600"
                    >
                      {peer.full_name.split(' ')[0]} · {peer.demo_virtual_number.slice(-5)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mx-auto grid w-full max-w-[260px] grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => setDialInput((prev) => prev + digit)}
                    className="flex h-14 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-display text-lg font-semibold text-slate-900 dark:text-white active:scale-95 transition-transform"
                  >
                    {digit}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-5 pb-2">
                <button
                  type="button"
                  onClick={async () => {
                    setDialFeedback(null);
                    try {
                      const data = await apiFetch(`/api/users/lookup?number=${encodeURIComponent(dialInput)}`);
                      await openChatWithPeer(data.user);
                    } catch (err) {
                      setDialFeedback((err as Error).message);
                    }
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-teal-600"
                  aria-label="Message Number"
                  title="Message User"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={dialByNumber}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-md hover:bg-teal-800 active:scale-95 transition-transform"
                  aria-label="Start Voice Call"
                >
                  <PhoneCall className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setDialInput((prev) => prev.slice(0, -1))}
                  className="flex h-12 w-12 items-center justify-center rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  aria-label="Backspace"
                >
                  <Delete className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* 7. INCOMING CALL SCREEN */}
          {screen === 'incoming_call' && callPeer && (
            <div className="flex h-full flex-col items-center justify-between bg-slate-950 px-6 py-12 text-white">
              <div className="text-center">
                <p className="text-xs font-medium text-teal-400">Incoming Internet Voice Call</p>
                <div className="mt-6 flex justify-center">
                  <Avatar name={callPeer.full_name} src={callPeer.avatar_url} sizeClass="w-24 h-24" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold">{callPeer.full_name}</h2>
                <p className="mt-1 font-mono text-sm tabular-nums text-slate-400">
                  {callPeer.demo_virtual_number}
                </p>
              </div>

              <div className="flex w-full max-w-[240px] items-center justify-between pb-4">
                <button
                  type="button"
                  onClick={rejectIncomingCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                  aria-label="Reject Call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={acceptIncomingCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  aria-label="Accept Call"
                >
                  <Phone className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}

          {/* 8. ACTIVE CALL SCREEN */}
          {screen === 'active_call' && callPeer && (
            <div className="flex h-full flex-col items-center justify-between bg-slate-950 px-6 py-12 text-white">
              <div className="text-center">
                <p className="font-mono text-xs tabular-nums text-teal-400">
                  {callConnected ? `Connected · ${formatTimer(callSeconds)}` : callStateText}
                </p>
                <div className="mt-6 flex justify-center">
                  <Avatar name={callPeer.full_name} src={callPeer.avatar_url} sizeClass="w-24 h-24" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold">{callPeer.full_name}</h2>
                <p className="mt-1 font-mono text-sm tabular-nums text-slate-400">
                  {callPeer.demo_virtual_number}
                </p>
                <p className="mt-2 font-mono text-[11px] text-slate-400">
                  WebRTC Audio: {iceStatus}
                </p>
                {mediaNotice && (
                  <div className="mt-3 max-w-[280px] rounded-xl border border-amber-500/30 bg-amber-950/50 p-3 text-[11px] leading-relaxed text-amber-200">
                    <div>{mediaNotice}</div>
                    <div className="mt-1 text-amber-300/80">
                      Tip: Open the Shared App URL directly in a browser tab (outside preview iframe) and allow Microphone.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex w-full max-w-[300px] items-center justify-between pb-4">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isMuted;
                    setIsMuted(next);
                    localStreamRef.current?.getAudioTracks().forEach((t) => {
                      t.enabled = !next;
                    });
                  }}
                  className={`flex h-13 w-13 items-center justify-center rounded-full transition-colors ${
                    isMuted ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                  }`}
                  aria-label="Toggle Mute"
                  title="Mute / Unmute"
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => void openChatWithPeer(callPeer)}
                  className="flex h-13 w-13 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700"
                  aria-label="Open Chat"
                  title="Chat with Peer"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={endActiveCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                  aria-label="End Call"
                  title="End Call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsSpeaker((s) => !s)}
                  className={`flex h-13 w-13 items-center justify-center rounded-full transition-colors ${
                    isSpeaker ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                  }`}
                  aria-label="Toggle Speaker"
                  title="Speaker"
                >
                  {isSpeaker ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          {/* 9. CHAT LIST SCREEN */}
          {screen === 'chat_list' && user && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Messages
                </h2>
                <button
                  type="button"
                  onClick={() => setScreen('contacts')}
                  className="text-xs font-medium text-teal-700 dark:text-teal-400"
                >
                  New Chat
                </button>
              </div>
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {conversations.map((c) => (
                  <button
                    key={c.peer.id}
                    type="button"
                    onClick={() => openChatWithPeer(c.peer)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <Avatar
                      name={c.peer.full_name}
                      src={c.peer.avatar_url}
                      sizeClass="w-10 h-10"
                      online={c.peer.is_online === 1}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {c.peer.full_name}
                        </span>
                        <span className="text-[10px] tabular-nums text-slate-400">
                          {new Date(c.lastMessage.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {c.lastMessage.body}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="shrink-0 font-mono text-[11px] font-bold text-teal-700 dark:text-teal-400">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {conversations.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No active threads. Pick a contact to send your first internet message.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 10. PRIVATE CHAT SCREEN */}
          {screen === 'private_chat' && user && activePeer && (
            <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setScreen('chat_list');
                      void refreshData();
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar
                    name={activePeer.full_name}
                    src={activePeer.avatar_url}
                    sizeClass="w-8 h-8"
                    online={activePeer.is_online === 1}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {activePeer.full_name}
                    </div>
                    <div className="truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {peerTyping ? 'Typing...' : activePeer.demo_virtual_number}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => initiateCall(activePeer)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50"
                  aria-label="Voice Call"
                >
                  <Phone className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                {messages.map((m) => {
                  const isMine = m.sender_id === user.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          isMine
                            ? 'bg-teal-700 text-white'
                            : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <p>{m.body}</p>
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums ${
                            isMine ? 'text-teal-100/80' : 'text-slate-400'
                          }`}
                        >
                          <span>
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMine &&
                            (m.status === 'read' ? (
                              <CheckCheck className="h-3 w-3 text-teal-200" />
                            ) : m.status === 'delivered' ? (
                              <CheckCheck className="h-3 w-3 opacity-70" />
                            ) : (
                              <Check className="h-3 w-3 opacity-70" />
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
              >
                <input
                  type="text"
                  value={messageDraft}
                  onChange={(e) => {
                    setMessageDraft(e.target.value);
                    socketRef.current?.emit(e.target.value ? 'typing:start' : 'typing:stop', {
                      peerId: activePeer.id,
                    });
                  }}
                  placeholder="Write internet message..."
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white hover:bg-teal-800"
                  aria-label="Send Message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {/* 11. DEMO NUMBER SCREEN */}
          {screen === 'demo_number' && user && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScreen('home')}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Demo Virtual Number
                </h2>
              </div>

              <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 p-5">
                <div className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">
                  DEMO VIRTUAL ID · INDIA (+91)
                </div>
                <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-teal-950 dark:text-white">
                  {user.demo_virtual_number}
                </div>
                <div className="mt-1 text-xs text-teal-800 dark:text-teal-300">
                  App User ID: {user.app_user_id}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                This virtual identifier uses India (+91 9000X XXXXX) display formatting strictly for
                app-to-app internet routing inside eSIM Connect. It is not a real cellular SIM, eSIM
                carrier profile, or PSTN number and cannot place telecom calls or receive real SMS.
              </div>

              <button
                type="button"
                onClick={async () => {
                  const data = await apiFetch('/api/users/me', {
                    method: 'PATCH',
                    body: JSON.stringify({ regenerateDemoNumber: true }),
                  });
                  setUser(data.user);
                }}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 hover:border-teal-600"
              >
                <RefreshCw className="h-4 w-4" />
                Generate New Demo ID
              </button>
            </div>
          )}

          {/* 12. PROFILE SCREEN */}
          {screen === 'profile' && user && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Profile
                </h2>
                <button
                  type="button"
                  onClick={() => setScreen('settings')}
                  className="text-xs font-medium text-teal-700 dark:text-teal-400"
                >
                  Settings
                </button>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <Avatar name={user.full_name} src={user.avatar_url} sizeClass="w-14 h-14" online />
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-bold text-slate-900 dark:text-white">
                    {user.full_name}
                  </div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                  <div className="mt-1 font-mono text-xs tabular-nums text-teal-700 dark:text-teal-400">
                    {user.demo_virtual_number} · {user.app_user_id}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Bio"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const data = await apiFetch('/api/users/me', {
                      method: 'PATCH',
                      body: JSON.stringify({ fullName: editName, bio: editBio }),
                    });
                    setUser(data.user);
                    setStatusNotice('Profile saved');
                  }}
                  className="w-full min-h-[42px] rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white"
                >
                  Save Profile
                </button>
              </div>

              {user.otp_verified === 0 && (
                <div className="space-y-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Demo OTP Verification
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const d = await apiFetch('/api/auth/demo-otp/generate', { method: 'POST' });
                        setPendingOtp(d.demoOtp);
                      }}
                      className="text-xs font-medium text-teal-700 dark:text-teal-400"
                    >
                      Generate Demo OTP
                    </button>
                  </div>
                  {pendingOtp && (
                    <>
                      <div className="rounded-lg bg-teal-50 dark:bg-teal-950/60 p-2.5 text-xs text-teal-900 dark:text-teal-200">
                        <span className="font-mono font-bold">Code: {pendingOtp.code}</span> · Local test only
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          placeholder="6-digit OTP"
                          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Verify
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}

          {/* 13. SETTINGS SCREEN */}
          {screen === 'settings' && user && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScreen('profile')}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Settings
                </h2>
              </div>

              <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      Appearance Theme
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {globalDark ? 'Dark mode active' : 'Light mode active'}
                    </div>
                  </div>
                  {onToggleGlobalDark && (
                    <button
                      type="button"
                      onClick={onToggleGlobalDark}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200"
                    >
                      {globalDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                      {globalDark ? 'Light' : 'Dark'}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setScreen('demo_number')}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      Demo Virtual Number
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {user.demo_virtual_number}
                    </div>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                </button>

                <div className="p-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  100% Free & Open-Source Stack: Kotlin Jetpack Compose, Express.js, Socket.IO,
                  SQLite, and WebRTC STUN.
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Android Bottom Navigation Bar */}
        {showBottomTabs && (
          <nav className="grid h-16 shrink-0 grid-cols-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {[
              { id: 'home' as const, label: 'Home', icon: Home },
              { id: 'contacts' as const, label: 'Contacts', icon: Contact2 },
              { id: 'dialer' as const, label: 'Dialer', icon: Phone },
              { id: 'chat_list' as const, label: 'Chats', icon: MessageSquare },
              { id: 'profile' as const, label: 'Profile', icon: UserIcon },
            ].map((tab) => {
              const IconComp = tab.icon;
              const active = screen === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScreen(tab.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                    active
                      ? 'text-teal-700 dark:text-teal-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <IconComp className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
