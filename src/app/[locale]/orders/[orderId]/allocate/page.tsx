"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  doc, 
  onSnapshot, 
  collection, 
  getDocs, 
  setDoc, 
  writeBatch,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { DevBar } from '@/components/DevBar';
import { useAuth } from '@/context/AuthContext';
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

interface WeaverData {
  id: string;
  name: string;
  role: string;
  phone: string;
  capacity: number;
  busyPercentage: number;
  grade: string;
  loomId: string;
  avatarUrl: string;
  specialization?: string;
}

export default function WorkAllocationPage() {
  const t = useTranslations('screen5');
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  
  const orderId = params.orderId as string;
  
  const [order, setOrder] = useState<OrderData | null>(null);
  const [weavers, setWeavers] = useState<WeaverData[]>([]);
  const [allocations, setAllocations] = useState<{ [weaverId: string]: number }>({});
  
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceCommandText, setVoiceCommandText] = useState('');

  useEffect(() => {
    if (!orderId || !user) return;

    // Load order data
    const unsubOrder = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        setOrder(docSnap.data() as OrderData);
      }
    });

    // Load weavers and any pre-existing allocations
    const loadData = async () => {
      try {
        // Load weavers in this coop
        const qWeavers = query(collection(db, 'members'), where('coopId', '==', 'coop-kanchipuram'));
        const weaverSnap = await getDocs(qWeavers);
        const weaverList: WeaverData[] = [];
        
        weaverSnap.forEach((docSnap) => {
          const data = docSnap.data();
          // Filter to only weavers
          if (data.role === 'weaver') {
            // Mock visual properties for table
            let busyPercentage = 20;
            let grade = 'Master Grade';
            let loomId = 'Loom 02';
            let avatarUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d';

            if (docSnap.id === 'weaver-uid-888') {
              busyPercentage = 60;
              grade = 'Master Grade';
              loomId = 'Loom 02';
              avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnbbGRg-mGls7H3-iBf4_gPD_BZnzn3SOJ54KxsbE26yq2jOUg7WxUOCWY1ekEWMqodw15tnhOWtkfA1vhpHXk78NIp865c9m61HrWiKC0o8ic1BPlsMm9WAtzVmo7Ndq3_peOt3ZXy7RFMk-aeZvtXO8kCCXLCnLKLauitqqtQRbr5M6srZs6UwGrqErOrdXCuuXcmZ4MI9gfyF9RuJvt56Z5GtgcRUncQtXlWROr3W8HuK-Odx786sazYfV8hzZrvx6rqPjDGIMg';
            } else if (docSnap.id === 'weaver-uid-101') {
              busyPercentage = 20;
              grade = 'Advanced';
              loomId = 'Loom 14';
              avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC0Y_gj6KMCSTqRl6K7AnyPaFMmnk9ukbSKRNMo1t8SwwErnFgt3Eq4IBIIEnXbX8rlI5isvAoAafm19NKNAh34FY3kSG9Kl9oQkiHp9GUIrdHD7WLnHB2PMzAb3dQ7rBUUdXwpJDLDssUJTifJAMZ0ySW4ZqR6jEvI7ZNN5bwBLAG2W_pagUlWbQgt-yPgJZRdZPh79Ku2xR4E0N-_69umSrSAePbHtZxpMPIm1vnV7MV1Il77mODFpRCJkfu05tsqSq7cif5RzUzD';
            } else if (docSnap.id === 'weaver-uid-102') {
              busyPercentage = 85;
              grade = 'Intermediate';
              loomId = 'Loom 07';
              avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuB8b5A-HlQviT-n-ZbnNIoOb9bwfTm5I7CpYlwNe76gjIEO9IQDzPXWdtV6Jl8koSXbz5sxxIc-rjNXmxX46Sd-yQgHxH0Rnr4VwI2Ao1z1Fgls92DqbEzr9uMIHmQTpQ1ecQFwoeBT-I182AIN5fcwacxieDJWWw0DQUbKLgass9zimdldTBeOWF8wtwPrEgvwGkxZ3l3Rc2U-zFAQ2MWiyZdyqZWISaRrvMHg09cBbUKGMI0yIX-QNdG2-yc1Z09EE152pEYGbHOP';
            }

            weaverList.push({
              id: docSnap.id,
              busyPercentage,
              grade,
              loomId,
              avatarUrl,
              ...data
            } as WeaverData);
          }
        });
        setWeavers(weaverList);

        // Load pre-existing allocations if any
        const allocSnap = await getDocs(collection(db, 'orders', orderId, 'allocations'));
        const allocMap: { [weaverId: string]: number } = {};
        allocSnap.forEach((docSnap) => {
          allocMap[docSnap.id] = docSnap.data().assignedQuantity || 0;
        });
        
        // Default initial values to 0 if not set
        weaverList.forEach((w) => {
          if (allocMap[w.id] === undefined) {
            allocMap[w.id] = 0;
          }
        });
        setAllocations(allocMap);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    return () => {
      unsubOrder();
    };
  }, [orderId, user]);

  // Total allocated sum
  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + v, 0);

  // Proportional Split Algorithm
  const handleApplyAllAutoSuggest = () => {
    if (!order || weavers.length === 0) return;
    
    const targetQuantity = order.quantity;
    
    // Sum capacities
    const totalCapacity = weavers.reduce((sum, w) => sum + w.capacity, 0);
    
    if (totalCapacity === 0) return;

    let remaining = targetQuantity;
    const newAllocations: { [id: string]: number } = {};

    weavers.forEach((w, index) => {
      if (index === weavers.length - 1) {
        // Last weaver takes the remainder to resolve rounding issues
        newAllocations[w.id] = remaining;
      } else {
        // Deterministic proportional allocation based on weaver capacity
        const share = Math.round((w.capacity / totalCapacity) * targetQuantity);
        newAllocations[w.id] = Math.min(share, remaining);
        remaining -= newAllocations[w.id];
      }
    });

    setAllocations(newAllocations);
  };

  const handleAdjustAllocation = (weaverId: string, amount: number) => {
    setAllocations((prev) => {
      const newVal = Math.max(0, (prev[weaverId] || 0) + amount);
      return { ...prev, [weaverId]: newVal };
    });
  };

  // Voice command handling
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
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceCommandText('');
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
      setVoiceCommandText(speechText);
      parseVoiceAllocation(speechText.toLowerCase());
    };

    recognition.start();
  };

  const parseVoiceAllocation = (command: string) => {
    // E.g. "assign 5 to ramesh" or "set deepika to 8"
    const matchVal = command.match(/\d+/); // extracts number
    if (!matchVal) {
      alert(`Could not parse quantity from: "${command}". Try saying "assign 5 to Ramesh"`);
      return;
    }
    const val = parseInt(matchVal[0]);

    // Find weaver matching command
    const matchedWeaver = weavers.find((w) => {
      const nameParts = w.name.toLowerCase().split(' ');
      return nameParts.some(part => command.includes(part));
    });

    if (matchedWeaver) {
      setAllocations((prev) => ({ ...prev, [matchedWeaver.id]: val }));
      alert(`Allocated ${val} units to ${matchedWeaver.name} via voice command.`);
    } else {
      alert(`Parsed quantity ${val}, but could not identify weaver name. Weavers available: ${weavers.map(w => w.name).join(', ')}`);
    }
  };

  // Finalize writes
  const handleFinalize = async () => {
    if (!order) return;
    if (totalAllocated !== order.quantity) {
      alert(`Warning: Total allocated (${totalAllocated}) must equal requested quantity (${order.quantity}) before finalizing.`);
      return;
    }

    try {
      const batch = writeBatch(db);

      // Save each allocation to order's allocations subcollection
      Object.keys(allocations).forEach((weaverId) => {
        const allocRef = doc(db, 'orders', orderId, 'allocations', weaverId);
        batch.set(allocRef, {
          assignedQuantity: allocations[weaverId]
        }, { merge: true });
        
        // Initialize payments subcollection with calculated pay rate
        const paymentRef = doc(db, 'orders', orderId, 'payments', weaverId);
        const ratePerUnit = 1500; // Mock rate based on Screen 7
        const amountOwed = allocations[weaverId] * ratePerUnit;
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() + 30); // 30 days due
        
        batch.set(paymentRef, {
          memberId: weaverId,
          amountOwed,
          status: 'pending',
          expectedDate: expectedDate.toISOString().split('T')[0]
        }, { merge: true });

        // Initialize progress tracker subcollection
        const progressRef = doc(db, 'orders', orderId, 'progress', weaverId);
        batch.set(progressRef, {
          memberId: weaverId,
          percentComplete: 0,
          unitsCompleted: 0,
          timestamp: new Date()
        }, { merge: true });
      });

      // Update Order Status to in_production
      const orderRef = doc(db, 'orders', orderId);
      batch.update(orderRef, {
        status: 'in_production'
      });

      await batch.commit();

      alert("Allocation saved successfully! Status updated to production.");
      router.push(`/${params.locale || 'en'}/production/${orderId}`);
    } catch (err: any) {
      console.error(err);
      alert("Error saving allocations: " + err.message);
    }
  };

  if (loading) {
    return <BrandedLoader message="Analyzing looms capacity..." fullScreen />;
  }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-32 flex flex-col">
      {/* Transactional task subpage: Suppress bottom navigation, custom Back Header */}
      <Header showBack backPath={`/${params.locale || 'en'}/orders/${orderId}`} />

      <main className="flex-grow pt-6 px-container-padding max-w-2xl mx-auto w-full relative">
        
        {/* Header Section: Confirmation */}
        {order && (
          <section className="mb-stack-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white p-gutter rounded-xl shadow-sm border border-outline-variant relative overflow-hidden">
              <div className="absolute inset-0 ikat-overlay pointer-events-none"></div>
              <div className="flex items-center gap-4 mb-stack-sm">
                <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    {t('confirmedTitle', { num: orderId.replace('order-', '') })}
                  </h2>
                  <p className="font-body-md text-on-surface-variant">
                    {t('confirmedSub', { units: order.quantity, item: order.item, date: '22 Nov' })}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Auto-Suggest Recommendation Banner */}
        <section className="mb-stack-lg">
          <div className="bg-tertiary-fixed text-on-tertiary-fixed p-gutter rounded-xl flex items-center justify-between border border-tertiary-container shadow-md">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined">auto_fix_high</span>
              <span className="font-label-lg text-label-lg">
                {t('recommendation', { suggested: 3, count: weavers.length })}
              </span>
            </div>
            <button 
              onClick={handleApplyAllAutoSuggest}
              className="bg-tertiary-container text-on-tertiary-container px-4 py-2 rounded-full font-label-sm hover:opacity-90 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              {t('applyAll')}
            </button>
          </div>
        </section>

        {/* Work Allocation Table */}
        <section className="bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden mb-stack-lg">
          <div className="px-gutter py-4 border-b border-outline-variant bg-surface-container flex justify-between items-center">
            <h3 className="font-label-lg text-label-lg">{t('workforce')}</h3>
            <div className="flex gap-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">
                {t('allocatedLabel')}: <span className={`${totalAllocated === order?.quantity ? 'text-emerald-600 font-bold' : 'text-primary font-bold'}`}>
                  {totalAllocated} / {order?.quantity}
                </span>
              </span>
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-gutter py-3 bg-surface-container-low text-on-surface-variant font-label-sm border-b border-outline-variant uppercase tracking-wider">
            <div className="col-span-5">{t('weaverName')}</div>
            <div className="col-span-4">{t('capacity')}</div>
            <div className="col-span-3 text-right">{t('allocation')}</div>
          </div>

          {/* Weaver Rows */}
          <div className="divide-y divide-outline-variant">
            {weavers.map((weaver) => (
              <div 
                key={weaver.id}
                className="grid grid-cols-12 gap-4 px-gutter py-4 items-center hover:bg-surface-container-low transition-colors"
              >
                <div className="col-span-5 flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full bg-cover" 
                    style={{ backgroundImage: `url('${weaver.avatarUrl}')` }}
                  ></div>
                  <div>
                    <p className="font-label-lg text-label-lg">{weaver.name}</p>
                    <p className="text-label-sm text-on-surface-variant text-[11px]">{weaver.loomId} • {weaver.grade}{weaver.specialization && ` • ${weaver.specialization}`}</p>
                  </div>
                </div>
                
                <div className="col-span-4">
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span>{t('busy', { pct: weaver.busyPercentage })}</span>
                    <span>{t('capacityLeft', { units: weaver.capacity })}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div 
                      className={`h-full capacity-bar-transition ${weaver.busyPercentage > 80 ? 'bg-error' : 'bg-secondary'}`}
                      style={{ width: `${weaver.busyPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="col-span-3 flex justify-end items-center">
                  <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-outline h-touch-target">
                    <button 
                      onClick={() => handleAdjustAllocation(weaver.id, -1)}
                      className="w-8 h-8 flex items-center justify-center text-on-surface-variant cursor-pointer active:scale-90"
                    >
                      <span className="material-symbols-outlined text-sm">remove_circle</span>
                    </button>
                    <span className="font-headline-lg-mobile text-headline-lg-mobile px-2 min-w-[20px] text-center">
                      {allocations[weaver.id] || 0}
                    </span>
                    <button 
                      onClick={() => handleAdjustAllocation(weaver.id, 1)}
                      className="w-8 h-8 flex items-center justify-center text-primary cursor-pointer active:scale-90"
                    >
                      <span className="material-symbols-outlined text-sm">add_circle</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-gutter text-center bg-surface-container-low border-t border-outline-variant">
            <button className="text-primary font-label-lg hover:underline cursor-pointer">
              {t('viewMore', { count: 12 })}
            </button>
          </div>
        </section>

        {/* Floating Voice Assistant Button */}
        <div className="fixed bottom-24 right-container-padding z-40 flex flex-col items-center">
          <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm mb-2 border border-outline-variant text-center max-w-[180px] truncate">
            <span className="font-label-sm text-label-sm text-primary">
              {isListening ? 'Listening...' : voiceCommandText ? `Cmd: "${voiceCommandText}"` : 'Tap to Speak'}
            </span>
          </div>
          <button 
            onClick={startListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg relative group overflow-hidden transition-all duration-300 ${isListening ? 'bg-tertiary voice-pulse' : 'bg-primary'}`}
          >
            <span className="material-symbols-outlined text-3xl">
              {isListening ? 'graphic_eq' : 'mic'}
            </span>
          </button>
        </div>
      </main>

      {/* Sticky Finalize Footer */}
      <footer className="fixed bottom-0 left-0 w-full bg-white border-t border-outline-variant p-4 z-50 shadow-[0_-4px_12px_rgba(30,27,75,0.08)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p className="text-label-sm text-on-surface-variant">
              {t('allocatingSummary', { units: totalAllocated, count: Object.keys(allocations).filter(k => allocations[k] > 0).length })}
            </p>
            <p className="text-xs text-secondary italic">
              {t('estTime', { days: 14 })}
            </p>
          </div>
          <button 
            onClick={handleFinalize}
            className="flex-1 sm:flex-none h-14 bg-primary text-on-primary px-container-padding rounded-xl font-label-lg flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-95 cursor-pointer"
          >
            <span>{t('finalize')}</span>
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </footer>
      
      <DevBar />
    </div>
  );
}
