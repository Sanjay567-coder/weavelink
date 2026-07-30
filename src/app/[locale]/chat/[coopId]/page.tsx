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
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, memberProfile, loading: authLoading } = useAuth();
  
  const coopId = (params.coopId as string) || 'coop-kanchipuram';
  const locale = (params.locale as string) || 'en';
  const orderId = searchParams.get('orderId') || 'order-8922';
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderData | null>(null);
  const [responsesCount, setResponsesCount] = useState({ agreed: 0, rejected: 0, total: 18 });
  const [userResponse, setUserResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeVoicePlaying, setActiveVoicePlaying] = useState<string | null>(null);
  
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [otherReasonText, setOtherReasonText] = useState('');
  
  const [toastMsg, setToastMsg] = useState('');
  const recognitionRef = useRef<any>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
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

    // Fetch total members count in this cooperative to calculate real consensus percentages dynamically
    const qMembers = query(collection(db, 'members'), where('coopId', '==', coopId));
    let totalMembers = 3; // default fallback
    const unsubMembers = onSnapshot(qMembers, (memSnap) => {
      totalMembers = memSnap.size || 3;
    });

    // 2. Fetch responses list for the active order
    const unsubResponses = onSnapshot(collection(db, 'orders', orderId, 'responses'), (snap) => {
      let agreeCount = 0;
      let rejectCount = 0;
      snap.forEach((docSnap) => {
        const data = docSnap.data() as MemberResponse;
        if (data.response === 'agree') agreeCount++;
        if (data.response === 'reject') rejectCount++;
        if (user && docSnap.id === user.uid) {
          setUserResponse(data.response);
        }
      });
      setResponsesCount({
        agreed: agreeCount,
        rejected: rejectCount,
        total: totalMembers
      });
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
      triggerToast("Speech recognition not supported in this browser. Please use Chrome.");
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
        triggerToast("Microphone access denied. Please enable microphone permissions in your browser settings to use voice input.");
      } else if (e.error === 'no-speech') {
        triggerToast("No speech detected. Please try again.");
      } else {
        triggerToast(`Speech recognition error: ${e.error}`);
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
      triggerToast("Failed to initialize microphone device.");
      setIsListening(false);
    }
  };

  // Submit Quick Response
  const submitResponse = async (responseType: 'agree' | 'reject', reasons?: string[]) => {
    if (!user) {
      triggerToast("You must be logged in to vote.");
      return;
    }
    if (!activeOrder) return;

    let noteText = "Agreed to parameters.";
    let displayType = "I AGREE";

    if (responseType === 'reject') {
      if (!reasons || reasons.length === 0) {
        triggerToast("Please provide at least one reason.");
        return;
      }
      noteText = reasons.join(', ');
      displayType = `CAN'T DO IT — ${noteText}`;
    }

    try {
      const responseRef = doc(db, 'orders', activeOrder.id, 'responses', user.uid);
      await setDoc(responseRef, {
        memberId: user.uid,
        response: responseType,
        note: noteText,
        timestamp: new Date()
      });

      // Write a system log message in the group chat
      await addDoc(collection(db, 'cooperatives', coopId, 'messages'), {
        senderId: 'system',
        senderName: 'System Log',
        messageText: `${memberProfile?.name || 'A weaver'} responded: ${displayType}`,
        isAudio: false,
        timestamp: new Date()
      });

      triggerToast(`Response submitted: ${responseType === 'agree' ? 'AGREE' : "CAN'T DO IT"}`);
    } catch (err: any) {
      console.error(err);
      triggerToast("Database error: " + err.message);
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
    <div className="bg-background font-body-md text-on-surface min-h-screen flex flex-col pb-48 relative overflow-hidden">
      {/* Background Ikat texture overlay */}
      <div className="absolute inset-0 ikat-pattern pointer-events-none opacity-5" style={{ height: '300px' }}></div>
      <Header />

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
              <span className="font-label-lg font-bold text-xs uppercase tracking-wider text-primary">Live Consensus Status</span>
              
              {/* Derived Consensus Status Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                (responsesCount.agreed + responsesCount.rejected) < responsesCount.total
                  ? 'bg-amber-50 border border-amber-200 text-amber-800 animate-pulse'
                  : responsesCount.rejected > 0
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}>
                {(responsesCount.agreed + responsesCount.rejected) < responsesCount.total
                  ? 'Waiting for responses'
                  : responsesCount.rejected > 0
                    ? 'Action needed: Rejections present'
                    : 'Consensus reached'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              <div className="bg-surface-container-low p-2 rounded-lg border border-outline-variant/30">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Responded</span>
                <span className="font-bold text-on-surface text-sm mt-1 block">
                  {responsesCount.agreed + responsesCount.rejected} / {responsesCount.total}
                </span>
              </div>
              <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-200/30">
                <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">✅ Agree</span>
                <span className="font-bold text-emerald-700 text-sm mt-1 block">
                  {responsesCount.agreed}
                </span>
              </div>
              <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-200/30">
                <span className="text-[10px] text-rose-800 font-bold uppercase tracking-wider block">❌ Can't Do It</span>
                <span className="font-bold text-rose-700 text-sm mt-1 block">
                  {responsesCount.rejected}
                </span>
              </div>
            </div>
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
                  <p className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wider">{msg.messageText}</p>
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
                  {isMe && <span className="font-label-sm text-primary text-xs">You</span>}
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
            {/* Agreement Quick Votes (2-state model) */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => submitResponse('agree')}
                className={`h-14 flex flex-col items-center justify-center border rounded-xl active:scale-95 transition-all cursor-pointer ${
                  userResponse === 'agree' 
                    ? 'bg-emerald-200 border-emerald-500 text-emerald-900 font-bold shadow-md' 
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="font-label-sm">{t('agree')}</span>
              </button>
              <button 
                onClick={() => {
                  setSelectedReasons([]);
                  setOtherReasonText('');
                  setShowReasonModal(true);
                }}
                className={`h-14 flex flex-col items-center justify-center border rounded-xl active:scale-95 transition-all cursor-pointer ${
                  userResponse === 'reject' 
                    ? 'bg-rose-200 border-rose-500 text-rose-900 font-bold shadow-md' 
                    : 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200'
                }`}
              >
                <span className="material-symbols-outlined">close</span>
                <span className="font-label-sm">{t('cantDo')}</span>
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

      {/* Reason Checklist Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-outline-variant shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-headline-md text-on-surface font-extrabold">Can't Do It</h3>
              <p className="text-xs text-on-surface-variant mt-1">Please select the reason(s) why you cannot take on this order.</p>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {[
                "Not enough raw material/yarn available",
                "Loom capacity already full",
                "Deadline too tight",
                "Price too low for the work involved",
                "Health/personal availability issue",
                "Other"
              ].map((reason) => {
                const isChecked = selectedReasons.includes(reason);
                return (
                  <div key={reason} className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 p-3 bg-surface-container rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors border border-transparent hover:border-outline-variant/35">
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedReasons(selectedReasons.filter(r => r !== reason));
                          } else {
                            setSelectedReasons([...selectedReasons, reason]);
                          }
                        }}
                        className="rounded text-primary focus:ring-primary w-4.5 h-4.5 border-outline"
                      />
                      <span className="text-xs font-semibold text-on-surface">{reason}</span>
                    </label>

                    {reason === 'Other' && isChecked && (
                      <textarea
                        value={otherReasonText}
                        onChange={(e) => setOtherReasonText(e.target.value)}
                        placeholder="Please type your specific reason..."
                        rows={2}
                        className="w-full bg-white border border-outline-variant rounded-lg p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => {
                  setShowReasonModal(false);
                  setSelectedReasons([]);
                  setOtherReasonText('');
                }}
                className="flex-1 py-2.5 border border-outline text-outline font-bold text-xs text-center rounded-xl hover:bg-surface-container active:scale-95 duration-100 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const reasonsToSubmit = selectedReasons.map(r => {
                    if (r === 'Other') {
                      return `Other: ${otherReasonText.trim()}`;
                    }
                    return r;
                  });
                  submitResponse('reject', reasonsToSubmit);
                  setShowReasonModal(false);
                }}
                disabled={
                  selectedReasons.length === 0 || 
                  (selectedReasons.includes('Other') && !otherReasonText.trim())
                }
                className="flex-1 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary-container active:scale-95 duration-100 disabled:opacity-50 cursor-pointer"
              >
                Submit Response
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

      <Navbar />
      <DevBar />
    </div>
  );
}
