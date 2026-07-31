"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BrandedLoader } from '@/components/BrandedLoader';
import { useTranslations } from 'next-intl';

interface OrderData {
  coopId: string;
  buyerName: string;
  item: string;
  quantity: number;
  price: number;
  deadline: string;
  status: string;
  buyerConfirmed?: boolean;
  buyerConfirmedAt?: any;
}

export default function PublicBuyerConfirmPage() {
  const t = useTranslations('confirm');
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const locale = (params.locale as string) || 'en';

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const getFormattedConfirmDate = () => {
    if (!order?.buyerConfirmedAt) return new Date().toLocaleDateString(locale === 'hi' ? 'hi-IN' : locale === 'ta' ? 'ta-IN' : 'en-IN');
    const dateObj = order.buyerConfirmedAt.seconds 
      ? new Date(order.buyerConfirmedAt.seconds * 1000) 
      : new Date(order.buyerConfirmedAt);
    return dateObj.toLocaleDateString(locale === 'hi' ? 'hi-IN' : locale === 'ta' ? 'ta-IN' : 'en-IN');
  };

  useEffect(() => {
    if (!orderId) return;

    // Public real-time listener for this specific order
    const unsub = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        setOrder(docSnap.data() as OrderData);
      } else {
        console.warn(`Order ${orderId} not found.`);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error reading order:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [orderId]);

  const handleConfirmPrice = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      // Perform public update allowed by firestore.rules
      await updateDoc(doc(db, 'orders', orderId), {
        buyerConfirmed: true,
        buyerConfirmedAt: new Date()
      });
      triggerToast("Thank you! You have confirmed the price successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Error confirming price: " + err.message);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return <BrandedLoader message="Loading verification details..." fullScreen />;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-background items-center justify-center p-8 text-center font-sans">
        <span className="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">Order Not Found</h2>
        <p className="text-sm text-on-surface-variant max-w-sm">
          This order link is invalid or the record has been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface font-sans min-h-screen flex flex-col pb-16 relative overflow-hidden">
      {/* Background Ikat texture overlay */}
      <div className="absolute inset-0 ikat-pattern pointer-events-none opacity-20" style={{ height: '300px' }}></div>

      {/* Branded Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-outline-variant/30 py-4 px-6 flex items-center justify-center shadow-sm relative z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl font-bold">texture</span>
          <span className="font-bold text-lg tracking-wide text-primary">WeaveLink</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center px-gutter pt-8 max-w-md mx-auto w-full relative z-10">
        <div className="w-full bg-white border border-outline-variant/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          
          {/* Status Header */}
          <div className="p-gutter border-b border-surface-container flex items-center gap-3 bg-slate-50">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${order.buyerConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              <span className="material-symbols-outlined">
                {order.buyerConfirmed ? 'verified' : 'pending'}
              </span>
            </div>
            <div>
              <h1 className="font-bold text-sm text-on-surface-variant uppercase tracking-wider">{t('title')}</h1>
              <p className="font-bold text-xs text-on-surface mt-0.5">
                {order.buyerConfirmed ? t('priceVerified') : t('awaitingConfirmation')}
              </p>
            </div>
          </div>

          <div className="p-gutter space-y-gutter">
            
            {/* Context message */}
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t('contextText')}
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-on-surface-variant">{t('buyerName')}</span>
                <span className="text-xs font-semibold">{order.buyerName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-on-surface-variant">{t('itemLabel')}</span>
                <span className="text-xs font-semibold">{order.item}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-on-surface-variant">{t('quantityLabel')}</span>
                <span className="text-xs font-semibold">{t('sareesUnit', { quantity: order.quantity })}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-on-surface-variant">{t('deadlineLabel')}</span>
                <span className="text-xs font-semibold">{new Date(order.deadline).toLocaleDateString(locale === 'hi' ? 'hi-IN' : locale === 'ta' ? 'ta-IN' : 'en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              
              {/* Highlighted Price Card */}
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center justify-between mt-4">
                <div>
                  <span className="text-[10px] text-primary uppercase font-bold tracking-wider block">{t('contractPrice')}</span>
                  <span className="text-2xl font-bold text-primary mt-0.5">₹{order.price.toLocaleString('en-IN')}</span>
                </div>
                {order.buyerConfirmed && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    {t('confirmed')}
                  </span>
                )}
              </div>
            </div>

            {/* Confirm Actions */}
            <div className="pt-4">
              {order.buyerConfirmed ? (
                <div className="text-center py-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  {t('verifiedByYou', { date: getFormattedConfirmDate() })}
                </div>
              ) : (
                <button
                  onClick={handleConfirmPrice}
                  disabled={confirming}
                  className="w-full h-12 bg-primary text-on-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 duration-100 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/10"
                >
                  {confirming ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      {t('confirmButton')}
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 text-xs font-bold flex items-center gap-1.5 border border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <span className="material-symbols-outlined text-emerald-400 text-[16px]">verified</span>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
