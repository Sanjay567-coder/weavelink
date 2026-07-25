"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  setDoc,
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';

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
  const { user, memberProfile } = useAuth();
  
  const coopId = (params.coopId as string) || 'coop-kanchipuram';
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderData | null>(null);
  const [responsesCount, setResponsesCount] = useState({ agreed: 0, total: 18 });
  const [userResponse, setUserResponse] = useState<string | null>(null);
  
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeVoicePlaying, setActiveVoicePlaying] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    // 1. Fetch active order (e.g. order-8922 or order-4421)
    // We listen to the orders collection where status is discussing
    const unsubOrder = onSnapshot(doc(db, 'orders', 'order-8922'), (docSnap) => {
      if (docSnap.exists()) {
        setActiveOrder({ id: docSnap.id, ...docSnap.data() } as OrderData);
      }
    });

    // 2. Fetch responses list to calculate live tally
    const unsubResponses = onSnapshot(collection(db, 'orders', 'order-8922', 'responses'), (snap) => {
      let count = 0;
      snap.forEach((docSnap) => {
        const data = docSnap.data() as MemberResponse;
        if (data.response === 'agree') count++;
        if (user && docSnap.id === user.uid) {
          setUserResponse(data.response);
        }
      });
      setResponsesCount({ agreed: count, total: snap.size });
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
      
      // Scroll to bottom
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    });

    return () => {
      unsubOrder();
      unsubResponses();
      unsubMessages();
    };
  }, [coopId, user]);

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
      alert("Speech recognition not supported in this browser. Please use Chrome.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = params.locale === 'hi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const speechText = event.results[0][0].transcript;
      setInputText((prev) => prev + " " + speechText);
    };

    recognition.start();
  };

  // Submit Quick Response
  const submitResponse = async (responseType: 'agree' | 'concern' | 'reject') => {
    if (!user) {
      alert("You must be logged in to vote.");
      return;
    }
    if (!activeOrder) return;

    const responseNotes = {
      agree: "Agreed to parameters.",
      concern: "Requires dye delay / pricing review.",
      reject: "Rejected."
    };

    try {
      const responseRef = doc(db, 'orders', activeOrder.id, 'responses', user.uid);
      await setDoc(responseRef, {
        memberId: user.uid,
        response: responseType,
        note: responseNotes[responseType],
        timestamp: new Date()
      });

      // Write a system log message in the group chat
      await addDoc(collection(db, 'cooperatives', coopId, 'messages'), {
        senderId: 'system',
        senderName: 'System Log',
        messageText: `${memberProfile?.name || 'A weaver'} responded: ${responseType.toUpperCase()}`,
        isAudio: false,
        timestamp: new Date()
      });

      alert(`Vote submitted: ${responseType.toUpperCase()}`);
    } catch (err: any) {
      console.error(err);
      alert("Database error: " + err.message);
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

  return (
    <div className="bg-background font-body-md text-on-surface min-h-screen flex flex-col ikat-pattern pb-48">
      <Header />

      <main className="flex-grow w-full max-w-2xl mx-auto flex flex-col px-container-padding">
        
        {/* Pinned Order Card */}
        {activeOrder && (
          <div className="pt-stack-md">
            <div 
              onClick={() => router.push(`/en/orders/${activeOrder.id}`)}
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
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">push_pin</span>
            </div>
          </div>
        )}

        {/* Tally Counter */}
        <div className="py-stack-sm text-center">
          <div className="inline-flex items-center gap-2 bg-secondary-container/30 px-4 py-1.5 rounded-full border border-secondary-container">
            <span className="material-symbols-outlined text-secondary text-lg">groups</span>
            <span className="font-label-sm text-on-secondary-container">
              {t('membersResponded', { responded: responsesCount.agreed, total: responsesCount.total })}
            </span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto max-h-[380px] space-y-4 py-4 pr-1 scrollbar-thin">
          {messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
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
                    {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
            {/* Agreement Quick Votes */}
            <div className="grid grid-cols-3 gap-3">
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
                onClick={() => submitResponse('concern')}
                className={`h-14 flex flex-col items-center justify-center border rounded-xl active:scale-95 transition-all cursor-pointer ${
                  userResponse === 'concern' 
                    ? 'bg-amber-200 border-amber-500 text-amber-900 font-bold shadow-md' 
                    : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                }`}
              >
                <span className="material-symbols-outlined">help</span>
                <span className="font-label-sm">{t('concern')}</span>
              </button>
              <button 
                onClick={() => submitResponse('reject')}
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

      <Navbar />
      <DevBar />
    </div>
  );
}
