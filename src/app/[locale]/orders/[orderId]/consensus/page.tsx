"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, onSnapshot, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';
import { usePWA } from '@/hooks/usePWA';
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
  enteredBy?: string;
  enteredAt?: any;
  buyerConfirmed?: boolean;
  buyerConfirmedAt?: any;
}

interface MemberResponse {
  memberId: string;
  response: 'agree' | 'concern' | 'reject';
  note?: string;
  name?: string;
  avatarUrl?: string;
}

export default function ConsensusCheckPage() {
  const t = useTranslations('screen4');
  const router = useRouter();
  const params = useParams();
  const { isInstallable, triggerInstall } = usePWA();
  const { user } = useAuth();
  
  const orderId = params.orderId as string;
  const [order, setOrder] = useState<OrderData | null>(null);
  const [responses, setResponses] = useState<MemberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const [showRenegotiateModal, setShowRenegotiateModal] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [isRenegotiating, setIsRenegotiating] = useState(false);

  useEffect(() => {
    if (!orderId || !user) return;

    // Load order info
    const unsubOrder = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as OrderData;
        setOrder(data);
        setNewPrice(String(data.price));
      }
    });

    // Load responses
    const unsubResponses = onSnapshot(collection(db, 'orders', orderId, 'responses'), (snap) => {
      const respList: MemberResponse[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as MemberResponse;
        
        // Mock profile names & avatars for design visual representation
        let name = 'Coop Member';
        let avatarUrl = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2';
        if (docSnap.id === 'weaver-uid-888') {
          name = 'Ramesh Vankar';
          avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDF81uvfEdCzffLhKuRMJBl1iJPjEQ7FtDo_uFjO0NpS6U_vU-eKCt_mJjr7Oz7ite4G-Yge4P59rtAO1u5MTByF_a1yxUT7n6vbCpUaSGdiJe3rZ3wQI06QwWVPk2m-Zs2hjJhDlO24R4G2OKTmC10LeTVGp89Gn115M8UtLPQRUnzFuf07bL30NB4TzncvD2dbpnsvqE0rH1DSvO8Uoqd-I4q9UbKVGjwFe1xBkhs16JNzsSRZkKwCwRN01yBOKDDL0eNKtI7up0U';
        } else if (docSnap.id === 'weaver-uid-101') {
          name = 'Gopal Rao';
          avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDHeWu6bU_w9Lv0RiIsSr3d9uHpJDcSPOZmyUfZ3zSigBEUagIAb-ByV9VLxkyhnd-dSBsKvVKVb-5Wo_KAIJFfbA6gtPSdI104qQ--5YW8NH4lkXHFBK9AfRVc9RFQBga2vqzGmZ2kwvfhlJv60TkQ3lSCgTpb-DjLfA7arlKgJ7WQHIvtkCEj7oLYNOx0-wFYIgw39bYwZEGl7Y94mR67dUQDtcMTyk5Tj2p_trDj-AnEqeXPsysfNqFS9OElTEvBtig8J641azIz';
        } else if (docSnap.id === 'weaver-uid-102') {
          name = 'Lakshmi P.';
          avatarUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvS-SwJNuVthxNZQ3ajkdPkJcV3kVhgelQdLc-7aDmA5Ys6m6s5NSt4-GtVygLdT9ojSZIvYnnVuS87wxBbhEP_pbP-8eK09JBD5HKot1Yzfi5EOi3NwD-C1vR_djwYPKR7OlVVIoyWYmdY5sTexkz-Y8ACl1Pf7u-krVNH-0llsljGX_cyck1QwYLl_oTg23H-U5yGvUOArv2e7PDwRJbiFLy3Wz40Ifh5vIodns2lOgV8CaaYC-5rB6rXHYAujqUtEdax4_NUU5y';
        }
        
        respList.push({ name, avatarUrl, ...data });
      });
      setResponses(respList);
      setLoading(false);
    });

    return () => {
      unsubOrder();
      unsubResponses();
    };
  }, [orderId, user]);

  // Calculations for donut chart
  const total = responses.length || 1; // prevent divide by zero
  const agreed = responses.filter(r => r.response === 'agree').length;
  const reject = responses.filter(r => r.response === 'reject').length;

  const agreePct = Math.round((agreed / total) * 100);
  const rejectPct = Math.round((reject / total) * 100);

  // Circle geometry properties
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // 251.32

  // Segment stroke dashes
  const agreeStrokeOffset = circumference * (1 - (agreed / total));
  const rejectStrokeOffset = circumference * (1 - (reject / total));

  const locale = (params.locale as string) || 'en';

  // Switch to screen 5: allocation
  const handleConfirmOrder = async () => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'confirmed'
      });
      // Redirect to Screen 5
      router.push(`/${locale}/orders/${orderId}/allocate`);
    } catch (err: any) {
      alert("Error confirming order: " + err.message);
    }
  };

  const handleReviewConcerns = () => {
    // Navigate to Chat to discuss concerns
    router.push(`/${locale}/chat/coop-kanchipuram?orderId=${orderId}`);
  };

  const handleRenegotiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrice || isNaN(Number(newPrice))) {
      alert("Please enter a valid price.");
      return;
    }
    setIsRenegotiating(true);
    try {
      const priceVal = Number(newPrice);
      const orderRef = doc(db, 'orders', orderId);

      // Step 1: Reset status, buyerConfirmed, and enteredBy info
      await updateDoc(orderRef, {
        status: 'pending_review',
        buyerConfirmed: false,
        buyerConfirmedAt: null,
        enteredAt: new Date()
      });

      // Step 2: Set the new price
      await updateDoc(orderRef, {
        price: priceVal
      });

      // Step 3: Delete all weaver response documents in responses subcollection
      const responsesRef = collection(db, 'orders', orderId, 'responses');
      const snap = await getDocs(responsesRef);
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      setShowRenegotiateModal(false);
      alert("Order reset to pending review. Price updated successfully.");
      router.push(`/${locale}/orders/${orderId}`);
    } catch (err: any) {
      console.error(err);
      alert("Error renegotiating order: " + err.message);
    } finally {
      setIsRenegotiating(false);
    }
  };

  const togglePlayVoice = (id: string) => {
    if (playingVoiceId === id) {
      setPlayingVoiceId(null);
    } else {
      setPlayingVoiceId(id);
      setTimeout(() => {
        setPlayingVoiceId((prev) => prev === id ? null : prev);
      }, 5000);
    }
  };

  if (loading) {
    return <BrandedLoader message="Loading consensus report..." fullScreen />;
  }

  const rejectionsList = responses.filter(r => r.response === 'reject');

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-48 flex flex-col">
      <Header />

      <main className="max-w-xl mx-auto px-container-padding pt-stack-lg flex-grow w-full">
        {/* Title Section */}
        <div className="mb-stack-lg flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{t('title')}</h1>
            <p className="text-on-surface-variant font-body-md mt-1">
              {t('subtitle', { batch: order?.item || 'Spring Jamdani Batch #402' })}
            </p>
          </div>
          <div className="bg-white border border-outline-variant p-3 rounded-xl shadow-sm text-left sm:text-right min-w-[160px]">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider block">Coop Target Price</span>
            <span className="font-headline-md text-headline-md font-bold block text-primary mt-0.5">₹{order?.price.toLocaleString('en-IN')}</span>
            {order?.buyerConfirmed ? (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-1.5">
                <span className="material-symbols-outlined text-[12px] font-extrabold">check_circle</span>
                Buyer Confirmed ✓
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-1.5">
                <span className="material-symbols-outlined text-[12px] font-extrabold">pending</span>
                Awaiting Confirmation
              </span>
            )}
          </div>
        </div>

        {/* Donut Chart & Legend Bento */}
        <div className="bg-white rounded-xl p-gutter shadow-sm border border-outline-variant/30 relative overflow-hidden mb-stack-lg">
          <div className="absolute inset-0 pattern-overlay pointer-events-none"></div>
          <div className="flex flex-col items-center justify-center py-stack-md">
            
            {/* SVG Donut Chart */}
            <div className="chart-container flex items-center justify-center relative w-[240px] h-[240px]">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Circle */}
                <circle className="stroke-surface-container-high fill-transparent" cx="50" cy="50" r="40" strokeWidth="12"></circle>
                
                {/* Reject Segment - Red */}
                <circle 
                  className="stroke-error fill-transparent transition-all duration-700" 
                  cx="50" cy="50" r="40" 
                  strokeWidth="12"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={rejectStrokeOffset}
                  style={{ transform: `rotate(${agreed * (360 / total)}deg)`, transformOrigin: '50% 50%' }}
                ></circle>
                
                {/* Agree Segment - Green (Secondary) */}
                <circle 
                  className="stroke-secondary fill-transparent transition-all duration-700" 
                  cx="50" cy="50" r="40" 
                  strokeWidth="12"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={agreeStrokeOffset}
                  style={{ transformOrigin: '50% 50%' }}
                ></circle>
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-headline-lg text-headline-lg text-secondary">{agreePct}%</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('consensus')}</span>
              </div>
            </div>

            {/* Legend (2-state model) */}
            <div className="grid grid-cols-2 gap-4 w-full mt-stack-lg text-center max-w-sm">
              <div className="flex flex-col items-center">
                <div className="h-1.5 w-12 bg-secondary rounded-full mb-2"></div>
                <span className="font-label-sm text-label-sm">{t('agree')}</span>
                <span className="font-bold text-on-surface">{agreePct}%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-1.5 w-12 bg-error rounded-full mb-2"></div>
                <span className="font-label-sm text-label-sm">{t('reject')}</span>
                <span className="font-bold text-on-surface">{rejectPct}%</span>
              </div>
            </div>

          </div>
        </div>

        {/* Breakdown Section */}
        <div className="mb-stack-lg">
          <div className="flex justify-between items-end mb-stack-md">
            <h2 className="font-label-lg text-label-lg text-on-surface">
              Weaver Rejections & Reasons ({rejectionsList.length})
            </h2>
            <button className="text-primary font-label-sm flex items-center gap-1 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">play_circle</span>
              {t('playAll')}
            </button>
          </div>

          {/* Rejection Cards */}
          <div className="space-y-stack-md">
            {rejectionsList.map((c) => (
              <div key={c.memberId} className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 bg-surface-container rounded-full overflow-hidden flex-shrink-0">
                  <img className="w-full h-full object-cover" src={c.avatarUrl} alt={c.name} />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <span className="font-label-lg text-label-lg text-on-surface">{c.name}</span>
                    <span className="px-2 py-0.5 rounded-full font-label-sm text-[10px] uppercase bg-error-container text-on-error-container font-bold">
                      Can't Do It
                    </span>
                  </div>
                  
                  {/* Voice simulation player */}
                  <div className="mt-2 flex items-center gap-3">
                    <button 
                      onClick={() => togglePlayVoice(c.memberId)}
                      className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center hover:scale-95 transition-transform cursor-pointer"
                    >
                      <span className="material-symbols-outlined">
                        {playingVoiceId === c.memberId ? 'pause' : 'play_arrow'}
                      </span>
                    </button>
                    <div className="flex-grow h-8 flex items-center gap-1 opacity-60">
                      <div className="w-1 h-3 bg-secondary rounded-full"></div>
                      <div className="w-1 h-5 bg-secondary rounded-full"></div>
                      <div className={`w-1 h-7 bg-secondary rounded-full ${playingVoiceId === c.memberId ? 'animate-pulse' : ''}`}></div>
                      <div className="w-1 h-4 bg-secondary rounded-full"></div>
                      <div className="w-1 h-6 bg-secondary rounded-full"></div>
                      <div className="w-1 h-5 bg-secondary rounded-full"></div>
                      <div className={`w-1 h-8 bg-secondary rounded-full ${playingVoiceId === c.memberId ? 'animate-pulse' : ''}`}></div>
                      <div className="w-1 h-3 bg-secondary rounded-full"></div>
                      <div className="w-1 h-6 bg-secondary rounded-full"></div>
                    </div>
                    <span className="font-label-sm text-on-surface-variant">0:24</span>
                  </div>

                  {/* Reasons list rendered as tags */}
                  {c.note && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {c.note.split(', ').map((reason, idx) => (
                        <span key={idx} className="bg-rose-50 border border-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {rejectionsList.length === 0 && (
              <div className="text-center py-6 bg-white rounded-xl border border-outline-variant border-dashed text-on-surface-variant">
                No rejections. Cooperative has complete consensus!
              </div>
            )}
          </div>
        </div>

        {/* PWA Add to Home Banner */}
        {isInstallable && (
          <div className="mb-8">
            <div className="bg-surface-container-high border border-outline-variant p-gutter rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <span className="material-symbols-outlined text-primary">install_mobile</span>
                </div>
                <div>
                  <p className="font-label-lg text-on-surface">{t('stayUpdated')}</p>
                  <p className="font-label-sm text-on-surface-variant">{t('addToHome')}</p>
                </div>
              </div>
              <button 
                onClick={triggerInstall}
                className="text-primary font-label-lg font-bold hover:underline cursor-pointer"
              >
                {t('install')}
              </button>
            </div>
          </div>
        )}

        {/* Sticky Actions */}
        <div className="fixed bottom-[88px] left-0 w-full px-container-padding pb-4 z-40 bg-gradient-to-t from-background via-background to-transparent pt-8">
          <div className="max-w-xl mx-auto flex flex-col gap-3">
            <button 
              onClick={handleConfirmOrder}
              className="w-full h-14 bg-primary text-on-primary rounded-xl font-label-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 duration-150 cursor-pointer"
            >
              <span className="material-symbols-outlined">check_circle</span>
              {t('confirmOrder')}
            </button>
            <button 
              onClick={() => setShowRenegotiateModal(true)}
              className="w-full h-14 bg-white text-secondary border-2 border-outline-variant hover:border-secondary rounded-xl font-label-lg flex items-center justify-center gap-2 active:scale-95 duration-150 cursor-pointer"
            >
              <span className="material-symbols-outlined">gavel</span>
              Renegotiate Price
            </button>
            <button 
              onClick={handleReviewConcerns}
              className="w-full h-14 bg-secondary text-white rounded-xl font-label-lg flex items-center justify-center gap-2 active:scale-95 duration-150 cursor-pointer border border-secondary-container"
            >
              <span className="material-symbols-outlined">rate_review</span>
              {t('reviewConcerns')}
            </button>
          </div>
        </div>

        {/* Renegotiate Modal Dialog */}
        {showRenegotiateModal && (
          <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-container-padding animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-outline-variant animate-in zoom-in-95 duration-200">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Renegotiate Target Price</h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Changing the price will reset the order status back to Pending Review, clear all current weaver votes, and require a fresh consensus round.
              </p>
              
              <form onSubmit={handleRenegotiateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">New Price (INR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-sm">₹</span>
                    <input 
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      required
                      placeholder="e.g. 72000"
                      className="w-full pl-7 pr-3 py-3 border border-outline rounded-xl font-bold text-base focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none bg-white text-on-surface"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRenegotiateModal(false)}
                    className="flex-1 h-12 border border-outline text-outline font-label-lg rounded-xl active:scale-95 duration-100 cursor-pointer bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRenegotiating}
                    className="flex-1 h-12 bg-primary text-on-primary font-label-lg rounded-xl flex items-center justify-center gap-1 active:scale-95 duration-100 disabled:opacity-50 cursor-pointer"
                  >
                    {isRenegotiating ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                        Submit Price
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Navbar />
      <DevBar />
    </div>
  );
}
