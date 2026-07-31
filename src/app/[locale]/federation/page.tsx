"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';
import { BrandedLoader } from '@/components/BrandedLoader';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid
} from 'recharts';

// Anonymized mock data for price benchmarking
const priceData = [
  { month: 'May', average: 1380, yourCoop: 1420 },
  { month: 'Jun', average: 1400, yourCoop: 1480 },
  { month: 'Jul', average: 1420, yourCoop: 1490 },
  { month: 'Aug', average: 1410, yourCoop: 1500 },
  { month: 'Sep', average: 1430, yourCoop: 1500 },
  { month: 'Oct', average: 1450, yourCoop: 1500 }
];

export default function FederationInsightsPage() {
  const t = useTranslations('screen8');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { user, memberProfile, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [showTooltip, setShowTooltip] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  
  const [requests, setRequests] = useState<any[]>([]);
  const [coopNames, setCoopNames] = useState<Record<string, string>>({
    'coop-kanchipuram': 'Kanchipuram Silk Cooperative',
    'coop-varanasi': 'Varanasi Weavers Cooperative',
    'coop-silk-b': 'Silk Weaver Coop B',
    'coop-arani': 'Arani Master Weavers'
  });

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

    const myCoopId = memberProfile.coopId || 'coop-kanchipuram';

    // 1. Subscribe to all cooperatives to map IDs to names dynamically
    const unsubCoops = onSnapshot(collection(db, 'cooperatives'), (snap) => {
      const names: Record<string, string> = {};
      snap.forEach((docSnap) => {
        names[docSnap.id] = docSnap.data().name || docSnap.id;
      });
      setCoopNames((prev) => ({ ...prev, ...names }));
    });

    // 2. Subscribe to pooling requests involving this coop
    const qRequests = query(collection(db, 'poolingRequests'));
    const unsubRequests = onSnapshot(qRequests, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.fromCoopId === myCoopId || data.toCoopId === myCoopId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setRequests(list);
    });

    return () => {
      unsubCoops();
      unsubRequests();
    };
  }, [user, memberProfile, authLoading, locale, router]);

  // Invite action: writes document to poolingRequests
  const handleInviteToPool = async (targetCoopId: string, item: string, targetAmount: string, savings: string) => {
    if (!user || !memberProfile) return;
    const myCoopId = memberProfile.coopId || 'coop-kanchipuram';

    if (memberProfile.role !== 'admin') {
      triggerToast("Only cooperative Admins can invite partners.");
      return;
    }

    // Check if request is already pending or active
    const duplicate = requests.find(
      (r) => r.fromCoopId === myCoopId && r.toCoopId === targetCoopId && r.status === 'pending'
    );
    if (duplicate) {
      triggerToast("An invitation is already pending.");
      return;
    }

    try {
      await addDoc(collection(db, 'poolingRequests'), {
        fromCoopId: myCoopId,
        toCoopId: targetCoopId,
        status: 'pending',
        createdAt: new Date(),
        item,
        targetAmount,
        savings
      });
      triggerToast(`Invitation sent to ${coopNames[targetCoopId] || targetCoopId}!`);
    } catch (err: any) {
      console.error(err);
      triggerToast("Error sending invitation: " + err.message);
    }
  };

  const handleAcceptInvite = async (requestId: string) => {
    if (!user || !memberProfile) return;
    if (memberProfile.role !== 'admin') {
      triggerToast("Only cooperative Admins can accept invitations.");
      return;
    }
    try {
      await updateDoc(doc(db, 'poolingRequests', requestId), {
        status: 'accepted'
      });
      triggerToast("Pooling request accepted!");
    } catch (err: any) {
      console.error(err);
      triggerToast("Error accepting invite: " + err.message);
    }
  };

  const handleDeclineInvite = async (requestId: string) => {
    if (!user || !memberProfile) return;
    if (memberProfile.role !== 'admin') {
      triggerToast("Only cooperative Admins can decline invitations.");
      return;
    }
    try {
      await updateDoc(doc(db, 'poolingRequests', requestId), {
        status: 'declined'
      });
      triggerToast("Pooling request declined.");
    } catch (err: any) {
      console.error(err);
      triggerToast("Error declining invite: " + err.message);
    }
  };

  if (authLoading || !memberProfile) {
    return <BrandedLoader message="Syncing federation workspace..." fullScreen />;
  }

  const myCoopId = memberProfile.coopId || 'coop-kanchipuram';
  
  // Categorize requests client-side
  const waitingList = requests.filter(r => r.fromCoopId === myCoopId && r.status === 'pending');
  const invitedList = requests.filter(r => r.toCoopId === myCoopId && r.status === 'pending');
  const confirmedList = requests.filter(r => (r.fromCoopId === myCoopId || r.toCoopId === myCoopId) && r.status === 'accepted');

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-32 flex flex-col">
      <Header />

      <main className="max-w-4xl mx-auto px-container-padding pt-stack-lg space-y-6 flex-grow w-full">
        
        {/* Header Section */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="font-label-sm text-primary uppercase tracking-widest mb-1">{t('fedDashboard')}</p>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              {t('title', { region: memberProfile.coopId === 'coop-silk-b' ? 'Kanchipuram District B' : 'Kanchipuram' })}
            </h2>
          </div>
          <div className="flex gap-2">
            <span className="bg-tertiary-container text-on-tertiary-container px-3 py-1 rounded-full font-label-sm flex items-center gap-1 border border-tertiary">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              {t('verifiedData')}
            </span>
          </div>
        </section>

        {/* 1. Map View: Pool a Bulk Order (Full width top) */}
        <div className="bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden flex flex-col h-[400px] w-full">
          <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">hub</span>
              <h3 className="font-label-lg text-on-surface">{t('poolOrderTitle')}</h3>
            </div>
            
            <div className="flex bg-surface rounded-full p-1 border border-outline-variant">
              <button 
                onClick={() => setActiveTab('map')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'map' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {t('map')}
              </button>
              <button 
                onClick={() => setActiveTab('list')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'list' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {t('list')}
              </button>
            </div>
          </div>

          {activeTab === 'map' ? (
            <div className="flex-1 relative bg-surface-variant map-container overflow-hidden">
              {/* Styled static vector map representing Kanchipuram district */}
              <div 
                className="absolute inset-0 bg-cover bg-center grayscale contrast-125 opacity-30" 
                style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCuOcjpfjMsZ59II89VjDvb_vJUzNK9Bdj6fM269ZhmFKGDmqmWWuanPMNMo6Z_8Wu1Uq8Uvb5Gq9evFc47cq_SJh9BqnzcKZJnEXFLhr2iPoWDDpG6CwPVJfzDkO9VYSk8B4T8fLoCS7RjhQvVuzgDPRJqq2B25Sau2zkORLDEl3bidI5FqljrMnB6T_S9nAoj-I-CyjZAbvYzYW3Dl0CsgSivUpYTCX1tMB3OKF8j_v7r2yz0z0Mmo43Q97zaHAyilsdRS0vxZdqr')` }}
              ></div>
              
              {/* Pulsing Location Marker 1 */}
              <div className="absolute top-1/4 left-1/3 group cursor-pointer">
                <div className="w-4 h-4 bg-primary rounded-full animate-ping absolute"></div>
                <div 
                  onClick={() => setShowTooltip(!showTooltip)}
                  className="w-4 h-4 bg-primary rounded-full relative z-10 border-2 border-white"
                ></div>
                
                {/* Map Tooltip */}
                {showTooltip && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 bg-white border border-outline-variant rounded-lg p-3 shadow-lg z-20">
                    <p className="font-label-sm text-primary font-bold">Silk Weaver Coop B</p>
                    <p className="text-[10px] text-on-surface-variant">5km away • <span className="text-emerald-700 font-bold">High Capacity</span></p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInviteToPool('coop-silk-b', 'Mulberry Silk Yarn', '250kg', '₹12,500');
                      }}
                      className="mt-2 w-full py-1.5 bg-primary text-white text-[10px] font-bold rounded-md active:scale-95 cursor-pointer disabled:opacity-50"
                      disabled={requests.some(r => r.fromCoopId === myCoopId && r.toCoopId === 'coop-silk-b' && r.status === 'pending')}
                    >
                      {requests.some(r => r.fromCoopId === myCoopId && r.toCoopId === 'coop-silk-b' && r.status === 'pending') ? 'Invited' : 'Invite to Pool'}
                    </button>
                  </div>
                )}
              </div>

              {/* Marker 2 */}
              <div className="absolute top-1/2 right-1/4">
                <div className="w-3 h-3 bg-secondary rounded-full border-2 border-white shadow-md"></div>
                <div className="absolute top-4 -right-16 bg-white/90 px-2 py-1 rounded border border-outline-variant text-[10px] whitespace-nowrap">
                  Arani Cluster (12km)
                </div>
              </div>

              {/* Map Legend */}
              <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg flex flex-col gap-2 border border-outline-variant/30 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary"></span>
                  <span className="text-[10px] font-medium">{t('availablePooling')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-secondary"></span>
                  <span className="text-[10px] font-medium">{t('atCapacity')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="p-3 bg-surface-container-low rounded-lg flex justify-between items-center border border-outline-variant/20">
                <div>
                  <p className="font-label-lg text-primary font-bold">Silk Weaver Coop B</p>
                  <p className="text-xs text-on-surface-variant">5km away • Mulberry Silk Yarn Specialist</p>
                </div>
                <button 
                  onClick={() => handleInviteToPool('coop-silk-b', 'Mulberry Silk Yarn', '250kg', '₹12,500')}
                  className="bg-primary text-on-primary px-3 py-1.5 rounded text-xs disabled:opacity-50"
                  disabled={requests.some(r => r.fromCoopId === myCoopId && r.toCoopId === 'coop-silk-b' && r.status === 'pending')}
                >
                  {requests.some(r => r.fromCoopId === myCoopId && r.toCoopId === 'coop-silk-b' && r.status === 'pending') ? 'Invited' : 'Invite'}
                </button>
              </div>
              <div className="p-3 bg-surface-container-low rounded-lg flex justify-between items-center border border-outline-variant/20">
                <div>
                  <p className="font-label-lg text-on-surface font-bold text-on-surface-variant">Arani Cluster</p>
                  <p className="text-xs text-on-surface-variant">12km away • Zari Thread Specialist</p>
                </div>
                <span className="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">At Capacity</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Live Pooling Status (New Section) */}
        <section className="bg-white rounded-xl shadow-sm border border-outline-variant p-6 space-y-6 w-full">
          <div className="flex items-center gap-2 border-b border-surface-container pb-3">
            <span className="material-symbols-outlined text-primary">groups</span>
            <h3 className="font-label-lg text-on-surface font-extrabold text-xs uppercase tracking-wider">Your Pooling Requests</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Waiting for Response */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                Waiting for Response ({waitingList.length})
              </h4>
              <div className="space-y-2">
                {waitingList.map((r) => (
                  <div key={r.id} className="p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl text-xs flex flex-col gap-1">
                    <div className="flex justify-between font-bold text-on-surface">
                      <span>{coopNames[r.toCoopId] || r.toCoopId}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Pending</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">Pooled: {r.item} ({r.targetAmount})</p>
                    <p className="text-[9px] text-on-surface-variant/80 italic mt-1">Est. Savings: {r.savings}</p>
                  </div>
                ))}
                {waitingList.length === 0 && (
                  <p className="text-xs text-on-surface-variant italic py-2 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">No sent requests pending.</p>
                )}
              </div>
            </div>

            {/* Invited You */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">mail</span>
                Invited You ({invitedList.length})
              </h4>
              <div className="space-y-2">
                {invitedList.map((r) => (
                  <div key={r.id} className="p-3 bg-primary-container/20 border border-primary/20 rounded-xl text-xs flex flex-col gap-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-on-surface">{coopNames[r.fromCoopId] || r.fromCoopId}</span>
                      <span className="text-[10px] text-on-surface-variant">Invited you to pool {r.item} ({r.targetAmount})</span>
                    </div>
                    <p className="text-[9px] text-on-surface-variant/80 italic">Est. Savings: {r.savings}</p>
                    {memberProfile?.role === 'admin' && (
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleAcceptInvite(r.id)}
                          className="flex-1 py-1.5 bg-primary text-on-primary rounded font-bold text-[10px] active:scale-95 transition-transform cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineInvite(r.id)}
                          className="flex-1 py-1.5 border border-outline text-on-surface hover:bg-surface-container rounded font-bold text-[10px] active:scale-95 transition-transform cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {invitedList.length === 0 && (
                  <p className="text-xs text-on-surface-variant italic py-2 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">No active invitations.</p>
                )}
              </div>
            </div>

            {/* Confirmed Pools */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Confirmed Pools ({confirmedList.length})
              </h4>
              <div className="space-y-2">
                {confirmedList.map((r) => {
                  const partnerId = r.fromCoopId === myCoopId ? r.toCoopId : r.fromCoopId;
                  return (
                    <div key={r.id} className="p-3 bg-emerald-50/50 border border-emerald-200/50 rounded-xl text-xs flex flex-col gap-1">
                      <div className="flex justify-between font-bold text-on-surface">
                        <span>{coopNames[partnerId] || partnerId}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 border border-emerald-200">
                          <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                          Active
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Item: {r.item} ({r.targetAmount})</p>
                      <p className="text-[9px] text-emerald-800 font-extrabold mt-1">Total Savings: {r.savings}</p>
                    </div>
                  );
                })}
                {confirmedList.length === 0 && (
                  <p className="text-xs text-on-surface-variant italic py-2 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">No active pools confirmed.</p>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* 3. Price Benchmarking (Secondary, below map/pooling) */}
        <div className="bg-white rounded-xl shadow-sm border border-outline-variant p-6 flex flex-col justify-between relative overflow-hidden group w-full">
          <div>
            <h3 className="font-label-lg text-on-surface-variant mb-4">{t('benchmarking')}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-1">{t('yourPrice')}</p>
                <p className="font-headline-lg text-primary text-2xl font-bold">₹1500</p>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-1">{t('regionalAvg')}</p>
                <div className="flex items-baseline gap-2">
                  <p className="font-headline-md text-tertiary text-2xl font-bold">₹1450</p>
                  <span className="text-error text-xs font-bold flex items-center">
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                    3.4%
                  </span>
                </div>
              </div>
            </div>

            {/* Recharts Price Comparison Chart */}
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8a6800" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8a6800" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorYour" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9b2f00" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#9b2f00" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis domain={[1200, 1600]} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '11px', background: '#faf9f5', border: '1px solid #8d7168' }} />
                  <Area type="monotone" dataKey="average" stroke="#8a6800" fillOpacity={1} fill="url(#colorAvg)" name="Regional Avg" />
                  <Area type="monotone" dataKey="yourCoop" stroke="#9b2f00" fillOpacity={1} fill="url(#colorYour)" name="Your Coop" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-outline-variant">
            <p className="font-body-md text-xs text-on-surface-variant italic">
              "Lower your raw material costs by pooling orders with nearby coops."
            </p>
          </div>
        </div>

        {/* 4. Nearby Collaborative Opportunities */}
        <section className="space-y-stack-md w-full">
          <h3 className="font-label-lg text-on-surface">{t('nearbyOpportunities')}</h3>
          
          <div className="space-y-stack-sm">
            {/* Row Card 1 */}
            <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm flex flex-col sm:flex-row sm:items-center justify-between hover:border-primary transition-colors group">
              <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <div className="w-14 h-14 bg-surface rounded-lg flex items-center justify-center overflow-hidden border border-outline-variant">
                  <img 
                    className="w-full h-full object-cover" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUfLIgVKUxP2Gb7G8DOHgx7n6ISHr_c9xyjK9iRUNRobCFaI0wNrVsr9yvFKio9wQaffdsPRZ_cFj_8QMsCtbFz3Qzjfjx0-qpQIlWyHWAmFSkYa9sQGP-ZgDywQJx7aut4K0KLN26p4a6Ij6_ap1ZDggkhlJBkUOHFzmQ3KVbXAWhnRHkaa6MEtqDTqXLnqMjAcUR6n8Iyzg6xee9OkrMXwM-Gnb5N056Bm8Zbhq_fOa-tcrEGIXt4XVzUgc6L9M0WupoHE3pzQFt" 
                    alt="Raw Silk Yarn" 
                  />
                </div>
                <div>
                  <h4 className="font-label-lg text-on-surface font-bold">Silk Weaver Coop B</h4>
                  <p className="text-sm text-on-surface-variant">Mulberry Silk Yarn • 250kg Target</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0">
                <div className="text-right">
                  <p className="text-xs font-bold text-primary uppercase">{t('savingsPotentialTitle')}</p>
                  <p className="text-headline-md font-bold text-on-surface text-xl">₹12,500</p>
                </div>
                <button 
                  onClick={() => handleInviteToPool('coop-silk-b', 'Mulberry Silk Yarn', '250kg', '₹12,500')}
                  className="px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-surface-tint transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  disabled={requests.some(r => r.fromCoopId === myCoopId && r.toCoopId === 'coop-silk-b' && r.status === 'pending')}
                >
                  {requests.some(r => r.fromCoopId === myCoopId && r.toCoopId === 'coop-silk-b' && r.status === 'pending') ? 'Invited' : t('joinPool')}
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Row Card 2 */}
            <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm flex flex-col sm:flex-row sm:items-center justify-between hover:border-primary transition-colors group">
              <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <div className="w-14 h-14 bg-surface rounded-lg flex items-center justify-center overflow-hidden border border-outline-variant">
                  <img 
                    className="w-full h-full object-cover" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDL91WtHeeP9SZ5blu9ofwOYti1chObexKla0Y6id1ttAYXzpotqNfSatbUG7Qwx3XK3CzyJsh5rNvn___h-_QZ7XR-7XVVnAc_CyPb2q2ALafv2ZOyEPMgU1AsDxv5K6_OYdkbNmGqtfDdbTUeCSvQV9pKtwtY-B4K44NPHgvmpd8LEZ2esynSnvKjx2Of6UV9XLcc-749xt7XabeXC53C0Ulquyv8vRt7PMkxfQ5v4M3safzvKb9-Ch4FqRlB_u8Umjhuf0MykOoM" 
                    alt="Handloom Shuttle" 
                  />
                </div>
                <div>
                  <h4 className="font-label-lg text-on-surface font-bold">Arani Master Weavers</h4>
                  <p className="text-sm text-on-surface-variant">Fine Zari Thread • 40kg Target</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0">
                <div className="text-right">
                  <p className="text-xs font-bold text-primary uppercase">{t('savingsPotentialTitle')}</p>
                  <p className="text-headline-md font-bold text-on-surface text-xl">₹8,200</p>
                </div>
                <button 
                  onClick={() => handleInviteToPool('coop-arani', 'Fine Zari Thread', '40kg', '₹8,200')}
                  className="px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-surface-tint transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  disabled={requests.some(r => r.fromCoopId === myCoopId && r.toCoopId === 'coop-arani' && r.status === 'pending')}
                >
                  {requests.some(r => r.fromCoopId === myCoopId && r.toCoopId === 'coop-arani' && r.status === 'pending') ? 'Invited' : t('joinPool')}
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
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
