"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  doc, 
  onSnapshot, 
  collection, 
  updateDoc, 
  setDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';

interface OrderData {
  coopId: string;
  buyerName: string;
  item: string;
  quantity: number;
  price: number;
  deadline: string;
  status: string;
}

interface WeaverProgress {
  memberId: string;
  name?: string;
  avatarUrl?: string;
  percentComplete: number;
  unitsCompleted: number;
  assignedQuantity?: number;
  loomId?: string;
  itemDesign?: string;
  status?: 'track' | 'late';
  lateDays?: number;
}

export default function ProductionTrackingPage() {
  const t = useTranslations('screen6');
  const params = useParams();
  const router = useRouter();
  const { user, memberProfile } = useAuth();
  
  const orderId = params.orderId as string;
  const isWeaver = memberProfile?.role === 'weaver';

  const [order, setOrder] = useState<OrderData | null>(null);
  const [weaverProgressList, setWeaverProgressList] = useState<WeaverProgress[]>([]);
  const [myProgress, setMyProgress] = useState<WeaverProgress | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceLogText, setVoiceLogText] = useState('');

  useEffect(() => {
    if (!orderId) return;

    // 1. Listen to Order
    const unsubOrder = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        setOrder(docSnap.data() as OrderData);
      }
    });

    // 2. Listen to all progress entries in the subcollection
    const unsubProgress = onSnapshot(collection(db, 'orders', orderId, 'progress'), async (snap) => {
      try {
        // Load allocations to match assignedQuantity
        const allocSnap = await getDocs(collection(db, 'orders', orderId, 'allocations'));
        const allocMap: { [id: string]: number } = {};
        allocSnap.forEach((docSnap) => {
          allocMap[docSnap.id] = docSnap.data().assignedQuantity || 0;
        });

        const progressList: WeaverProgress[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as WeaverProgress;
          const assigned = allocMap[docSnap.id] || 3; // Default fallback to 3

          // Mock names, avatars and track status for visual completeness
          let name = 'Coop Weaver';
          let avatarUrl = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2';
          let loomId = 'Loom #12';
          let itemDesign = 'Silk Ikat';
          let status: 'track' | 'late' = 'track';
          let lateDays = 0;

          if (docSnap.id === 'weaver-uid-888') {
            name = 'Ramesh V.';
            avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvR6Ca9bBG7GG6xYaNoUuVWqBp6qh19bt1JIBwykDfQwhR1w-lMoHfgWlCPDox234GTfB_5U6WjOtbFNj_quXgU1VWUpqZ0wWZbV1f1Gu1PEW38eYZTCAggemDz8nd-9f7PzB_6YUOf6arDIA5-90npN4p4-mY-MOLYXZSssNQzNNGJ7g6qAnkp3KCUwQ21H-Td-YEcmCbXsCarCn8jlk8PEjw8FkwFIeRjAh7JSOv14i5s3XOhzQs1gns-Y-qcAGbbAft_gAPdlpH';
            loomId = 'Loom #12';
            itemDesign = 'Silk Ikat';
            status = 'track';
          } else if (docSnap.id === 'weaver-uid-101' || docSnap.id === 'weaver-uid-102') {
            name = 'Lakshmi S.';
            avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuACcrEV4LsOIgqaud5QBeOZ08L3Hn8dMyD79EtvlIjFx1DbVG1kGkSdyInH595nLb0ux0BJfzghu3nZDsAw0xJWc050bBqMYgXUYgAsm8aPCoHH5rDZ3ioqjBcobGsAK5OcR9Im4AEnfsm1XJsuZwBH8AMia1NfKWuCRXhu3VlmY31DhK1T_Lcar8SVo11lopVJD14Mjh1gx7jcfYoGQesx9BnAfnlHeRBzIGfcPcaKS2-78HruKKA7YPRHHSsAz_ZQZKOluiQ3mlFu';
            loomId = 'Loom #08';
            itemDesign = 'Cotton Jamdani';
            status = 'late';
            lateDays = 2;
          }

          const entry = {
            name,
            avatarUrl,
            loomId,
            itemDesign,
            status,
            lateDays,
            assignedQuantity: assigned,
            ...data,
            memberId: docSnap.id
          };

          progressList.push(entry);

          // Map current logged-in user's progress
          if (user && docSnap.id === user.uid) {
            setMyProgress(entry);
          }
        });
        setWeaverProgressList(progressList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubOrder();
      unsubProgress();
    };
  }, [orderId, user]);

  // Adjust weaver own checkin progress values
  const handleUpdateProgress = async (completedUnits: number) => {
    if (!user || !myProgress || !order) return;
    setUpdating(true);

    const assigned = myProgress.assignedQuantity || 3;
    const maxUnits = Math.min(completedUnits, assigned);
    const percentage = Math.round((maxUnits / assigned) * 100);

    try {
      const progressRef = doc(db, 'orders', orderId, 'progress', user.uid);
      await setDoc(progressRef, {
        percentComplete: percentage,
        unitsCompleted: maxUnits,
        timestamp: new Date()
      }, { merge: true });
    } catch (err: any) {
      alert("Error updating progress: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Voice Log: Web Speech API notes
  const startVoiceLog = () => {
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
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceLogText('');
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
      setVoiceLogText(speechText);
      parseVoiceLogProgress(speechText.toLowerCase());
    };

    recognition.start();
  };

  const parseVoiceLogProgress = (command: string) => {
    // E.g. "i finished 2 sarees" or "completed 3 units"
    const matchVal = command.match(/\d+/);
    if (matchVal) {
      const units = parseInt(matchVal[0]);
      handleUpdateProgress(units);
      alert(`Progress updated to ${units} units completed via voice input.`);
    } else {
      alert(`Voice logged: "${command}". Try saying "I completed 2 units".`);
    }
  };

  // Rollup calculations for Admin View
  const totalAllocatedUnits = weaverProgressList.reduce((sum, wp) => sum + (wp.assignedQuantity || 0), 0) || 1;
  const totalCompletedUnits = weaverProgressList.reduce((sum, wp) => sum + wp.unitsCompleted, 0);
  const overallPct = Math.round((totalCompletedUnits / totalAllocatedUnits) * 100);

  // Compute days remaining
  const getDaysRemaining = () => {
    if (!order) return 0;
    const diff = new Date(order.deadline).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
      </div>
    );
  }

  // Fallback profile if Firestore is offline/empty
  const displayProgress = myProgress || {
    unitsCompleted: 1,
    assignedQuantity: 3,
    percentComplete: 33.3
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-32 flex flex-col ikat-pattern">
      <Header />

      <main className="flex-1 px-container-padding py-stack-lg flex flex-col gap-stack-lg max-w-xl mx-auto w-full">
        
        {/* WEAVER VIEW CHECK-IN PROGRESS (renders if authenticated as weaver) */}
        {isWeaver ? (
          <section className="flex flex-col gap-stack-md">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {t('yourWork', { count: displayProgress.assignedQuantity || 3 })}
              </h2>
              <span className="bg-tertiary-fixed text-on-tertiary-fixed px-3 py-1 rounded-full font-label-sm text-label-sm">
                {t('activeLoom')}
              </span>
            </div>

            {/* Weaver Progress Checkin Card */}
            <div className="glass-card rounded-xl p-gutter shadow-sm flex flex-col gap-gutter border border-outline-variant/30">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span className="font-label-lg text-label-lg text-primary">{t('currentProgress')}</span>
                  <span className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
                    {t('finishedOf', { finished: Math.round(displayProgress.unitsCompleted), total: displayProgress.assignedQuantity || 3 })}
                  </span>
                </div>

                {/* Interactive Slider Input */}
                <div className="space-y-4">
                  <input 
                    type="range" 
                    min="0" 
                    max={displayProgress.assignedQuantity || 3} 
                    step="1"
                    value={Math.round(displayProgress.unitsCompleted)}
                    disabled={updating}
                    onChange={(e) => handleUpdateProgress(parseInt(e.target.value))}
                    className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between px-2 text-xs font-bold text-on-surface-variant/80">
                    {Array.from({ length: (displayProgress.assignedQuantity || 3) + 1 }).map((_, idx) => (
                      <span key={idx}>#{idx}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add voice note log action */}
              <div className="flex gap-stack-md">
                <button 
                  onClick={startVoiceLog}
                  disabled={isListening}
                  className={`flex-1 h-touch-target rounded-lg font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                    isListening ? 'bg-tertiary text-white voice-pulse' : 'bg-primary text-on-primary hover:bg-primary-container'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {isListening ? 'graphic_eq' : 'mic'}
                  </span>
                  {isListening ? 'Listening...' : t('addVoiceLog')}
                </button>
                <button 
                  onClick={() => alert("Mock Camera Upload: Taking photo of loom status")}
                  className="w-touch-target h-touch-target border-2 border-outline-variant text-primary rounded-lg flex items-center justify-center active:scale-95 duration-150 cursor-pointer bg-white"
                >
                  <span className="material-symbols-outlined">camera_enhance</span>
                </button>
              </div>

              {voiceLogText && (
                <p className="text-xs text-on-surface-variant italic bg-surface-container-low p-2 rounded border border-outline-variant/20">
                  Logged: "{voiceLogText}"
                </p>
              )}
            </div>
          </section>
        ) : null}

        {/* ADMIN ROLLUP PROGRESS DASHBOARD (renders if admin or guest, or visible alongside weaver for demo review completeness) */}
        {(!isWeaver || user === null) && (
          <section className="flex flex-col gap-stack-md">
            <h2 className="font-headline-md text-headline-md text-on-surface">{t('overallProgress')}</h2>
            
            <div className="grid grid-cols-1 gap-stack-md">
              {/* Main Progress Card */}
              <div className="bg-white border border-outline-variant rounded-xl p-gutter shadow-sm flex flex-col gap-stack-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Cooperative Batch #{orderId.replace('order-', '')}</p>
                    <p className="font-headline-lg text-headline-lg text-secondary">{overallPct}% Complete</p>
                  </div>
                  <div className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {t('remainingDays', { days: getDaysRemaining() })}
                  </div>
                </div>

                <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary rounded-full transition-all duration-700" 
                    style={{ width: `${overallPct}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-on-surface-variant font-label-sm">
                  <span>{t('started', { date: 'Oct 12' })}</span>
                  <span>{t('deadline', { date: order ? new Date(order.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Oct 28' })}</span>
                </div>
              </div>

              {/* Alert Card (Trigger warning banner if any weaver is late) */}
              {weaverProgressList.some(wp => wp.status === 'late') && (
                <div className="bg-error-container/30 border-2 border-error/20 rounded-xl p-gutter flex flex-col justify-between">
                  <div className="flex items-start gap-3">
                    <div className="bg-error rounded-full p-2 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-xl">priority_high</span>
                    </div>
                    <div>
                      <h4 className="font-label-lg text-label-lg text-error">{t('alertTitle')}</h4>
                      <p className="font-body-md text-body-md text-on-surface mt-1">
                        {weaverProgressList.find(wp => wp.status === 'late')?.name || 'Lakshmi S.'} is behind schedule
                      </p>
                    </div>
                  </div>
                  <a 
                    className="mt-4 flex items-center justify-center gap-2 bg-error text-on-error h-touch-target rounded-lg font-label-lg active:scale-95 duration-150 cursor-pointer" 
                    href="tel:+918888888001"
                  >
                    <span className="material-symbols-outlined">call</span>
                    {t('call')}
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Detailed Status List (Admin View) */}
        {(!isWeaver || user === null) && (
          <section className="flex flex-col gap-stack-sm">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-label-lg text-label-lg text-on-surface-variant">{t('stationUpdates')}</h3>
              <button className="text-primary font-label-sm cursor-pointer">{t('viewAll')}</button>
            </div>
            
            <div className="flex flex-col gap-2 bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
              {weaverProgressList.map((wp) => (
                <div 
                  key={wp.memberId} 
                  className="p-4 flex items-center justify-between border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant/30">
                      <img className="w-full h-full object-cover" src={wp.avatarUrl} alt={wp.name} />
                    </div>
                    <div>
                      <p className="font-label-lg text-label-lg text-on-surface">{wp.name}</p>
                      <p className="font-label-sm text-[11px] text-on-surface-variant">{wp.loomId} • {wp.itemDesign}</p>
                    </div>
                  </div>
                  
                  <span className={`font-label-sm flex items-center gap-1 ${
                    wp.status === 'track' ? 'text-tertiary' : 'text-error'
                  }`}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {wp.status === 'track' ? 'check_circle' : 'warning'}
                    </span>
                    {wp.status === 'track' ? t('onTrack') : t('late', { days: wp.lateDays ?? 0 })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      <Navbar />
      <DevBar />
    </div>
  );
}
