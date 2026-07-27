"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
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
  enteredBy?: string;
  enteredAt?: any;
  buyerPhone?: string;
  buyerConfirmed?: boolean;
  buyerConfirmedAt?: any;
}

export default function OrderDetailsPage() {
  const t = useTranslations('screen1');
  const router = useRouter();
  const params = useParams();
  const { user, memberProfile } = useAuth();
  
  const orderId = params.orderId as string;
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  
  const locale = (params.locale as string) || 'en';
  const [buyerPhone, setBuyerPhone] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    if (!orderId || !user) return;

    // Real-time listener for order updates
    const unsub = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as OrderData;
        setOrder(data);
        if (data.buyerPhone) {
          setBuyerPhone(data.buyerPhone);
        }
      } else {
        console.warn(`Order ${orderId} not found in Firestore.`);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error reading order:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [orderId, user]);

  // Action: Discuss with Members
  const handleDiscuss = async () => {
    if (!order) return;
    try {
      // Update order status to discussing, and log who entered it and buyer confirmation phone
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'discussing',
        enteredBy: memberProfile?.name ? `${memberProfile.name} (${memberProfile.role === 'admin' ? 'Admin' : 'Treasurer'})` : 'Amit Patel (Admin)',
        enteredAt: new Date(),
        buyerPhone: buyerPhone
      });
      // Redirect to Screen 2
      router.push(`/${locale}/orders/${orderId}/share`);
    } catch (err: any) {
      alert("Error sharing order: " + err.message);
    }
  };

  // Action: Share Confirmation Link
  const handleShareLink = () => {
    const confirmLink = `${window.location.origin}/${locale}/confirm/${orderId}`;
    navigator.clipboard.writeText(confirmLink);
    triggerToast("Confirmation link copied! Share this with the buyer.");
  };

  // Action: Decline Order
  const handleDecline = async () => {
    if (!order) return;
    if (confirm("Are you sure you want to decline this order?")) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'declined'
        });
        alert("Order declined.");
        router.push('/');
      } catch (err: any) {
        alert("Error declining order: " + err.message);
      }
    }
  };

  // Voice Assistant: Web Speech API
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Please use Google Chrome.");
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
      setVoiceText('');
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setVoiceText(speechToText);
      handleVoiceCommand(speechToText.toLowerCase());
    };

    recognition.start();
  };

  const handleVoiceCommand = (command: string) => {
    console.log("Voice Command:", command);
    if (command.includes("discuss") || command.includes("चर्चा") || command.includes("सहयोग")) {
      handleDiscuss();
    } else if (command.includes("decline") || command.includes("अस्वीकार") || command.includes("मना")) {
      handleDecline();
    } else {
      alert(`Voice command captured: "${command}". Try speaking "discuss with members" or "decline".`);
    }
  };

  if (loading) {
    return <BrandedLoader message="Loading details..." fullScreen />;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header showBack backPath="/" />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4">error</span>
          <h2 className="font-headline-md text-on-surface mb-2">Order Not Found</h2>
          <p className="text-on-surface-variant mb-6">Make sure you ran the seed script (`npm run seed`) to setup database collections.</p>
          <button onClick={() => router.push('/')} className="bg-primary text-on-primary px-6 py-2 rounded-lg">Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-32 flex flex-col">
      <Header />
      
      <main className="px-container-padding pt-stack-lg relative flex-1 max-w-xl mx-auto w-full">
        {/* Background Texture Overlay */}
        <div className="absolute inset-0 ikat-pattern pointer-events-none" style={{ height: '200px' }}></div>
        
        {/* Header Context */}
        <div className="mb-stack-lg relative z-10">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-1">{t('headerTitle')}</h1>
          <p className="font-body-md text-on-surface-variant">{t('headerSub')}</p>
        </div>

        {/* Primary Order Card */}
        <div className="bg-white border border-outline-variant rounded-xl shadow-[0_4px_12px_rgba(30,27,75,0.08)] overflow-hidden relative z-10">
          {/* Order Header with Status Badge */}
          <div className="p-gutter flex justify-between items-start border-b border-surface-container">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary">{t('orderNum', { num: orderId.replace('order-', '') })}</h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                {t('expires', { hours: 48 })}
              </p>
            </div>
            <div className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-label-sm text-label-sm uppercase tracking-wider">
              {order.status === 'pending_review' ? t('newRequest') : order.status}
            </div>
          </div>

          {/* Image Section */}
          <div className="w-full h-48 relative overflow-hidden bg-surface-container">
            <div 
              className="absolute inset-0 bg-cover bg-center" 
              style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuBG_YlJTCRvUd7y3r-HlmMgAritfMApf0uM14D4QZVVZc6lPlek8zDTMKehFCTTs8DmcWcR3j-WAGoSttHGGWC2jfF_JKhbX1GAsxunXzSfsdeFJH_0NlJAE3Qyia_hv6jrhne1FlWGTbZzNBMgR7LA4qd7y9dHhTLTlRE7ZN0p93HX2QsGO8AfKoL3JaCu4uxipURt5Pi5mggBNuL3zWwa1NtoVwnE_S0Z-kw0xnB6xRP-ol43sjdJ-2FsunLHf5tLfRC9COvNsAKe')` }}
            ></div>
            <div className="absolute bottom-4 right-4">
              <button className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg flex items-center justify-center active:scale-95 duration-100">
                <span className="material-symbols-outlined text-primary">zoom_in</span>
              </button>
            </div>
          </div>

          {/* Detailed Content */}
          <div className="p-gutter space-y-gutter">
            <div className="grid grid-cols-2 gap-gutter">
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">{t('buyer')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container font-bold text-xs">ET</div>
                  <span className="font-body-md text-body-md font-semibold">{order.buyerName}</span>
                </div>
              </div>
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">{t('price')}</span>
                <div className="flex flex-col gap-1 items-start">
                  <span className="font-headline-md text-headline-md font-bold text-on-surface">₹{order.price.toLocaleString('en-IN')}</span>
                  {order.buyerConfirmed ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-[12px] font-extrabold">check_circle</span>
                      Buyer Confirmed ✓
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-[12px] font-extrabold">pending</span>
                      Awaiting Buyer Confirmation
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-surface-container">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-outline">inventory_2</span>
                  <span className="font-body-md text-body-md">{t('item')}</span>
                </div>
                <span className="font-body-md text-body-md font-medium">{order.item}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-surface-container">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-outline">shopping_basket</span>
                  <span className="font-body-md text-body-md">{t('quantity')}</span>
                </div>
                <span className="font-body-md text-body-md font-medium">{order.quantity} units</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-surface-container">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-outline">event_available</span>
                  <span className="font-body-md text-body-md">{t('deadline')}</span>
                </div>
                <span className="font-body-md text-body-md font-medium text-primary">{new Date(order.deadline).toLocaleDateString(params.locale === 'hi' ? 'hi-IN' : 'en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-surface-container">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-outline">person</span>
                  <span className="font-body-md text-body-md">Entered By</span>
                </div>
                <span className="font-body-md text-body-md font-medium">{order.enteredBy || 'System'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-surface-container">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-outline">calendar_month</span>
                  <span className="font-body-md text-body-md">Entered At</span>
                </div>
                <span className="font-body-md text-body-md font-medium text-on-surface-variant">
                  {order.enteredAt ? (order.enteredAt.seconds ? new Date(order.enteredAt.seconds * 1000).toLocaleString(params.locale === 'hi' ? 'hi-IN' : 'en-IN') : new Date(order.enteredAt).toLocaleString(params.locale === 'hi' ? 'hi-IN' : 'en-IN')) : 'System'}
                </span>
              </div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center py-3 gap-2">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-outline">call</span>
                  <span className="font-body-md text-body-md">Buyer Phone</span>
                </div>
                <div className="flex flex-col items-end gap-1.5 w-full md:w-auto">
                  {order.status === 'pending_review' ? (
                    <input 
                      type="tel"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="Enter buyer phone"
                      className="px-2 py-1 text-xs border border-outline rounded bg-white text-right w-full md:w-48 font-mono focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  ) : (
                    <span className="font-body-md text-body-md font-medium">{order.buyerPhone || 'Not Entered'}</span>
                  )}
                  <button 
                    onClick={handleShareLink}
                    className="flex items-center gap-0.5 text-primary text-[11px] font-bold hover:underline cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">share</span>
                    Share Confirmation Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Area */}
        <div className="mt-stack-lg space-y-4 relative z-10">
          <button 
            onClick={handleDiscuss}
            className="w-full h-touch-target bg-primary-container text-on-primary-container rounded-lg font-label-lg text-label-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined">group</span>
            {t('discuss')}
          </button>
          
          <button 
            onClick={handleDecline}
            className="w-full h-touch-target border-2 border-outline text-outline rounded-lg font-label-lg text-label-lg flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer bg-white"
          >
            <span className="material-symbols-outlined">cancel</span>
            {t('decline')}
          </button>
        </div>

        {/* Voice Assistant Floating Button */}
        <div className="fixed bottom-24 right-container-padding z-40 flex flex-col items-center">
          <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm mb-2 border border-outline-variant">
            <span className="font-label-sm text-label-sm text-primary">
              {isListening ? 'Listening...' : voiceText ? `Cmd: "${voiceText}"` : 'Tap to Speak'}
            </span>
          </div>
          <button 
            onClick={startListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg relative group overflow-hidden transition-all duration-300 ${isListening ? 'bg-tertiary voice-pulse' : 'bg-primary'}`}
          >
            <span className="material-symbols-outlined text-3xl">
              {isListening ? 'graphic_eq' : 'mic'}
            </span>
            <div className="absolute inset-0 bg-white/10 scale-0 group-active:scale-150 transition-transform duration-500 rounded-full"></div>
          </button>
        </div>
      </main>

      {/* Styled toast feedback */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-sans text-sm font-semibold flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">verified</span>
          {toastMsg}
        </div>
      )}

      <Navbar />
      <DevBar />
    </div>
  );
}
