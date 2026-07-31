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
  const tCommon = useTranslations('common');
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

  const [coopDetails, setCoopDetails] = useState<Record<string, any>>({});
  const [allCoops, setAllCoops] = useState<any[]>([]);
  const [showNeedsForm, setShowNeedsForm] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newTargetQuantity, setNewTargetQuantity] = useState('');
  const [newSavingsPotential, setNewSavingsPotential] = useState('');
  const [editingMaterials, setEditingMaterials] = useState<{ item: string; targetAmount: string; savings: string; }[]>([]);

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

    // 1. Subscribe to all cooperatives to map IDs to names dynamically AND build opportunities list
    const unsubCoops = onSnapshot(collection(db, 'cooperatives'), (snap) => {
      const names: Record<string, string> = {};
      const details: Record<string, any> = {};
      const list: any[] = [];
      snap.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();
        names[id] = data.name || id;
        details[id] = { id, ...data };
        if (id !== myCoopId && data.availableForPooling === true) {
          list.push({ id, ...data });
        }
      });
      setCoopNames((prev) => ({ ...prev, ...names }));
      setCoopDetails(details);
      setAllCoops(list);
    });



    // 2. Subscribe to pooling requests involving this coop using rule-compliant queries
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

    const unsubRequests1 = onSnapshot(q1, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list1 = list;
      updateRequestsList(list1, list2);
    }, (err) => console.error("Error in q1:", err));

    const unsubRequests2 = onSnapshot(q2, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list2 = list;
      updateRequestsList(list1, list2);
    }, (err) => console.error("Error in q2:", err));

    return () => {
      unsubCoops();
      unsubRequests1();
      unsubRequests2();
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

  const handleOpenNeedsForm = () => {
    if (myCoop && myCoop.materials) {
      setEditingMaterials([...myCoop.materials]);
    } else {
      setEditingMaterials([]);
    }
    setNewMaterialName('');
    setNewTargetQuantity('');
    setNewSavingsPotential('');
    setShowNeedsForm(true);
  };

  const handleAddMaterial = () => {
    if (!newMaterialName || !newTargetQuantity) {
      triggerToast("Material name and target quantity are required.");
      return;
    }
    const savings = newSavingsPotential || "₹5,000";
    const formattedSavings = savings.startsWith('₹') ? savings : `₹${savings}`;
    
    setEditingMaterials((prev) => [
      ...prev,
      { item: newMaterialName, targetAmount: newTargetQuantity, savings: formattedSavings }
    ]);
    
    setNewMaterialName('');
    setNewTargetQuantity('');
    setNewSavingsPotential('');
  };

  const handleDeleteMaterial = (index: number) => {
    setEditingMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveMaterials = async () => {
    if (!user || !memberProfile) return;
    const myCoopId = memberProfile.coopId || 'coop-kanchipuram';

    let finalMaterials = [...editingMaterials];
    if (newMaterialName && newTargetQuantity) {
      const savings = newSavingsPotential || "₹5,000";
      const formattedSavings = savings.startsWith('₹') ? savings : `₹${savings}`;
      finalMaterials.push({
        item: newMaterialName,
        targetAmount: newTargetQuantity,
        savings: formattedSavings
      });
      setNewMaterialName('');
      setNewTargetQuantity('');
      setNewSavingsPotential('');
    }

    const isPublished = myCoop?.availableForPooling || false;

    try {
      await updateDoc(doc(db, 'cooperatives', myCoopId), {
        materials: finalMaterials,
        availableForPooling: isPublished
      });
      triggerToast("Material needs updated successfully.");
      setShowNeedsForm(false);
    } catch (err: any) {
      console.error(err);
      triggerToast("Error updating material needs: " + err.message);
    }
  };

  const handleTogglePublish = async () => {
    if (!user || !memberProfile || !myCoop) return;
    const myCoopId = memberProfile.coopId || 'coop-kanchipuram';
    
    const newStatus = !myCoop.availableForPooling;
    
    if (newStatus && (!myCoop.materials || myCoop.materials.length === 0)) {
      triggerToast("Please add at least one material requirement before publishing.");
      return;
    }

    try {
      await updateDoc(doc(db, 'cooperatives', myCoopId), {
        availableForPooling: newStatus
      });
      triggerToast(newStatus ? "Published to Common Pool!" : "Unpublished. Now in Draft state.");
    } catch (err: any) {
      console.error(err);
      triggerToast("Error toggling publish status: " + err.message);
    }
  };

  if (authLoading || !memberProfile) {
    return <BrandedLoader message="Syncing federation workspace..." fullScreen />;
  }

  const myCoopId = memberProfile.coopId || 'coop-kanchipuram';
  const myCoop = coopDetails[myCoopId];
  
  // Categorize requests client-side
  const waitingList = requests.filter(r => r.fromCoopId === myCoopId && r.status === 'pending');
  const invitedList = requests.filter(r => r.toCoopId === myCoopId && r.status === 'pending');
  const confirmedList = requests.filter(r => (r.fromCoopId === myCoopId || r.toCoopId === myCoopId) && r.status === 'accepted');

  // Filter out opportunities that already have active/pending relationships with my cooperative
  const visibleOpportunities = allCoops.filter((coop) => {
    const hasRelationship = requests.some((r) => 
      (r.fromCoopId === coop.id || r.toCoopId === coop.id) && 
      (r.status === 'pending' || r.status === 'accepted')
    );
    return !hasRelationship;
  });

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
                    <p className="font-label-sm text-primary font-bold">{coopNames['coop-silk-b']}</p>
                    <p className="text-[10px] text-on-surface-variant">{t('distanceAway', { distance: 5 })} • <span className="text-emerald-700 font-bold">{t('highCapacity')}</span></p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${locale}/federation/coop-silk-b`);
                      }}
                      className="mt-2 w-full py-1.5 bg-primary text-white text-[10px] font-bold rounded-md active:scale-95 cursor-pointer"
                    >
                      {t('viewDetailsBtn')}
                    </button>
                  </div>
                )}
              </div>

              {/* Marker 2 */}
              <div className="absolute top-1/2 right-1/4">
                <div className="w-3 h-3 bg-secondary rounded-full border-2 border-white shadow-md"></div>
                <div className="absolute top-4 -right-16 bg-white/90 px-2 py-1 rounded border border-outline-variant text-[10px] whitespace-nowrap">
                  {locale === 'hi' ? 'अरणी क्लस्टर' : locale === 'ta' ? 'ஆரணி கிளஸ்டர்' : 'Arani Cluster'} ({t('distanceAway', { distance: 12 })})
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
                  <p className="font-label-lg text-primary font-bold">{coopNames['coop-silk-b']}</p>
                  <p className="text-xs text-on-surface-variant">
                    {t('distanceAwaySpecialist', { distance: 5, specialist: locale === 'hi' ? 'शहतूत सिल्क यार्न विशेषज्ञ' : locale === 'ta' ? 'மல்பெரி பட்டு நூல் நிபுணர்' : 'Mulberry Silk Yarn Specialist' })}
                  </p>
                </div>
                <button 
                  onClick={() => router.push(`/${locale}/federation/coop-silk-b`)}
                  className="bg-primary text-on-primary px-3 py-1.5 rounded text-xs cursor-pointer"
                >
                  {t('viewDetailsBtn')}
                </button>
              </div>
              <div className="p-3 bg-surface-container-low rounded-lg flex justify-between items-center border border-outline-variant/20">
                <div>
                  <p className="font-label-lg text-on-surface font-bold text-on-surface-variant">
                    {locale === 'hi' ? 'अरणी क्लस्टर' : locale === 'ta' ? 'ஆரணி கிளஸ்டர்' : 'Arani Cluster'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {t('distanceAwaySpecialist', { distance: 12, specialist: locale === 'hi' ? 'जरी धागा विशेषज्ञ' : locale === 'ta' ? 'ஜரி நூல் நிபுணர்' : 'Zari Thread Specialist' })}
                  </p>
                </div>
                <span className="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">{t('atCapacity')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Self-Listing & Material Needs Management (Admin Only) */}
        {memberProfile.role === 'admin' && myCoop && (
          <section className="bg-white rounded-xl shadow-sm border border-outline-variant p-6 space-y-4 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">inventory</span>
                <h3 className="font-label-lg text-on-surface font-extrabold text-xs uppercase tracking-wider">
                  {t('manageMaterialNeeds')}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {myCoop.availableForPooling ? (
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    {t('publishedStatus')}
                  </span>
                ) : (
                  <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    {t('draftStatus')}
                  </span>
                )}
              </div>
            </div>

            {showNeedsForm ? (
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/60 space-y-4">
                <h4 className="font-bold text-xs text-on-surface">{t('editRequirements')}</h4>
                
                {/* Requirements List */}
                <div className="space-y-2">
                  {editingMaterials.map((m, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-outline-variant/40 text-xs">
                      <div>
                        <p className="font-bold text-on-surface">{m.item}</p>
                        <p className="text-on-surface-variant">{t('targetLabel', { amount: m.targetAmount })} • {t('savingsLabel', { amount: m.savings })}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteMaterial(idx)}
                        className="text-error font-bold text-xs hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        {t('removeBtn')}
                      </button>
                    </div>
                  ))}
                  {editingMaterials.length === 0 && (
                    <p className="text-xs text-on-surface-variant italic py-2 text-center">{t('noRequirements')}</p>
                  )}
                </div>

                {/* Add Requirement Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">{t('materialNameLabel')}</label>
                    <input 
                      type="text"
                      value={newMaterialName}
                      onChange={(e) => setNewMaterialName(e.target.value)}
                      placeholder="e.g. Mulberry Silk Yarn"
                      className="w-full border border-outline rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">{t('materialQtyLabel')}</label>
                    <input 
                      type="text"
                      value={newTargetQuantity}
                      onChange={(e) => setNewTargetQuantity(e.target.value)}
                      placeholder="e.g. 250kg or 50L"
                      className="w-full border border-outline rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-on-surface-variant mb-1">{t('materialSavingsLabel')}</label>
                    <input 
                      type="text"
                      value={newSavingsPotential}
                      onChange={(e) => setNewSavingsPotential(e.target.value)}
                      placeholder="e.g. ₹12,500"
                      className="w-full border border-outline rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 gap-3">
                  <button 
                    onClick={handleAddMaterial}
                    className="h-9 px-4 border border-primary text-primary hover:bg-primary/5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    {t('addMaterialBtn')}
                  </button>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowNeedsForm(false)}
                      className="h-9 px-4 border border-outline text-on-surface hover:bg-surface-container rounded-lg font-bold text-xs active:scale-95 transition-all cursor-pointer"
                    >
                      {tCommon('cancel')}
                    </button>
                    <button 
                      onClick={handleSaveMaterials}
                      className="h-9 px-4 bg-primary text-on-primary hover:bg-surface-tint rounded-lg font-bold text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-0.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[14px]">save</span>
                      {t('saveRequirementsBtn')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* List requirements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myCoop.materials && myCoop.materials.length > 0 ? (
                    myCoop.materials.map((m: any, idx: number) => (
                      <div key={idx} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/50 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-on-surface">{m.item}</p>
                          <p className="text-on-surface-variant font-semibold mt-0.5">{t('targetLabel', { amount: m.targetAmount })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-on-surface-variant uppercase font-bold">{t('estSavingsUpperLabel')}</p>
                          <p className="font-extrabold text-primary">{m.savings}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30 text-xs text-on-surface-variant italic">
                      {t('noRequirementsPlaceholder')}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end border-t border-surface-container pt-3">
                  <button 
                    onClick={handleOpenNeedsForm}
                    className="h-9 px-4 border border-outline text-on-surface hover:bg-surface-container rounded-lg font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    {t('editRequirements')}
                  </button>

                  {myCoop.materials && myCoop.materials.length > 0 && (
                    <button 
                      onClick={handleTogglePublish}
                      className={`h-9 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${
                        myCoop.availableForPooling 
                          ? 'border border-error text-error hover:bg-error/5' 
                          : 'bg-primary text-on-primary hover:bg-surface-tint'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {myCoop.availableForPooling ? 'unpublished' : 'publish'}
                      </span>
                      {myCoop.availableForPooling ? t('unpublishDraftBtn') : t('publishCommonBtn')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 2. Live Pooling Status (New Section) */}
        <section className="bg-white rounded-xl shadow-sm border border-outline-variant p-6 space-y-6 w-full">
          <div className="flex items-center gap-2 border-b border-surface-container pb-3">
            <span className="material-symbols-outlined text-primary">groups</span>
            <h3 className="font-label-lg text-on-surface font-extrabold text-xs uppercase tracking-wider">{t('yourPoolingRequests')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Waiting for Response */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                {t('waitingResponse', { count: waitingList.length })}
              </h4>
              <div className="space-y-2">
                {waitingList.map((r) => (
                  <div key={r.id} className="p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl text-xs flex flex-col gap-1">
                    <div className="flex justify-between font-bold text-on-surface">
                      <span>{coopNames[r.toCoopId] || r.toCoopId}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{t('statusPending')}</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{t('pooledLabel', { item: r.item, amount: r.targetAmount })}</p>
                    <p className="text-[9px] text-on-surface-variant/80 italic mt-1">{t('estSavingsLabel', { amount: r.savings })}</p>
                  </div>
                ))}
                {waitingList.length === 0 && (
                  <p className="text-xs text-on-surface-variant italic py-2 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">{t('noSentRequests')}</p>
                )}
              </div>
            </div>

            {/* Invited You */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">mail</span>
                {t('invitedYou', { count: invitedList.length })}
              </h4>
              <div className="space-y-2">
                {invitedList.map((r) => {
                  const senderCoop = coopDetails[r.fromCoopId];
                  return (
                    <div key={r.id} className="p-4 bg-primary-container/10 border border-primary/20 rounded-xl text-xs flex flex-col gap-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-on-surface text-sm">{coopNames[r.fromCoopId] || r.fromCoopId}</span>
                        <span className="text-[10px] text-on-surface-variant font-medium mt-0.5">{t('invitedYouToPoolLabel', { item: r.item, amount: r.targetAmount })}</span>
                      </div>

                      {/* Requester's Material Breakdown */}
                      {senderCoop && senderCoop.materials && senderCoop.materials.length > 0 && (
                        <div className="bg-white/80 p-2.5 rounded-lg border border-outline-variant/40 space-y-1.5 shadow-sm">
                          <p className="text-[9px] uppercase font-bold text-primary tracking-wider">
                            {t('requesterNeedsLabel')}
                          </p>
                          <div className="space-y-1">
                            {senderCoop.materials.map((m: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-[10px] text-on-surface border-b border-surface-container last:border-b-0 pb-1 last:pb-0 font-medium">
                                <span>{m.item}</span>
                                <span className="text-primary font-bold">{m.targetAmount}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-on-surface-variant/80 font-bold border-t border-surface-container pt-2">
                        <span>{t('estSavingsUpperLabel')}</span>
                        <span className="text-primary font-extrabold">{r.savings}</span>
                      </div>

                      {memberProfile?.role === 'admin' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleAcceptInvite(r.id)}
                            className="flex-1 py-2 bg-primary text-on-primary rounded-lg font-bold text-[10px] hover:bg-surface-tint active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-0.5 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            {t('confirmBtn')}
                          </button>
                          <button
                            onClick={() => handleDeclineInvite(r.id)}
                            className="flex-1 py-2 border border-outline text-on-surface hover:bg-surface-container rounded-lg font-bold text-[10px] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[12px]">cancel</span>
                            {t('notRequiredBtn')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {invitedList.length === 0 && (
                  <p className="text-xs text-on-surface-variant italic py-2 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">{t('noActiveInvites')}</p>
                )}
              </div>
            </div>

            {/* Confirmed Pools */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {t('confirmedPools', { count: confirmedList.length })}
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
                          {t('statusActive')}
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{t('itemLabel', { item: r.item, amount: r.targetAmount })}</p>
                      <p className="text-[9px] text-emerald-800 font-extrabold mt-1">{t('totalSavingsLabel', { amount: r.savings })}</p>
                    </div>
                  );
                })}
                {confirmedList.length === 0 && (
                  <p className="text-xs text-on-surface-variant italic py-2 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/30">{t('noActivePools')}</p>
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
              {t('poolingQuote')}
            </p>
          </div>
        </div>

        {/* 4. Nearby Collaborative Opportunities */}
        <section className="space-y-stack-md w-full">
          <h3 className="font-label-lg text-on-surface">{t('nearbyOpportunities')}</h3>
          
          <div className="space-y-stack-sm">
            {visibleOpportunities.map((coop) => {
              const image = coop.id === 'coop-silk-b' 
                ? "https://lh3.googleusercontent.com/aida-public/AB6AXuBUfLIgVKUxP2Gb7G8DOHgx7n6ISHr_c9xyjK9iRUNRobCFaI0wNrVsr9yvFKio9wQaffdsPRZ_cFj_8QMsCtbFz3Qzjfjx0-qpQIlWyHWAmFSkYa9sQGP-ZgDywQJx7aut4K0KLN26p4a6Ij6_ap1ZDggkhlJBkUOHFzmQ3KVbXAWhnRHkaa6MEtqDTqXLnqMjAcUR6n8Iyzg6xee9OkrMXwM-Gnb5N056Bm8Zbhq_fOa-tcrEGIXt4XVzUgc6L9M0WupoHE3pzQFt"
                : "https://lh3.googleusercontent.com/aida-public/AB6AXuDL91WtHeeP9SZ5blu9ofwOYti1chObexKla0Y6id1ttAYXzpotqNfSatbUG7Qwx3XK3CzyJsh5rNvn___h-_QZ7XR-7XVVnAc_CyPb2q2ALafv2ZOyEPMgU1AsDxv5K6_OYdkbNmGqtfDdbTUeCSvQV9pKtwtY-B4K44NPHgvmpd8LEZ2esynSnvKjx2Of6UV9XLcc-749xt7XabeXC53C0Ulquyv8vRt7PMkxfQ5v4M3safzvKb9-Ch4FqRlB_u8Umjhuf0MykOoM";

              const materialSummary = coop.materials
                ? coop.materials.map((m: any) => `${m.item} (${m.targetAmount})`).join(' • ')
                : (locale === 'hi' ? 'थोक सामग्री आवश्यकता' : locale === 'ta' ? 'மொத்த பொருள் தேவை' : 'Bulk Materials Requirement');

              const totalSavings = coop.materials
                ? coop.materials.reduce((sum: number, m: any) => sum + (parseInt(m.savings.replace(/[^\d]/g, '')) || 0), 0)
                : 0;

              return (
                <div 
                  key={coop.id}
                  onClick={() => router.push(`/${locale}/federation/${coop.id}`)} 
                  className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm flex flex-col sm:flex-row sm:items-center justify-between hover:border-primary transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <div className="w-14 h-14 bg-surface rounded-lg flex items-center justify-center overflow-hidden border border-outline-variant">
                      <img 
                        className="w-full h-full object-cover" 
                        src={image} 
                        alt="Raw Material" 
                      />
                    </div>
                    <div>
                      <h4 className="font-label-lg text-on-surface font-bold">{coop.name || coop.id}</h4>
                      <p className="text-sm text-on-surface-variant">{materialSummary}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0">
                    <div className="text-right">
                      <p className="text-xs font-bold text-primary uppercase">{t('savingsPotentialTitle')}</p>
                      <p className="text-headline-md font-bold text-on-surface text-xl">₹{totalSavings.toLocaleString('en-IN')}</p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${locale}/federation/${coop.id}`);
                      }}
                      className="px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-surface-tint transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      {t('viewDetailsBtn')}
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </div>
                </div>
              );
            })}
            {allCoops.length === 0 && (
              <div className="text-center py-6 bg-white rounded-xl border border-outline-variant shadow-sm text-xs text-on-surface-variant italic">
                {t('noOpportunities')}
              </div>
            )}
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
