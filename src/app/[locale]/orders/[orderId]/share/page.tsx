"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { DevBar } from '@/components/DevBar';
import { BrandedLoader } from '@/components/BrandedLoader';

interface OrderData {
  coopId: string;
  buyerName: string;
  item: string;
  quantity: number;
  price: number;
  deadline: string;
  status: string;
}

interface MemberData {
  id: string;
  name: string;
  role: string;
  phone: string;
  capacity: number;
}

export default function ShareOrderPage() {
  const t = useTranslations('screen2');
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  
  const orderId = params.orderId as string;
  const locale = (params.locale as string) || 'en';
  const [order, setOrder] = useState<OrderData | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [summary, setSummary] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Auth Redirection Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}`);
    }
  }, [user, authLoading, router, locale]);

  useEffect(() => {
    if (!orderId || !user) return;

    // Timeout safety guard
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setErrorMsg("Failed to generate summary within 5 seconds. Please ensure you have permission to access this order.");
      }
    }, 5000);

    // Load order data
    const unsubOrder = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as OrderData;
        setOrder(data);
        
        // Generate auto summary
        const unitPrice = Math.round(data.price / data.quantity);
        const dateStr = new Date(data.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setSummary(`New Order from ${data.buyerName}: ${data.quantity} ${data.item}s by ${dateStr}. Price ₹${unitPrice}/unit.`);
        clearTimeout(timeoutId);
        setLoading(false);
      } else {
        clearTimeout(timeoutId);
        setLoading(false);
        setErrorMsg(`Order with ID "${orderId}" not found in Firestore.`);
      }
    }, (err) => {
      console.error("Firestore read error on Screen 2:", err);
      clearTimeout(timeoutId);
      setLoading(false);
      setErrorMsg(`Permission Denied or connection error while loading order: ${err.message}`);
    });

    // Load cooperative members
    const loadMembers = async () => {
      try {
        const q = query(collection(db, 'members'), where('coopId', '==', 'coop-kanchipuram'));
        const snap = await getDocs(q);
        const membersList: MemberData[] = [];
        snap.forEach((doc) => {
          membersList.push({ id: doc.id, ...doc.data() } as MemberData);
        });
        setMembers(membersList);
      } catch (err) {
        console.error("Error loading members:", err);
      }
    };
    loadMembers();

    return () => {
      clearTimeout(timeoutId);
      unsubOrder();
    };
  }, [orderId, user]);

  const handleRegenerate = () => {
    if (!order) return;
    const unitPrice = Math.round(order.price / order.quantity);
    const dateStr = new Date(order.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    setSummary(`New Order from ${order.buyerName}: ${order.quantity} ${order.item}s by ${dateStr}. Price ₹${unitPrice}/unit.`);
  };

  // Voice Note Capture: Web Speech API
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Please use Chrome.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = params.locale === 'hi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setSummary(text);
    };

    recognition.start();
  };

  const handleSend = async () => {
    if (!order || !summary) return;
    setSending(true);

    try {
      // Add message to chat collection
      const coopId = order.coopId || 'coop-kanchipuram';
      await addDoc(collection(db, 'cooperatives', coopId, 'messages'), {
        senderId: user?.uid || 'admin-uid-999',
        senderName: 'Amit Patel (Admin)',
        messageText: summary,
        isAudio: false,
        timestamp: new Date()
      });

      setSending(false);
      setSent(true);

      // Redirect to group chat after 1.5 seconds
      setTimeout(() => {
        router.push(`/${locale}/chat/${coopId}?orderId=${orderId}`);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      alert("Error sending message: " + err.message);
      setSending(false);
    }
  };

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col bg-background items-center justify-center p-8 text-center font-sans">
        <span className="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">Failed to Load Order</h2>
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

  if (loading) {
    return <BrandedLoader message="Preparing contract summary..." fullScreen />;
  }

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-24 flex flex-col">
      {/* Suppress Bottom Navigation, show custom Back path Header */}
      <Header showBack backPath={`/en/orders/${orderId}`} />

      <main className="flex-1 texture-overlay pt-6">
        <div className="max-w-md mx-auto px-container-padding space-y-stack-lg">
          
          {/* Page Header */}
          <section className="space-y-stack-sm">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">{t('title')}</h2>
            <p className="font-body-md text-on-surface-variant">{t('subtitle')}</p>
          </section>

          {/* Summarized Card (Bento Style) */}
          <div className="space-y-gutter">
            {/* Text Area Section */}
            <div className="bg-white rounded-xl p-container-padding border border-outline-variant shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-2">
                <span className="material-symbols-outlined text-primary/40 select-none">edit_note</span>
              </div>
              <label className="block font-label-lg text-label-lg text-primary mb-2">{t('summarized')}</label>
              
              <textarea 
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full bg-transparent border-0 focus:ring-0 font-body-lg text-body-lg text-on-surface-variant resize-none h-32 focus:outline-none"
              />
              
              <div className="flex justify-end pt-2 border-t border-outline-variant/30 mt-4">
                <button 
                  onClick={handleRegenerate}
                  className="text-primary font-label-sm text-label-sm flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  {t('regenerate')}
                </button>
              </div>
            </div>

            {/* Voice Action Button */}
            <div 
              onClick={startRecording}
              className="bg-surface-container-high rounded-xl p-container-padding flex items-center justify-between group cursor-pointer hover:shadow-md transition-shadow duration-300 border border-outline-variant/30"
            >
              <div className="space-y-1">
                <h3 className="font-label-lg text-label-lg text-on-surface">
                  {isRecording ? 'Listening/Recording...' : t('recordVoice')}
                </h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {isRecording ? 'Speak now. Tap again to stop.' : t('tapRecord')}
                </p>
              </div>
              <div className="relative flex items-center justify-center">
                {isRecording && (
                  <div className="absolute w-16 h-16 bg-red-500/20 rounded-full animate-pulse-ring"></div>
                )}
                <button className={`relative w-touch-target h-touch-target rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform ${isRecording ? 'bg-rose-600 text-white' : 'bg-primary text-on-primary'}`}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {isRecording ? 'graphic_eq' : 'mic'}
                  </span>
                </button>
              </div>
            </div>

            {/* Recipient Card */}
            <div className="bg-white rounded-xl p-gutter flex flex-col border border-outline-variant shadow-sm">
              <div className="flex items-center justify-between mb-gutter">
                <h3 className="font-label-lg text-label-lg text-on-surface">{t('recipients')}</h3>
                <span className="bg-secondary text-on-secondary px-2 py-0.5 rounded-full font-label-sm text-[12px]">All {members.length}</span>
              </div>
              
              <div className="space-y-3 overflow-y-auto max-h-[160px] pr-2 scrollbar-thin">
                {members.map((member, index) => (
                  <div key={member.id} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        index % 3 === 0 ? 'bg-tertiary-fixed text-on-tertiary-fixed' :
                        index % 3 === 1 ? 'bg-secondary-fixed text-on-secondary-fixed' :
                        'bg-primary-fixed text-on-primary-fixed'
                      }`}>
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm">{member.name}</span>
                        <span className="text-[10px] text-on-surface-variant italic uppercase">{member.role}</span>
                      </div>
                    </div>
                    {/* Read vs Sent Status Mock */}
                    <span className="material-symbols-outlined text-primary text-[18px]" title="Read">
                      {index % 2 === 0 ? 'done_all' : 'done'}
                    </span>
                  </div>
                ))}
              </div>
              
              <button className="mt-4 pt-3 border-t border-outline-variant/20 text-primary font-label-sm text-label-sm text-center hover:text-primary-container transition-colors cursor-pointer">
                {t('manageGroup')}
              </button>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-col items-center gap-stack-md pt-4">
            <button 
              onClick={handleSend}
              disabled={sending || sent || !summary}
              className={`w-full h-touch-target font-label-lg text-label-lg rounded-full shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-gutter cursor-pointer disabled:opacity-85 ${
                sent ? 'bg-emerald-600 text-white' : 'bg-primary text-on-primary hover:bg-primary-container'
              }`}
            >
              {sending ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Sending...
                </>
              ) : sent ? (
                <>
                  <span className="material-symbols-outlined">check_circle</span>
                  Sent Successfully
                </>
              ) : (
                <>
                  {t('sendChat')}
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                </>
              )}
            </button>
            <p className="text-[12px] text-on-surface-variant text-center">
              {t('sendWarning', { count: members.length })}
            </p>
          </div>
        </div>
      </main>

      <DevBar />
    </div>
  );
}
