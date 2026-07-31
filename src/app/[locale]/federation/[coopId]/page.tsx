"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot, collection, query, addDoc, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';
import { BrandedLoader } from '@/components/BrandedLoader';
import { useTranslations } from 'next-intl';

interface MaterialRequirement {
  item: string;
  targetAmount: string;
  savings: string;
}

interface CooperativeDetail {
  id: string;
  name?: string;
  district?: string;
  weaversCount?: number;
  distance?: string;
  materials?: MaterialRequirement[];
}

export default function CooperativeDetailPage() {
  const t = useTranslations('screen8');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const coopId = params.coopId as string;
  const { user, memberProfile, loading: authLoading } = useAuth();

  const [coop, setCoop] = useState<CooperativeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || !memberProfile) {
      router.push(`/${locale}`);
      return;
    }

    // Subscribe to cooperative details
    const unsubCoop = onSnapshot(doc(db, 'cooperatives', coopId), (docSnap) => {
      if (docSnap.exists()) {
        setCoop({ id: docSnap.id, ...docSnap.data() } as CooperativeDetail);
      }
      setLoading(false);
    });

    const myCoopId = memberProfile.coopId || 'coop-kanchipuram';

    // Subscribe to pooling requests involving this coop using rule-compliant queries
    const q1 = query(collection(db, 'poolingRequests'), where('fromCoopId', '==', myCoopId));
    const q2 = query(collection(db, 'poolingRequests'), where('toCoopId', '==', myCoopId));

    let list1: any[] = [];
    let list2: any[] = [];

    const updateRequestsList = (l1: any[], l2: any[]) => {
      const merged = [...l1];
      l2.forEach((item) => {
        if (!merged.some((r) => r.id === item.id)) {
          merged.push(item);
        }
      });
      setRequests(merged);
    };

    const unsubReqs1 = onSnapshot(q1, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      list1 = list;
      updateRequestsList(list1, list2);
    }, (err) => console.error("Error in q1:", err));

    const unsubReqs2 = onSnapshot(q2, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      list2 = list;
      updateRequestsList(list1, list2);
    }, (err) => console.error("Error in q2:", err));

    return () => {
      unsubCoop();
      unsubReqs1();
      unsubReqs2();
    };
  }, [coopId, user, memberProfile, authLoading, locale, router]);

  if (authLoading || loading) {
    return <BrandedLoader message="Loading cooperative details..." fullScreen />;
  }

  if (!coop) {
    return (
      <div className="bg-background text-on-surface min-h-screen pb-32 flex flex-col">
        <Header />
        <main className="max-w-md mx-auto p-6 text-center space-y-4 flex-grow flex flex-col justify-center">
          <p className="text-on-surface-variant font-bold">Cooperative not found.</p>
          <button 
            onClick={() => router.push(`/${locale}/federation`)} 
            className="text-primary font-bold hover:underline"
          >
            Back to Federation Page
          </button>
        </main>
        <Navbar />
      </div>
    );
  }

  const myCoopId = memberProfile?.coopId || 'coop-kanchipuram';
  
  // Check if invitation already exists
  const pendingRequest = requests.find(r => r.fromCoopId === myCoopId && r.toCoopId === coopId && r.status === 'pending');
  const incomingRequest = requests.find(r => r.fromCoopId === coopId && r.toCoopId === myCoopId && r.status === 'pending');
  const acceptedRequest = requests.find(r => 
    ((r.fromCoopId === myCoopId && r.toCoopId === coopId) || (r.fromCoopId === coopId && r.toCoopId === myCoopId)) && 
    r.status === 'accepted'
  );

  // Compute aggregate savings potential
  const totalSavings = coop.materials?.reduce((sum, m) => {
    const val = parseInt(m.savings.replace(/[^\d]/g, '')) || 0;
    return sum + val;
  }, 0) || 0;

  const handleSendInvite = async () => {
    if (memberProfile?.role !== 'admin') {
      triggerToast(t('toastOnlyAdminsSend'));
      return;
    }

    if (pendingRequest) {
      triggerToast(t('toastAlreadyPending'));
      return;
    }

    if (incomingRequest) {
      triggerToast(t('toastAlreadyInvited'));
      return;
    }

    if (acceptedRequest) {
      triggerToast(t('toastPoolConfirmed'));
      return;
    }

    try {
      // Aggregate materials details
      const items = coop.materials?.map(m => m.item).join(', ') || 'Bulk Materials';
      const amounts = coop.materials?.map(m => m.targetAmount).join(', ') || '100 units';

      await addDoc(collection(db, 'poolingRequests'), {
        fromCoopId: myCoopId,
        toCoopId: coopId,
        status: 'pending',
        createdAt: new Date(),
        item: items,
        targetAmount: amounts,
        savings: `₹${totalSavings.toLocaleString('en-IN')}`
      });

      triggerToast(t('toastInvitationSent', { name: coop.name || '' }));
    } catch (err: any) {
      console.error(err);
      triggerToast("Error sending invitation: " + err.message);
    }
  };

  const handleAcceptInvite = async (requestId: string) => {
    if (memberProfile?.role !== 'admin') {
      triggerToast(t('onlyAdminsAccept'));
      return;
    }
    try {
      await updateDoc(doc(db, 'poolingRequests', requestId), {
        status: 'accepted'
      });
      triggerToast(t('toastAcceptSuccess'));
    } catch (err: any) {
      console.error(err);
      triggerToast("Error accepting invite: " + err.message);
    }
  };

  const handleDeclineInvite = async (requestId: string) => {
    if (memberProfile?.role !== 'admin') {
      triggerToast(t('toastDeclineOnlyAdmins'));
      return;
    }
    try {
      await updateDoc(doc(db, 'poolingRequests', requestId), {
        status: 'declined'
      });
      triggerToast(t('toastDeclineSuccess'));
    } catch (err: any) {
      console.error(err);
      triggerToast("Error declining invite: " + err.message);
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-32 flex flex-col">
      <Header />

      <main className="max-w-xl mx-auto px-container-padding pt-6 space-y-6 flex-grow w-full">
        
        {/* Back Navigation */}
        <button 
          onClick={() => router.push(`/${locale}/federation`)}
          className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer group font-semibold"
        >
          <span className="material-symbols-outlined text-sm group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
          {t('backToInsights')}
        </button>

        {/* Cooperative Info Card */}
        <section className="bg-white rounded-2xl shadow-sm border border-outline-variant p-6 space-y-4">
          <div className="space-y-1">
            <span className="bg-primary-container text-on-primary-container px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {t('opportunityDetail')}
            </span>
            <h2 className="font-headline-md text-2xl font-extrabold text-on-surface">{coop.name}</h2>
            <p className="text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-primary">location_on</span>
              {t('districtLabel', { district: coop.district || '' })} • {coop.distance} {t('away')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-b border-surface-container py-4">
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{t('activeWeavers')}</p>
              <p className="text-lg font-extrabold text-on-surface mt-0.5">{t('weaversCountLabel', { count: coop.weaversCount || 0 })}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{t('totalSavingsPotential')}</p>
              <p className="text-lg font-extrabold text-emerald-700 mt-0.5">₹{totalSavings.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </section>

        {/* Material Breakdown */}
        <section className="space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-primary">inventory_2</span>
            {t('materialBreakdown')}
          </h3>

          <div className="space-y-3">
            {coop.materials && coop.materials.length > 0 ? (
              coop.materials.map((mat, index) => (
                <div 
                  key={index}
                  className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm flex justify-between items-center"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm text-on-surface">{mat.item}</p>
                    <p className="text-xs text-on-surface-variant">{t('targetQuantity')}: <span className="font-semibold text-on-surface">{mat.targetAmount}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-on-surface-variant uppercase font-bold">{t('estSavings')}</p>
                    <p className="text-sm font-extrabold text-primary">{mat.savings}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-on-surface-variant italic py-3 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant">
                {t('noMaterials')}
              </p>
            )}
          </div>
        </section>

        {/* Actions Section */}
        <section className="pt-4">
          {acceptedRequest ? (
            <button
              disabled
              className="w-full h-12 bg-emerald-100 text-emerald-800 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-emerald-200 cursor-not-allowed opacity-90 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              {t('poolActive')}
            </button>
          ) : pendingRequest ? (
            <button
              disabled
              className="w-full h-12 bg-amber-100 text-amber-800 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-amber-200 cursor-not-allowed opacity-90 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm font-bold">schedule</span>
              {t('inviteSentAwaiting')}
            </button>
          ) : incomingRequest ? (
            <div className="flex flex-col gap-2">
              <div className="bg-primary-container/20 border border-primary/20 text-on-primary-container rounded-xl p-4 flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary text-xl">mail</span>
                <div className="text-xs">
                  <p className="font-extrabold">{t('coopInvitation')}</p>
                  <p className="text-on-surface-variant mt-0.5">{t('invitedYouToPool', { name: coop.name || '' })}</p>
                </div>
              </div>
              
              {memberProfile?.role === 'admin' ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAcceptInvite(incomingRequest.id)}
                    className="flex-1 h-12 bg-primary text-on-primary hover:bg-surface-tint rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all duration-100 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {t('acceptInvite')}
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(incomingRequest.id)}
                    className="flex-1 h-12 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all duration-100 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    {t('notRequired')}
                  </button>
                </div>
              ) : (
                <div className="w-full bg-surface-container border border-outline-variant text-on-surface-variant rounded-xl p-4 text-center text-xs">
                  {t('onlyAdminsAccept')}
                </div>
              )}
            </div>
          ) : memberProfile?.role === 'admin' ? (
            <button
              onClick={handleSendInvite}
              className="w-full h-12 bg-primary text-on-primary hover:bg-surface-tint rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all duration-100 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm font-bold">send</span>
              {t('sendPoolInvite')}
            </button>
          ) : (
            <div className="w-full bg-surface-container border border-outline-variant text-on-surface-variant rounded-xl p-4 text-center text-xs">
              {t('onlyAdminsSend')}
            </div>
          )}
        </section>

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
