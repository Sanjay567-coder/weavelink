"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';
import { BrandedLoader } from '@/components/BrandedLoader';

interface PaymentData {
  memberId: string;
  amountOwed: number;
  status: 'pending' | 'paid';
  expectedDate: string;
  name?: string;
  avatarUrl?: string;
  loomId?: string;
}

export default function PaymentLedgerPage() {
  const t = useTranslations('screen7');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const { user, memberProfile } = useAuth();
  
  const orderId = params.orderId as string;
  const locale = (params.locale as string) || 'en';
  
  // Toggled view (Admin vs Weaver)
  const [viewMode, setViewMode] = useState<'admin' | 'weaver'>('admin');
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [voiceQueryText, setVoiceQueryText] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const translateExpectedDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.trim().split(' ');
    if (parts.length === 2) {
      const month = parts[0];
      const day = parts[1];
      const monthNames: Record<string, Record<string, string>> = {
        'hi': { 'Oct': 'अक्टूबर', 'Sep': 'सितंबर' },
        'ta': { 'Oct': 'அக்டோபர்', 'Sep': 'செப்டம்பர்' }
      };
      const translatedMonth = monthNames[locale]?.[month] || month;
      return locale === 'hi' || locale === 'ta' ? `${day} ${translatedMonth}` : `${translatedMonth} ${day}`;
    }
    return dateStr;
  };

  // Set default view mode based on role
  useEffect(() => {
    if (memberProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode(memberProfile.role === 'admin' || memberProfile.role === 'treasurer' ? 'admin' : 'weaver');
    }
  }, [memberProfile]);

  useEffect(() => {
    if (!orderId || !user || !memberProfile) return;

    const isAdminOrTreasurer = memberProfile.role === 'admin' || memberProfile.role === 'treasurer';

    const parsePaymentDoc = (docId: string, data: any): PaymentData => {
      // Mock visuals
      let name = 'Coop Weaver';
      let avatarUrl = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2';
      let loomId = 'Loom ID: BHU-092';

      if (docId === 'weaver-uid-888') {
        name = 'Ramesh Vankar';
        avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDF81uvfEdCzffLhKuRMJBl1iJPjEQ7FtDo_uFjO0NpS6U_vU-eKCt_mJjr7Oz7ite4G-Yge4P59rtAO1u5MTByF_a1yxUT7n6vbCpUaSGdiJe3rZ3wQI06QwWVPk2m-Zs2hjJhDlO24R4G2OKTmC10LeTVGp89Gn115M8UtLPQRUnzFuf07bL30NB4TzncvD2dbpnsvqE0rH1DSvO8Uoqd-I4q9UbKVGjwFe1xBkhs16JNzsSRZkKwCwRN01yBOKDDL0eNKtI7up0U';
        loomId = 'Loom ID: BHU-092';
      } else if (docId === 'weaver-uid-101') {
        name = 'Meera Devi';
        avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsCKVSHpEmQBUvlBEs80uTkDbXm7RyJVSC0887xaoTiB4FLVgePG9Enj-6sxuoIw6Z1jTs_ja3noU1Bj0F4XHBY6fm1UwMOfX4SlUTerIw1SRG_3kys0DXgFeLSEgB71ecFwWFVEWAo6l6f2Vss_LD5w1UefbZYR9qgvtutJjP_79qDy-wV1wGUe6RLi1qsl23f1MjLoGFYKPzTP2zrA4NbW7vPPBve4HoMjEG3ZuoKwMT30futKVkv-qAG1ycFMNZq2qAWzpFm-3B';
        loomId = 'Loom ID: BHU-114';
      } else if (docId === 'weaver-uid-102') {
        name = 'Sunil Kumar';
        avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZ8W9TLPqa_saXw2KSyxkW8KuwMXpaW4RQBKOUNSXe2xorJbePY0_FA10xoHm5Uc7sUkjAgDbfjEJBpjD2q9N5_W-9GX27ksyQ7dRywEMrY_N4yWohUIlBr2QdYKxxCiE7Rc6n1hzkaw4Tt7kLi-Y2gia16ODUMRxO0KTCzmXUeO2adyyU7Ftrds-quI23X5Yp8NjxH8oC7h6m4Z5z6EFCHw9ou3unM0pHcHxbs8ByumgtmQZ-MaThhxksBko-gLujexGQ5nnpIWJN';
        loomId = 'Loom ID: BHU-045';
      }

      return {
        name,
        avatarUrl,
        loomId,
        ...data,
        memberId: docId
      };
    };

    let unsub;

    if (isAdminOrTreasurer) {
      // Listen to real-time payment log updates
      unsub = onSnapshot(collection(db, 'orders', orderId, 'payments'), (snap) => {
        const payList: PaymentData[] = [];
        snap.forEach((docSnap) => {
          payList.push(parsePaymentDoc(docSnap.id, docSnap.data()));
        });
        setPayments(payList);
        setLoading(false);
      }, (err) => {
        console.error("Error loading payment ledger collection:", err);
        setLoading(false);
      });
    } else {
      // Listen to Weaver's own document only
      unsub = onSnapshot(doc(db, 'orders', orderId, 'payments', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const item = parsePaymentDoc(docSnap.id, docSnap.data());
          setPayments([item]);
        } else {
          setPayments([]);
        }
        setLoading(false);
      }, (err) => {
        console.error("Error loading single weaver payment doc:", err);
        setLoading(false);
      });
    }

    return () => unsub();
  }, [orderId, user, memberProfile]);

  // Mark all pending splits as paid (Admin action)
  const handleMarkAllPaid = async () => {
    // Only allow admin or treasurer role writes
    if (memberProfile?.role !== 'admin' && memberProfile?.role !== 'treasurer') {
      alert(t('alertPermissionDenied'));
      return;
    }

    try {
      const batch = writeBatch(db);
      payments.forEach((pay) => {
        if (pay.status === 'pending') {
          const docRef = doc(db, 'orders', orderId, 'payments', pay.memberId);
          batch.update(docRef, { status: 'paid' });
        }
      });
      await batch.commit();
      alert(t('alertAllPaid'));
    } catch (err: any) {
      console.error(err);
      alert(t('alertDbFailed', { error: err.message }));
    }
  };

  // Voice assistant querying
  const startVoiceQuery = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('alertSpeechUnsupported'));
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
      setVoiceQueryText('');
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
      setVoiceQueryText(speechText);
      parseVoicePaymentQuery(speechText.toLowerCase());
    };

    recognition.start();
  };

  const parseVoicePaymentQuery = (command: string) => {
    if (command.includes("when") || command.includes("due") || command.includes("payout") || command.includes("paid")) {
      const myPay = payments.find(p => p.memberId === user?.uid);
      if (myPay) {
        if (myPay.status === 'paid') {
          triggerToast(t('voicePayoutPaid', { amount: myPay.amountOwed }));
        } else {
          triggerToast(t('voicePayoutPending', { amount: myPay.amountOwed }));
        }
      } else {
        triggerToast(t('voiceNoProfile'));
      }
    } else {
      triggerToast(t('voiceDefaultHelp', { command }));
    }
  };

  if (loading) {
    return <BrandedLoader message="Syncing ledger sheets..." fullScreen />;
  }

  // Admin stats
  const totalRevenuePool = 75000;
  const pendingAmount = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amountOwed, 0);
  const pendingCount = payments.filter(p => p.status === 'pending').length;

  // Current logged in weaver's payment details
  const myPayment = payments.find(p => p.memberId === user?.uid) || {
    amountOwed: 4166,
    status: 'pending',
    expectedDate: 'Oct 20'
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-24 flex flex-col">
      <Header />

      <main className="max-w-xl mx-auto px-container-padding py-stack-lg space-y-stack-lg flex-grow w-full">
        
        {/* Toggle View Switcher (Admin/Treasurer only) */}
        {(memberProfile?.role === 'admin' || memberProfile?.role === 'treasurer') && (
          <div className="flex justify-center mb-8">
            <div className="bg-surface-container p-1 rounded-xl flex gap-1 shadow-sm border border-outline-variant/20">
              <button 
                onClick={() => setViewMode('admin')}
                className={`px-6 py-2 rounded-lg font-label-lg transition-all cursor-pointer ${
                  viewMode === 'admin' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {t('adminView')}
              </button>
              <button 
                onClick={() => setViewMode('weaver')}
                className={`px-6 py-2 rounded-lg font-label-lg transition-all cursor-pointer ${
                  viewMode === 'weaver' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {t('weaverView')}
              </button>
            </div>
          </div>
        )}

        {/* ADMIN VIEW CONTENT */}
        {viewMode === 'admin' ? (
          <section className="space-y-stack-lg animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {/* Summary Card */}
              <div className="bg-surface-container-low p-container-padding rounded-xl ikat-overlay relative overflow-hidden border border-outline-variant">
                <div className="relative z-10">
                  <p className="font-label-sm text-on-surface-variant uppercase tracking-wider">{t('revenuePool')}</p>
                  <h2 className="font-headline-lg text-headline-lg text-primary mt-1">₹{totalRevenuePool.toLocaleString('en-IN')}.00</h2>
                  <div className="flex items-center gap-2 mt-4 text-secondary">
                    <span className="material-symbols-outlined text-[20px]">event_repeat</span>
                    <span className="font-label-sm">{t('cycle', { range: 'Oct 1 - Oct 15, 2023' })}</span>
                  </div>
                </div>
              </div>

              {/* Action Payout Card */}
              <div className="bg-primary-container p-container-padding rounded-xl flex flex-col justify-between border border-primary text-on-primary-container">
                <div>
                  <p className="font-label-sm opacity-95">{t('pendingMembers', { count: pendingCount })}</p>
                  <p className="font-headline-md text-headline-md font-bold mt-1">₹{pendingAmount.toLocaleString('en-IN')}</p>
                </div>
                <button 
                  onClick={handleMarkAllPaid}
                  disabled={pendingCount === 0}
                  className="w-full h-touch-target mt-4 bg-on-primary-container text-primary-container font-label-lg rounded-lg shadow-lg active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
                >
                  {t('markAll')}
                </button>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="p-container-padding border-b border-outline-variant bg-surface-container-high flex justify-between items-center">
                <h3 className="font-label-lg text-on-surface">{t('disbursement')}</h3>
                <button 
                  onClick={() => triggerToast(t('toastPdfExport'))}
                  className="text-primary font-label-sm flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span> 
                  {t('exportPdf')}
                </button>
              </div>
              
              <div className="divide-y divide-outline-variant">
                {payments.map((p) => (
                  <div key={p.memberId} className="p-container-padding flex justify-between items-center ledger-line">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary-fixed">
                        <img className="w-full h-full object-cover" src={p.avatarUrl} alt={p.name} />
                      </div>
                      <div>
                        <p className="font-label-lg text-on-surface">{p.name}</p>
                        <p className="font-label-sm text-on-surface-variant text-xs">{p.loomId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-label-lg text-primary">₹{p.amountOwed.toLocaleString('en-IN')}.00</p>
                      <p className={`font-label-sm text-xs font-bold ${p.status === 'paid' ? 'text-emerald-600' : 'text-tertiary'}`}>
                        {p.status === 'paid' ? t('paidStatus') : t('dueStatus', { date: translateExpectedDate(p.expectedDate) })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          /* WEAVER VIEW CONTENT */
          <section className="space-y-stack-lg animate-in fade-in duration-200">
            <div className="bg-white p-container-padding rounded-xl border border-outline-variant shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="font-label-sm text-on-surface-variant uppercase">{t('settlement')}</p>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">
                    {t('expected', { amount: `₹${myPayment.amountOwed.toLocaleString('en-IN')}.00` })}
                  </h2>
                </div>
                
                <div className={`px-3 py-1 rounded-full flex items-center gap-1 border ${
                  myPayment.status === 'paid' 
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800' 
                    : 'bg-tertiary-container border-tertiary text-on-tertiary-fixed'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">
                    {myPayment.status === 'paid' ? 'check_circle' : 'pending_actions'}
                  </span>
                  <span className="font-label-sm">
                    {myPayment.status === 'paid' ? t('paidStatus') : t('pendingTransfer')}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-lg border border-outline-variant/30">
                  <span className="material-symbols-outlined text-secondary">info</span>
                  <p className="font-body-md text-on-surface-variant text-sm">
                    {myPayment.status === 'paid' 
                      ? t('disbursedInfo')
                      : t('fundsVerified')}
                  </p>
                </div>
                
                <div className="pt-4 border-t border-outline-variant flex justify-between items-center">
                  <button 
                    onClick={() => triggerToast(t('toastLoadHistory'))}
                    className="text-primary font-label-lg flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">history</span> 
                    {t('history')}
                  </button>
                  <p className="font-label-sm text-on-surface-variant text-xs">
                    {t('lastPayment', { amount: '₹3,850', date: 'Sep 30' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Breakdown Card */}
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-container-padding ikat-overlay shadow-sm">
              <h3 className="font-label-lg text-on-surface-variant mb-4">
                {t('earningsBreakdown', { cycle: 'Oct' })}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between font-body-md text-sm">
                  <span>{t('baseWage', { days: 15 })}</span>
                  <span className="font-semibold text-on-surface">₹3,500.00</span>
                </div>
                <div className="flex justify-between font-body-md text-sm">
                  <span>{t('bonus', { grade: 'Ikat Grade A' })}</span>
                  <span className="font-semibold text-tertiary">₹666.00</span>
                </div>
                <div className="flex justify-between font-body-md pt-3 border-t border-outline-variant text-base">
                  <span className="font-bold">{t('totalPayout')}</span>
                  <span className="font-bold text-primary">₹{(myPayment.amountOwed).toLocaleString('en-IN')}.00</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Voice Action FAB */}
        <div className="fixed bottom-24 right-container-padding z-40 flex flex-col items-center">
          <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm mb-2 border border-outline-variant text-center max-w-[180px] truncate">
            <span className="font-label-sm text-label-sm text-primary">
              {isListening ? t('voiceListening') : voiceQueryText ? t('voiceCommandLabel', { command: voiceQueryText }) : t('voiceTapToSpeak')}
            </span>
          </div>
          <button 
            onClick={startVoiceQuery}
            className={`w-[64px] h-[64px] rounded-full shadow-2xl flex items-center justify-center relative group overflow-hidden transition-all duration-300 ${isListening ? 'bg-tertiary voice-pulse' : 'bg-primary text-on-primary'}`}
          >
            <span className="material-symbols-outlined text-[32px]">
              {isListening ? 'graphic_eq' : 'mic'}
            </span>
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
