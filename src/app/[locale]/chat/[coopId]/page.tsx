"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  setDoc,
  query, 
  orderBy, 
  limit,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';
import { BrandedLoader } from '@/components/BrandedLoader';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  messageText: string;
  isAudio: boolean;
  audioDuration?: string;
  timestamp: any;
  systemMessageType?: string;
  systemMessageMetadata?: {
    name: string;
  };
}

interface OrderData {
  id: string;
  buyerName: string;
  item: string;
  quantity: number;
  price: number;
  deadline: string;
  status: string;
  enteredBy?: string;
  enteredAt?: any;
  buyerConfirmed?: boolean;
  buyerConfirmedAt?: any;
}

interface MemberResponse {
  memberId: string;
  response: 'agree' | 'concern' | 'reject';
  note?: string;
}

export default function GroupChatPage() {
  const t = useTranslations('screen3');
  const tScreen1 = useTranslations('screen1');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, memberProfile, loading: authLoading } = useAuth();
  
  const coopId = (params.coopId as string) || 'coop-kanchipuram';
  const locale = (params.locale as string) || 'en';
  const orderId = searchParams.get('orderId') || 'order-8922';
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderData | null>(null);
  const [responsesCount, setResponsesCount] = useState({ agreed: 0, rejected: 0, concerned: 0, total: 5 });
  const [userResponse, setUserResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  interface MemberData {
    id: string;
    coopId: string;
    name: string;
    role: 'admin' | 'weaver' | 'treasurer';
    phone: string;
    capacity?: number;
    age?: number;
    experience?: number;
    specialization?: string;
    area?: string;
  }
  const [membersList, setMembersList] = useState<MemberData[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeVoicePlaying, setActiveVoicePlaying] = useState<string | null>(null);
  
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [modalMode, setModalMode] = useState<'reject' | 'concern' | null>(null);
  const [freeTextReason, setFreeTextReason] = useState('');
  
  const [toastMsg, setToastMsg] = useState('');
  const recognitionRef = useRef<any>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const translateSystemMessage = (msg: ChatMessage) => {
    if (msg.systemMessageType === 'member_added') {
      return t("systemLogAdded", { name: msg.systemMessageMetadata?.name || 'A weaver' });
    }
    const text = msg.messageText;
    if (text.includes("responded: I AGREE")) {
      const name = text.replace("responded: I AGREE", "").trim();
      const displayName = name === "A weaver" ? t("defaultWeaverName") : name;
      return t("systemLogAgree", { name: displayName });
    }
    if (text.includes("responded: CAN'T DO IT —")) {
      const parts = text.split("responded: CAN'T DO IT —");
      const name = parts[0].trim();
      const note = parts[1].trim();
      const displayName = name === "A weaver" ? t("defaultWeaverName") : name;
      return t("systemLogCantDo", { name: displayName, note });
    }
    if (text.includes("raised a concern:")) {
      const parts = text.split("raised a concern:");
      const name = parts[0].trim();
      const note = parts[1].trim();
      const displayName = name === "A weaver" ? t("defaultWeaverName") : name;
      return t("systemLogConcern", { name: displayName, note });
    }
    if (text.includes("posted by") && text.includes("New order")) {
      const matchSimple = text.match(/New order #([^\s]+)\s+posted by\s+(.+?)\s+—\s+(.*)/);
      if (matchSimple) {
        const id = matchSimple[1];
        const name = matchSimple[2];
        let details = matchSimple[3];
        if (locale === 'hi') {
          details = details.replace("units", "इकाइयाँ");
        } else if (locale === 'ta') {
          details = details.replace("units", "அலகுகள்");
        }
        return tScreen1("systemLogNewOrder", { id, name, details });
      }
    }
    return text;
  };

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    if (typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  };

  useEffect(() => {
    if (!user || !orderId) return;

    // Timeout safety guard
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setErrorMsg("Failed to connect to cooperative chat logs. Please ensure you are logged in as a cooperative member.");
      }
    }, 5000);

    // 1. Fetch active order dynamically
    const unsubOrder = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        setActiveOrder({ id: docSnap.id, ...docSnap.data() } as OrderData);
      } else {
        console.warn(`Order ${orderId} not found in Firestore.`);
      }
    }, (err) => {
      console.error("Order read error on Screen 3:", err);
      clearTimeout(timeoutId);
      setLoading(false);
      setErrorMsg(`Permission Denied or connection error while loading order details: ${err.message}`);
    });

    // Fetch cooperative members list live
    const qMembers = query(collection(db, 'members'), where('coopId', '==', coopId));
    const unsubMembers = onSnapshot(qMembers, (memSnap) => {
      const list: MemberData[] = [];
      memSnap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as MemberData);
      });
      setMembersList(list);
      setResponsesCount(prev => ({
        ...prev,
        total: list.length || 3
      }));
    });

    // 2. Fetch responses list for the active order
    const unsubResponses = onSnapshot(collection(db, 'orders', orderId, 'responses'), (snap) => {
      let agreeCount = 0;
      let rejectCount = 0;
      let concernCount = 0;
      snap.forEach((docSnap) => {
        const data = docSnap.data() as MemberResponse;
        if (data.response === 'agree') agreeCount++;
        if (data.response === 'reject') rejectCount++;
        if (data.response === 'concern') concernCount++;
        if (user && docSnap.id === user.uid) {
          setUserResponse(data.response);
        }
      });
      setResponsesCount(prev => ({
        ...prev,
        agreed: agreeCount,
        rejected: rejectCount,
        concerned: concernCount
      }));
    }, (err) => {
      console.error("Responses read error on Screen 3:", err);
      clearTimeout(timeoutId);
      setLoading(false);
      setErrorMsg(`Permission Denied or connection error while loading consensus responses: ${err.message}`);
    });

    // 3. Listen to chat messages ordered by timestamp
    const qMessages = query(
      collection(db, 'cooperatives', coopId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    
    const unsubMessages = onSnapshot(qMessages, (snap) => {
      const msgList: ChatMessage[] = [];
      snap.forEach((docSnap) => {
        msgList.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
      });
      setMessages(msgList);
      clearTimeout(timeoutId);
      setLoading(false);
      
      // Scroll to bottom
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }, (err) => {
      console.error("Messages read error on Screen 3:", err);
      clearTimeout(timeoutId);
      setLoading(false);
      setErrorMsg(`Permission Denied or connection error while loading group messages: ${err.message}`);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubOrder();
      unsubMembers();
      unsubResponses();
      unsubMessages();
    };
  }, [coopId, user, orderId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}`);
    }
  }, [user, authLoading, router, locale]);

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    try {
      await addDoc(collection(db, 'cooperatives', coopId, 'messages'), {
        senderId: user?.uid || 'guest-uid',
        senderName: memberProfile?.name || 'Anonymous',
        messageText: inputText,
        isAudio: false,
        timestamp: new Date()
      });
      setInputText('');
    } catch (err: any) {
      console.error(err);
      alert("Error sending message: " + err.message);
    }
  };

  // Dictate Chat Input
  const startVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerToast(t('toastSpeechUnsupported'));
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn("Error stopping speech recognition:", e);
        }
      }
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = params.locale === 'hi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = (e: any) => {
      console.error("SpeechRecognition error event:", e);
      setIsListening(false);
      
      // Enforce styled toast messages instead of window alerts
      if (e.error === 'not-allowed') {
        triggerToast(t('toastMicAccessDenied'));
      } else if (e.error === 'no-speech') {
        triggerToast(t('toastNoSpeech'));
      } else {
        triggerToast(t('toastSpeechError', { error: e.error }));
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event: any) => {
      const speechText = event.results[0][0].transcript;
      setInputText((prev) => prev.trim() + " " + speechText.trim());
    };

    try {
      recognition.start();
    } catch (err: any) {
      console.error(err);
      triggerToast(t('toastMicError'));
      setIsListening(false);
    }
  };

  // Submit Quick Response
  const submitResponse = async (responseType: 'agree' | 'reject' | 'concern', noteText?: string) => {
    if (!user) {
      triggerToast(t('toastMustLogin'));
      return;
    }
    if (!activeOrder) return;

    let finalNote = "Agreed to parameters.";
    let displayType = "I AGREE";

    if (responseType === 'reject') {
      if (!noteText || !noteText.trim()) {
        triggerToast(t('toastProvideReason'));
        return;
      }
      finalNote = noteText.trim();
      displayType = `CAN'T DO IT — ${finalNote}`;
    } else if (responseType === 'concern') {
      if (!noteText || !noteText.trim()) {
        triggerToast(t('toastProvideConcern'));
        return;
      }
      finalNote = noteText.trim();
      displayType = `raised a concern: ${finalNote}`;
    }

    try {
      const responseRef = doc(db, 'orders', activeOrder.id, 'responses', user.uid);
      await setDoc(responseRef, {
        memberId: user.uid,
        response: responseType,
        note: finalNote,
        timestamp: new Date()
      });

      // Write a system log message in the group chat
      const logMessageText = responseType === 'concern'
        ? `${memberProfile?.name || 'A weaver'} raised a concern: ${finalNote}`
        : `${memberProfile?.name || 'A weaver'} responded: ${displayType}`;

      await addDoc(collection(db, 'cooperatives', coopId, 'messages'), {
        senderId: 'system',
        senderName: 'System Log',
        messageText: logMessageText,
        isAudio: false,
        timestamp: new Date()
      });

      triggerToast(t('toastResponseSubmitted', {
        type: responseType === 'agree' 
          ? t('agreeLabel') 
          : responseType === 'concern' 
            ? t('concernLabel') 
            : t('cantDoLabel')
      }));
    } catch (err: any) {
      console.error(err);
      triggerToast(t('dbError', { message: err.message }));
    }
  };

  const playVoiceNote = (msgId: string) => {
    if (activeVoicePlaying === msgId) {
      setActiveVoicePlaying(null);
    } else {
      setActiveVoicePlaying(msgId);
      // Simulate playing finish
      setTimeout(() => {
        setActiveVoicePlaying((prev) => prev === msgId ? null : prev);
      }, 4000);
    }
  };

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col bg-background items-center justify-center p-8 text-center font-sans">
        <span className="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">Connection Timeout</h2>
        <p className="text-sm text-on-surface-variant max-w-sm mb-6">{errorMsg}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-md active:scale-95 duration-100 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || authLoading) {
    return <BrandedLoader message="Loading cooperative chat..." fullScreen />;
  }

  return (
    <div className="bg-background font-body-md text-on-surface min-h-screen flex flex-col pb-[290px] relative overflow-hidden">
      {/* Background Ikat texture overlay */}
      <div className="absolute inset-0 ikat-pattern pointer-events-none opacity-5" style={{ height: '300px' }}></div>
      <Header />

      {/* Cooperative Members Info Header Bar */}
      {membersList.length > 0 && (
        <div 
          onClick={() => setShowMembersModal(true)}
          className="mt-3 bg-white border border-outline-variant rounded-xl p-3 shadow-sm flex items-center justify-between cursor-pointer hover:border-primary transition-all duration-200 active:scale-[0.99] mx-container-padding relative z-25"
        >
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5 overflow-hidden">
              {membersList.slice(0, 3).map((m, idx) => (
                <div 
                  key={m.id}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ring-2 ring-white select-none ${
                    idx % 3 === 0 ? 'bg-primary-fixed text-on-primary-fixed' :
                    idx % 3 === 1 ? 'bg-secondary-fixed text-on-secondary-fixed' :
                    'bg-tertiary-fixed text-on-tertiary-fixed'
                  }`}
                >
                  {m.name.charAt(0)}
                </div>
              ))}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                {t('groupMembersCount', { count: membersList.length })}
              </span>
              <span className="text-[10px] text-on-surface-variant font-medium">
                {t('tapToSeeMembers')}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-outline">chevron_right</span>
        </div>
      )}

      <main className="flex-grow w-full max-w-2xl mx-auto flex flex-col px-container-padding relative z-10">
        
        {/* Pinned Order Card */}
        {activeOrder && (
          <div className="pt-stack-md">
            <div 
              onClick={() => router.push(`/${locale}/orders/${activeOrder.id}`)}
              className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex items-center justify-between gap-4 cursor-pointer hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-lg bg-cover bg-center" 
                  style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCivaz3HtK7yLT-FmqQtya3bQ57HI10CVv1se4peq9xph55kAzDDgve0wE9oQdZGuTJmV21-lGb_d3qczRmnbvD8Nto7sha652CldLwQ4qn5LfYKs0oC6nn2FsP6TN2XFTz9-7gJVg1wPSI5bKDE90vm8BiEV568L8CoEC2k_PCMqryTHYpa_MAkqaburTXTN6GDYyP94wXCSw6zF31V66yg2XU0cnih0PIW_4TxrIiTe6AG3tNRC98q0pZpBii-biniQQRuyfTcusE')` }}
                ></div>
                <div>
                  <p className="font-label-lg text-on-surface">Order #{activeOrder.id.replace('order-', '')}: {activeOrder.item}</p>
                  <p className="text-sm text-on-surface-variant">
                    {t('remaining', { date: new Date(activeOrder.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), meters: 45 })}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-on-surface-variant/80 font-medium">
                    <span className="material-symbols-outlined text-[13px] text-outline">person_check</span>
                    <span>Entered by: {activeOrder.enteredBy || 'System'} ({activeOrder.enteredAt ? (activeOrder.enteredAt.seconds ? new Date(activeOrder.enteredAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : new Date(activeOrder.enteredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })) : 'System'})</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-bold">
                    {activeOrder.buyerConfirmed ? (
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">check_circle</span>
                        Buyer Confirmed ✓
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">pending</span>
                        Awaiting Buyer Confirmation
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">push_pin</span>
            </div>
          </div>
        )}
        {/* Pinned Live Consensus Status Header */}
        {activeOrder && (
          <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm space-y-3 mb-2 animate-in fade-in duration-200 mt-3">
            <div className="flex justify-between items-center pb-2 border-b border-surface-container">
              <span className="font-label-lg font-bold text-xs uppercase tracking-wider text-primary">{t('liveConsensusStatus')}</span>
              
              {/* Derived Consensus Status Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                (responsesCount.agreed + responsesCount.rejected + responsesCount.concerned) < responsesCount.total
                  ? 'bg-amber-50 border border-amber-200 text-amber-800 animate-pulse'
                  : responsesCount.rejected > 0
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : responsesCount.concerned > 0
                      ? 'bg-amber-50 border border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}>
                {(responsesCount.agreed + responsesCount.rejected + responsesCount.concerned) < responsesCount.total
                  ? t('waitingForResponses')
                  : responsesCount.rejected > 0
                    ? t('actionRejections')
                    : responsesCount.concerned > 0
                      ? t('actionConcerns')
                      : t('consensusReached')}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-surface-container-low p-2 rounded-lg border border-outline-variant/30 flex flex-col justify-between">
                <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider block leading-tight">{t('respondedLabel')}</span>
                <span className="font-bold text-on-surface text-xs mt-1 block">
                  {responsesCount.agreed + responsesCount.rejected + responsesCount.concerned} / {responsesCount.total}
                </span>
              </div>
              <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-200/30 flex flex-col justify-between">
                <span className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider block leading-tight">✅ {t('agreeLabel')}</span>
                <span className="font-bold text-emerald-700 text-xs mt-1 block">
                  {responsesCount.agreed}
                </span>
              </div>
              <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-200/30 flex flex-col justify-between">
                <span className="text-[9px] text-amber-800 font-bold uppercase tracking-wider block leading-tight">⚠️ {t('concernLabel')}</span>
                <span className="font-bold text-amber-700 text-xs mt-1 block">
                  {responsesCount.concerned}
                </span>
              </div>
              <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-200/30 flex flex-col justify-between">
                <span className="text-[9px] text-rose-800 font-bold uppercase tracking-wider block leading-tight">❌ {t('cantDoLabel')}</span>
                <span className="font-bold text-rose-700 text-xs mt-1 block">
                  {responsesCount.rejected}
                </span>
              </div>
            </div>

            {memberProfile?.role === 'admin' && (
              <div className="pt-2 border-t border-surface-container flex justify-end">
                <button
                  onClick={() => router.push(`/${locale}/orders/${orderId}/consensus`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-primary text-primary rounded-xl font-bold text-[11px] shadow-sm hover:bg-primary/5 active:scale-95 duration-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm font-bold">analytics</span>
                  {t('viewConsensusDetails')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chat Area (Flexbox Alignment Enabled) */}
        <div className="flex-1 overflow-y-auto max-h-[380px] space-y-4 py-4 pr-1 scrollbar-thin flex flex-col">
          {messages.map((msg) => {
            const isMe = !!user && !!msg.senderId && msg.senderId === user.uid;
            const isSystem = msg.senderId === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="self-center bg-surface-variant/40 px-4 py-1 rounded-full border border-outline-variant/30 text-center mx-auto my-2">
                  <p className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wider">{translateSystemMessage(msg)}</p>
                </div>
              );
            }

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end ml-auto' : 'items-start mr-auto'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {!isMe && <span className="font-label-sm text-on-surface-variant text-xs">{msg.senderName}</span>}
                  <span className="text-[9px] text-on-surface-variant">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                  {isMe && <span className="font-label-sm text-primary text-xs">{tCommon('youLabel')}</span>}
                </div>

                {msg.isAudio ? (
                  // Audio Message Box
                  <div className={`p-3 rounded-2xl shadow-sm flex items-center gap-3 ${isMe ? 'bg-primary-container text-on-primary-container rounded-tr-none' : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant'}`}>
                    <button 
                      onClick={() => playVoiceNote(msg.id)}
                      className="w-10 h-10 rounded-full bg-on-primary-container/20 flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined">
                        {activeVoicePlaying === msg.id ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                    <div className="voice-wave">
                      <div className={`voice-bar ${activeVoicePlaying === msg.id ? '' : 'paused'}`} style={{ height: '12px', animationDelay: '0.1s' }}></div>
                      <div className={`voice-bar ${activeVoicePlaying === msg.id ? '' : 'paused'}`} style={{ height: '16px', animationDelay: '0.2s' }}></div>
                      <div className={`voice-bar ${activeVoicePlaying === msg.id ? '' : 'paused'}`} style={{ height: '8px', animationDelay: '0.3s' }}></div>
                      <div className={`voice-bar ${activeVoicePlaying === msg.id ? '' : 'paused'}`} style={{ height: '14px', animationDelay: '0.4s' }}></div>
                      <div className={`voice-bar ${activeVoicePlaying === msg.id ? '' : 'paused'}`} style={{ height: '10px', animationDelay: '0.5s' }}></div>
                      <div className={`voice-bar ${activeVoicePlaying === msg.id ? '' : 'paused'}`} style={{ height: '18px', animationDelay: '0.6s' }}></div>
                      <div className={`voice-bar ${activeVoicePlaying === msg.id ? '' : 'paused'}`} style={{ height: '6px', animationDelay: '0.7s' }}></div>
                    </div>
                    <span className="font-label-sm">{msg.audioDuration || '0:14'}</span>
                  </div>
                ) : (
                  // Text Message Box
                  <div className={`p-3 rounded-2xl ${isMe ? 'bg-primary-container text-on-primary-container rounded-tr-none shadow-sm' : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant'}`}>
                    <p className="font-body-md whitespace-pre-wrap">{msg.messageText}</p>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={chatEndRef}></div>
        </div>

        {/* Quick Response Bar */}
        <div className="fixed bottom-[72px] left-0 w-full bg-surface border-t border-outline-variant px-container-padding py-4 z-30 flex flex-col gap-4">
          <div className="max-w-2xl mx-auto w-full space-y-4">
            {/* Agreement Quick Votes (3-state model) */}
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => submitResponse('agree')}
                className={`h-14 flex flex-col items-center justify-center border rounded-xl active:scale-95 transition-all cursor-pointer ${
                  userResponse === 'agree' 
                    ? 'bg-emerald-200 border-emerald-500 text-emerald-900 font-bold shadow-md' 
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                }`}
              >
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="font-label-sm text-[10px]">{t('agree')}</span>
              </button>
              
              <button 
                onClick={() => {
                  setModalMode('concern');
                  setFreeTextReason('');
                  setShowReasonModal(true);
                }}
                className={`h-14 flex flex-col items-center justify-center border rounded-xl active:scale-95 transition-all cursor-pointer ${
                  userResponse === 'concern' 
                    ? 'bg-amber-200 border-amber-500 text-amber-900 font-bold shadow-md' 
                    : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                }`}
              >
                <span className="material-symbols-outlined text-lg">warning</span>
                <span className="font-label-sm text-[10px]">{t('concern')}</span>
              </button>

              <button 
                onClick={() => {
                  setModalMode('reject');
                  setFreeTextReason('');
                  setShowReasonModal(true);
                }}
                className={`h-14 flex flex-col items-center justify-center border rounded-xl active:scale-95 transition-all cursor-pointer ${
                  userResponse === 'reject' 
                    ? 'bg-rose-200 border-rose-500 text-rose-900 font-bold shadow-md' 
                    : 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200'
                }`}
              >
                <span className="material-symbols-outlined text-lg">close</span>
                <span className="font-label-sm text-[10px]">{t('cantDo')}</span>
              </button>
            </div>

            {/* Standard Chat Input */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <div className="flex-grow flex items-center bg-surface-container-low border border-outline-variant rounded-full px-4 h-12">
                <input 
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={t('typePlaceholder')}
                  className="bg-transparent border-none focus:ring-0 w-full text-on-surface focus:outline-none"
                />
                <button 
                  type="button" 
                  onClick={startVoiceDictation}
                  className={`material-symbols-outlined cursor-pointer hover:text-primary transition-colors ${isListening ? 'text-rose-600 animate-pulse' : 'text-on-surface-variant'}`}
                >
                  {isListening ? 'graphic_eq' : 'mic'}
                </button>
              </div>
              <button 
                type="submit"
                disabled={!inputText.trim()}
                className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </form>
          </div>
        </div>

      </main>

      {/* Free-text Reason/Concern Modal */}
      {showReasonModal && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-outline-variant shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-headline-md text-on-surface font-extrabold">
                {modalMode === 'concern' ? t('concern') : t('cantDo')}
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                {modalMode === 'concern' 
                  ? t('modalModeConcernSub') 
                  : t('modalModeCantDoSub')}
              </p>
            </div>

            <div className="space-y-2">
              <textarea
                value={freeTextReason}
                onChange={(e) => setFreeTextReason(e.target.value)}
                placeholder={
                  modalMode === 'concern'
                    ? t('explainConcern')
                    : t('explainCantDo')
                }
                rows={4}
                className="w-full bg-white border border-outline-variant rounded-xl p-3 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none bg-white text-on-surface"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => {
                  setShowReasonModal(false);
                  setModalMode(null);
                  setFreeTextReason('');
                }}
                className="flex-1 py-2.5 border border-outline text-outline font-bold text-xs text-center rounded-xl hover:bg-surface-container active:scale-95 duration-100 cursor-pointer bg-white"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => {
                  submitResponse(modalMode, freeTextReason);
                  setShowReasonModal(false);
                  setModalMode(null);
                  setFreeTextReason('');
                }}
                disabled={!freeTextReason.trim()}
                className="flex-1 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary-container active:scale-95 duration-100 disabled:opacity-50 cursor-pointer"
              >
                {t('submitResponse')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled toast feedback */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-sans text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
          {toastMsg}
        </div>
      )}

      {/* Cooperative Members Roster Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-gutter">
          <div className="bg-white border border-outline-variant rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-surface-container mb-4">
              <h3 className="font-bold text-base text-on-surface flex items-center gap-2 select-none">
                <span className="material-symbols-outlined text-primary">groups</span>
                {t('groupMembersCount', { count: membersList.length })}
              </h3>
              <button 
                onClick={() => setShowMembersModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container active:scale-95 duration-100 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Members Roster List */}
            <div className="flex-grow overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {membersList.map((m, index) => {
                const isUserAdmin = m.role === 'admin';
                const isUserTreasurer = m.role === 'treasurer';
                const roleLabel = isUserAdmin 
                  ? tCommon('roleAdmin') 
                  : isUserTreasurer 
                  ? tCommon('roleTreasurer') 
                  : tCommon('roleWeaver');

                return (
                  <div 
                    key={m.id}
                    className="p-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs select-none ${
                        index % 3 === 0 ? 'bg-primary text-on-primary' :
                        index % 3 === 1 ? 'bg-secondary text-on-secondary' :
                        'bg-tertiary text-on-tertiary'
                      }`}>
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-label-md text-label-md font-bold text-on-surface">{m.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold select-none ${
                            isUserAdmin 
                              ? 'bg-primary-container text-on-primary-container' 
                              : isUserTreasurer 
                              ? 'bg-secondary-container text-on-secondary-container' 
                              : 'bg-surface-container text-on-surface-variant'
                          }`}>
                            {roleLabel}
                          </span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-mono">{m.phone}</span>
                        {!isUserAdmin && (m.age || m.experience || m.specialization || m.area) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 select-none font-sans">
                            {m.specialization && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary font-bold">{m.specialization}</span>
                            )}
                            {m.area && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary-container/20 text-secondary font-bold">{m.area}</span>
                            )}
                            {m.age ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono">{m.age}y</span>
                            ) : null}
                            {m.experience ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono">{m.experience}y exp</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isUserAdmin && m.capacity && (
                      <div className="text-right flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-outline select-none uppercase font-sans">Capacity</span>
                        <span className="text-xs font-extrabold text-on-surface font-mono">{m.capacity}m</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="mt-4 pt-4 border-t border-surface-container flex">
              <button 
                onClick={() => setShowMembersModal(false)}
                className="w-full py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary-container active:scale-95 duration-100 cursor-pointer"
              >
                {tCommon('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar />
      <DevBar />
    </div>
  );
}
