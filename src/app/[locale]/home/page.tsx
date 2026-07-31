"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
          <p className="text-xs text-primary font-bold uppercase tracking-widest">Cooperative Hub</p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            Namaste, {memberProfile.name.split(' ')[0]} 👋
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Logged in as <span className="font-bold text-indigo-800 uppercase">{role}</span>
          </p>
        </section>

        {/* 1. ADMIN DASHBOARD */}
        {role === 'admin' && (
          <section className="space-y-6 animate-in fade-in duration-200">
            {/* Stats Card Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-shadow">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">New Quotes</span>
                <span className="text-3xl font-extrabold text-primary block mt-1">{stats.activeOrdersCount}</span>
                <span className="text-[10px] text-on-surface-variant block mt-1">Awaiting Review</span>
              </div>
              <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-shadow">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">In Discussion</span>
                <span className="text-3xl font-extrabold text-tertiary block mt-1">{stats.discussingOrdersCount}</span>
                <span className="text-[10px] text-on-surface-variant block mt-1">Weaver Votes Pinned</span>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-label-lg text-on-surface font-bold">Quick Actions</h3>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => router.push(`/${locale}/orders/new`)}
                  className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform duration-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                  Post New Order (Phone Quote)
                </button>
                <button 
                  onClick={() => router.push(`/${locale}/orders`)}
                  className="w-full h-11 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">assignment</span>
                  Manage All Active Orders
                </button>
                <button 
                  onClick={() => router.push(`/${locale}/federation`)}
                  className="w-full h-11 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100 cursor-pointer relative"
                >
                  <span className="material-symbols-outlined text-sm">hub</span>
                  Find Pooling Partners
                  {poolingPartnersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-tertiary text-on-tertiary text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                      {poolingPartnersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Recent Activity Ticker */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-label-lg text-on-surface font-bold">Cooperative Activity</h3>
              <div className="space-y-3 divide-y divide-surface-container">
                <div className="flex gap-3 pt-2 text-xs">
                  <span className="material-symbols-outlined text-primary text-[18px]">campaign</span>
                  <div>
                    <p className="font-semibold">New Order posted by Amit Patel</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">100% Mulberry Silk Saree • 50 units</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-3 text-xs">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified_user</span>
                  <div>
                    <p className="font-semibold">Order #8922 consensus started</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">Weavers reviewing raw material supply</p>
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
                  <p className="font-extrabold">Consensus Vote Pending!</p>
                  <p className="text-amber-800 mt-0.5">Review and vote on Order #8922 (Ethnic Threads) in the Chat tab.</p>
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
                  <span className="text-primary">{stats.myProgressFinished} of {stats.myProgressTotal} Finished</span>
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
                Update Loom Progress Logs
              </button>
            </div>

            {/* Payout Summary Card */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">payments</span>
                  <h3 className="font-label-lg text-on-surface font-bold">My Payout Status</h3>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                  stats.myPayoutStatus === 'paid' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  {stats.myPayoutStatus === 'paid' ? 'Paid' : 'Pending Transfer'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-surface-container">
                <span className="text-xs text-on-surface-variant">Expected Settlement:</span>
                <span className="text-lg font-bold text-primary">₹{stats.myPayoutAmount.toLocaleString('en-IN')}.00</span>
              </div>

              <button 
                onClick={() => router.push(`/${locale}/payments/order-4421`)}
                className="w-full h-10 border border-outline text-on-surface hover:bg-surface-container rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform duration-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                View My Payment Details
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
                <h3 className="font-label-lg text-on-surface font-bold">Disbursement Pool</h3>
              </div>

              <div className="flex justify-between items-baseline py-2 my-1 border-t border-b border-surface-container">
                <div>
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Pending Batch Amount</span>
                  <span className="text-2xl font-extrabold text-primary block mt-1">₹{stats.totalPendingDisbursement.toLocaleString('en-IN')}.00</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">Artisans Due</span>
                  <span className="text-xl font-bold text-on-surface block mt-1">{stats.pendingWeaversCount} Weavers</span>
                </div>
              </div>

              <button 
                onClick={() => router.push(`/${locale}/payments/order-4421`)}
                disabled={stats.pendingWeaversCount === 0}
                className="w-full h-11 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform duration-100 disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm font-bold">send_to_mobile</span>
                Disburse Pending Splits Batch
              </button>
            </div>

            {/* Recent Completed payouts */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-label-lg text-on-surface font-bold font-sans">Recent Ledger Disbursements</h3>
              <div className="space-y-3 divide-y divide-surface-container text-xs">
                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                    <div>
                      <p className="font-semibold">Ramesh Vankar</p>
                      <p className="text-[10px] text-on-surface-variant">Loom ID: BHU-092</p>
                    </div>
                  </div>
                  <span className="font-bold text-primary">₹4,166 Paid</span>
                </div>
                <div className="flex justify-between items-center pt-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                    <div>
                      <p className="font-semibold">Sunil Kumar</p>
                      <p className="text-[10px] text-on-surface-variant">Loom ID: BHU-045</p>
                    </div>
                  </div>
                  <span className="font-bold text-primary">₹4,166 Paid</span>
                </div>
              </div>
            </div>
          </section>
        )}

      </main>

      <Navbar />
      <DevBar />
    </div>
  );
}
