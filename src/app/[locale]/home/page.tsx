"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';
import { BrandedLoader } from '@/components/BrandedLoader';

interface DashboardStats {
  activeOrdersCount: number;
  discussingOrdersCount: number;
  confirmedOrdersCount: number;
  weaverVotesPending: boolean;
  myProgressPercent: number;
  myProgressFinished: number;
  myProgressTotal: number;
  myPayoutAmount: number;
  myPayoutStatus: string;
  totalPendingDisbursement: number;
  pendingWeaversCount: number;
}

export default function HomeDashboardPage() {
  const t = useTranslations('screen1');
  const tCommon = useTranslations('common');
  const tScreen6 = useTranslations('screen6');
  const tScreen7 = useTranslations('screen7');
  const tScreen8 = useTranslations('screen8');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { user, memberProfile, loading: authLoading } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats>({
    activeOrdersCount: 0,
    discussingOrdersCount: 0,
    confirmedOrdersCount: 0,
    weaverVotesPending: false,
    myProgressPercent: 0,
    myProgressFinished: 0,
    myProgressTotal: 0,
    myPayoutAmount: 0,
    myPayoutStatus: 'pending',
    totalPendingDisbursement: 0,
    pendingWeaversCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [poolingPartnersCount, setPoolingPartnersCount] = useState(0);

  interface Candidate {
    id: string;
    name: string;
    phone: string;
    role: string;
  }
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (authLoading || !user || !memberProfile) return;
    const coopId = memberProfile.coopId || 'coop-kanchipuram';
    
    const qPoolingCoops = query(collection(db, 'cooperatives'), where('availableForPooling', '==', true));
    const unsub = onSnapshot(qPoolingCoops, (coopSnap) => {
      let count = 0;
      coopSnap.forEach((doc) => {
        if (doc.id !== coopId) {
          count++;
        }
      });
      setPoolingPartnersCount(count);
    });

    return () => unsub();
  }, [user, memberProfile, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !memberProfile) {
      router.push(`/${locale}`);
      return;
    }

    const coopId = memberProfile.coopId || 'coop-kanchipuram';
    
    // Subscribe to orders to calculate dashboard stats
    const qOrders = query(collection(db, 'orders'), where('coopId', '==', coopId));
    
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      let active = 0;
      let discussing = 0;
      let confirmed = 0;
      let hasVotesPending = false;

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const status = data.status;
        if (status === 'pending_review') active++;
        if (status === 'discussing') {
          discussing++;
          // Mock alert check: Order 8922 requires votes
          if (docSnap.id === 'order-8922') {
            hasVotesPending = true;
          }
        }
        if (status === 'confirmed') confirmed++;
      });

      // Fetch additional stats for weaver and treasurer
      // Weaver: active loom progress (read from order-4421 progress subcollection)
      const progressRef = collection(db, 'orders', 'order-4421', 'progress');
      const unsubProgress = onSnapshot(progressRef, (progSnap) => {
        let myPercent = 60; // Mock fallback
        let finished = 12;
        let total = 20;

        progSnap.forEach((pDoc) => {
          if (pDoc.id === user.uid) {
            const pData = pDoc.data();
            myPercent = pData.percentage || 0;
            finished = pData.unitsCompleted || 0;
            total = pData.assignedQuantity || 12;
          }
        });

        // Treasurer: pending payouts from order-4421 payments
        const paymentsRef = collection(db, 'orders', 'order-4421', 'payments');
        const unsubPayments = onSnapshot(paymentsRef, (paySnap) => {
          let totalPending = 0;
          let countWeavers = 0;
          let myPayAmount = 4166;
          let myPayStatus = 'pending';

          paySnap.forEach((payDoc) => {
            const payData = payDoc.data();
            if (payDoc.id === user.uid) {
              myPayAmount = payData.amountOwed || 4166;
              myPayStatus = payData.status || 'pending';
            }
            if (payData.status === 'pending') {
              totalPending += payData.amountOwed || 0;
              countWeavers++;
            }
          });

          setStats({
            activeOrdersCount: active,
            discussingOrdersCount: discussing,
            confirmedOrdersCount: confirmed,
            weaverVotesPending: hasVotesPending,
            myProgressPercent: myPercent,
            myProgressFinished: finished,
            myProgressTotal: total,
            myPayoutAmount: myPayAmount,
            myPayoutStatus: myPayStatus,
            totalPendingDisbursement: totalPending,
            pendingWeaversCount: countWeavers
          });
          setLoading(false);
        });

        return () => unsubPayments();
      });

      return () => unsubProgress();
    });

    return () => unsubOrders();
  }, [user, memberProfile, authLoading, locale, router]);

  const handleOpenAddMember = async () => {
    setLoadingCandidates(true);
    setSelectedCandidate(null);
    setShowAddMemberModal(true);
    try {
      const q = query(collection(db, 'members'));
      const querySnapshot = await getDocs(q);
      const list: Candidate[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.coopId || data.coopId === '') {
          list.push({
            id: doc.id,
            name: data.name || 'Anonymous',
            phone: data.phone || '',
            role: data.role || 'weaver'
          });
        }
      });
      setCandidates(list);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleConfirmAddMember = async () => {
    if (!selectedCandidate || !memberProfile) return;
    const myCoopId = memberProfile.coopId || 'coop-kanchipuram';
    try {
      const memberRef = doc(db, 'members', selectedCandidate.id);
      await updateDoc(memberRef, {
        coopId: myCoopId,
        role: 'weaver'
      });
      
      setCandidates(prev => prev.filter(c => c.id !== selectedCandidate.id));
      setSelectedCandidate(null);
      
      setToastMsg(tCommon('successAddMember'));
      setTimeout(() => setToastMsg(''), 4000);
      
      setTimeout(() => setShowAddMemberModal(false), 800);
    } catch (err: any) {
      console.error("Error adding member:", err);
      setToastMsg("Error: " + err.message);
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  if (authLoading || loading || !memberProfile) {
    return <BrandedLoader message="Syncing dashboard information..." fullScreen />;
  }

  const role = memberProfile.role;

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-32 flex flex-col relative overflow-hidden">
      {/* Background Ikat pattern overlay */}
      <div className="absolute inset-0 ikat-pattern pointer-events-none opacity-5" style={{ height: '300px' }}></div>
      <Header />

      <main className="flex-1 max-w-md mx-auto px-container-padding py-stack-lg flex flex-col gap-stack-md w-full relative z-10">
        
        {/* Welcome Section */}
        <section className="flex flex-col">
          <p className="text-xs text-primary font-bold uppercase tracking-widest">{t('coopHub')}</p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            {t('namaste', { name: memberProfile.name.split(' ')[0] })}
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            {t('loggedInAs', { 
              role: role === 'admin' 
                ? tCommon('roleAdmin') 
                : role === 'treasurer' 
                ? tCommon('roleTreasurer') 
                : role === 'weaver' 
                ? tCommon('roleWeaver') 
                : role 
            })}
          </p>
        </section>

        {/* 1. ADMIN DASHBOARD */}
        {role === 'admin' && (
          <section className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-shadow">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">{t('newQuotes')}</span>
                <span className="text-3xl font-extrabold text-primary block mt-1">{stats.activeOrdersCount}</span>
                <span className="text-[10px] text-on-surface-variant block mt-1">{t('awaitingReview')}</span>
              </div>
              <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-shadow">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">{t('inDiscussion')}</span>
                <span className="text-3xl font-extrabold text-tertiary block mt-1">{stats.discussingOrdersCount}</span>
                <span className="text-[10px] text-on-surface-variant block mt-1">{t('votesPinned')}</span>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-label-lg text-on-surface font-bold">{t('quickActions')}</h3>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => router.push(`/${locale}/orders/new`)}
                  className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform duration-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                  {t('postNewOrder')}
                </button>
                <button 
                  onClick={() => router.push(`/${locale}/orders`)}
                  className="w-full h-11 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">assignment</span>
                  {t('manageActiveOrders')}
                </button>
                <button 
                  onClick={() => router.push(`/${locale}/federation`)}
                  className="w-full h-11 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100 cursor-pointer relative"
                >
                  <span className="material-symbols-outlined text-sm">hub</span>
                  {t('findPoolingPartners')}
                  {poolingPartnersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-tertiary text-on-tertiary text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                      {poolingPartnersCount}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => handleOpenAddMember()}
                  className="w-full h-11 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  {tCommon('addMembers')}
                </button>
              </div>
            </div>

            {/* Recent Activity Ticker */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-label-lg text-on-surface font-bold">{t('coopActivity')}</h3>
              <div className="space-y-3 divide-y divide-surface-container">
                <div className="flex gap-3 pt-2 text-xs">
                  <span className="material-symbols-outlined text-primary text-[18px]">campaign</span>
                  <div>
                    <p className="font-semibold">{t('newOrderPostedBy', { name: 'Amit Patel' })}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">100% Mulberry Silk Saree • 50 units</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-3 text-xs">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified_user</span>
                  <div>
                    <p className="font-semibold">{t('consensusStarted', { num: '8922' })}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{t('reviewingSupply')}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. WEAVER DASHBOARD */}
        {role === 'weaver' && (
          <section className="space-y-6 animate-in fade-in duration-200">
            {/* vote alert notification banner */}
            {stats.weaverVotesPending && (
              <div 
                onClick={() => router.push(`/${locale}/chat/coop-kanchipuram`)}
                className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors animate-pulse"
              >
                <span className="material-symbols-outlined text-amber-600 text-2xl">how_to_vote</span>
                <div className="flex-1 text-xs">
                  <p className="font-extrabold">{t('consensusVotePending')}</p>
                  <p className="text-amber-800 mt-0.5">{t('reviewAndVote', { num: '8922', name: 'Ethnic Threads' })}</p>
                </div>
                <span className="material-symbols-outlined text-sm font-bold text-amber-600">chevron_right</span>
              </div>
            )}

            {/* Active Loom Card */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">precision_manufacturing</span>
                  <h3 className="font-label-lg text-on-surface font-bold">Active Loom Progress</h3>
                </div>
                <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-bold uppercase">
                  Order #4421
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-on-surface-variant">Jamdani Silk Saree</span>
                  <span className="text-primary">{tScreen6('finishedOf', { finished: stats.myProgressFinished, total: stats.myProgressTotal })}</span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-surface-container rounded-full h-3.5 overflow-hidden border border-outline-variant/35 relative">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-500" 
                    style={{ width: `${stats.myProgressPercent}%` }}
                  ></div>
                </div>
              </div>

              <button 
                onClick={() => router.push(`/${locale}/production/order-4421`)}
                className="w-full h-10 border border-outline text-primary hover:bg-surface-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">edit_note</span>
                {t('updateLoomLogs')}
              </button>
            </div>

            {/* Payout Summary Card */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">payments</span>
                  <h3 className="font-label-lg text-on-surface font-bold">{t('myPayoutStatus')}</h3>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                  stats.myPayoutStatus === 'paid' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  {stats.myPayoutStatus === 'paid' ? tScreen7('paidStatus') : tScreen7('pendingTransfer')}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-surface-container">
                <span className="text-xs text-on-surface-variant">{t('expectedSettlement')}</span>
                <span className="text-lg font-bold text-primary">₹{stats.myPayoutAmount.toLocaleString('en-IN')}.00</span>
              </div>

              <button 
                onClick={() => router.push(`/${locale}/payments/order-4421`)}
                className="w-full h-10 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                {t('viewPaymentDetails')}
              </button>
            </div>
          </section>
        )}

        {/* 3. TREASURER DASHBOARD */}
        {role === 'treasurer' && (
          <section className="space-y-6 animate-in fade-in duration-200">
            {/* Pending Disbursement summary */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
                <h3 className="font-label-lg text-on-surface font-bold">{t('disbursementPool')}</h3>
              </div>

              <div className="flex justify-between items-baseline py-2 my-1 border-t border-b border-surface-container">
                <div>
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">{t('pendingBatchAmount')}</span>
                  <span className="text-2xl font-extrabold text-primary block mt-1">₹{stats.totalPendingDisbursement.toLocaleString('en-IN')}.00</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">{t('artisansDue')}</span>
                  <span className="text-xl font-bold text-on-surface block mt-1">{tScreen8('weaversCountLabel', { count: stats.pendingWeaversCount })}</span>
                </div>
              </div>

              <button 
                onClick={() => router.push(`/${locale}/payments/order-4421`)}
                disabled={stats.pendingWeaversCount === 0}
                className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform duration-100 disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm font-bold">send_to_mobile</span>
                {t('disbursePendingBatch')}
              </button>
            </div>

            {/* Recent Completed payouts */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-label-lg text-on-surface font-bold font-sans">{t('recentDisbursements')}</h3>
              <div className="space-y-3 divide-y divide-surface-container text-xs">
                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                    <div>
                      <p className="font-semibold">Ramesh Vankar</p>
                      <p className="text-[10px] text-on-surface-variant">Loom ID: BHU-092</p>
                    </div>
                  </div>
                  <span className="font-bold text-primary">{t('amountPaidLabel', { amount: '₹4,166' })}</span>
                </div>
                <div className="flex justify-between items-center pt-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                    <div>
                      <p className="font-semibold">Sunil Kumar</p>
                      <p className="text-[10px] text-on-surface-variant">Loom ID: BHU-045</p>
                    </div>
                  </div>
                  <span className="font-bold text-primary">{t('amountPaidLabel', { amount: '₹4,166' })}</span>
                </div>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-gutter">
          <div className="bg-white border border-outline-variant rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-surface-container mb-4">
              <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person_add</span>
                {tCommon('addMembers')}
              </h3>
              <button 
                onClick={() => setShowAddMemberModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container active:scale-95 duration-100 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Candidate List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {loadingCandidates ? (
                <div className="py-8 flex flex-col items-center justify-center text-xs text-on-surface-variant gap-2">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading candidates...</span>
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-12 text-center text-xs text-on-surface-variant flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-3xl">people_mute</span>
                  <p>{tCommon('noCandidates')}</p>
                </div>
              ) : (
                candidates.map((c) => {
                  const isSelected = selectedCandidate?.id === c.id;
                  return (
                    <div 
                      key={c.id}
                      onClick={() => setSelectedCandidate(c)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 active:scale-[0.99] ${
                        isSelected 
                          ? 'border-primary bg-primary-container/10 shadow-sm ring-1 ring-primary' 
                          : 'border-outline-variant/60 bg-surface-container-lowest hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-primary text-on-primary' : 'bg-primary-fixed text-on-primary-fixed'
                        }`}>
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-label-md text-label-md font-bold text-on-surface">{c.name}</span>
                          <span className="text-[10px] text-on-surface-variant font-mono">{c.phone}</span>
                        </div>
                      </div>
                      
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-primary text-primary' : 'border-outline text-transparent'
                      }`}>
                        {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-primary animate-scale-up"></span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selection Details & Confirm */}
            {selectedCandidate && (
              <div className="mt-4 pt-4 border-t border-surface-container bg-surface-container-lowest/50 rounded-xl space-y-4 animate-in slide-in-from-bottom-2 duration-200">
                <p className="text-xs text-on-surface-variant leading-relaxed px-1">
                  {tCommon('confirmAddMember', { name: selectedCandidate.name })}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSelectedCandidate(null)}
                    className="flex-grow py-2.5 border border-outline text-outline font-bold text-xs text-center rounded-xl hover:bg-surface-container active:scale-95 duration-100 cursor-pointer bg-white"
                  >
                    {tCommon('cancel')}
                  </button>
                  <button 
                    onClick={handleConfirmAddMember}
                    className="flex-grow py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary-container active:scale-95 duration-100 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                    {tCommon('confirmBtn')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Styled toast feedback */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-sans text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          {toastMsg}
        </div>
      )}

      <Navbar />
      <DevBar />
    </div>
  );
}
