"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, writeBatch, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';

interface HeaderProps {
  showBack?: boolean;
  backPath?: string;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ showBack = false, backPath, title }) => {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const { user, memberProfile, logout } = useAuth();
  const isAdmin = memberProfile?.role === 'admin';

  interface Candidate {
    id: string;
    name: string;
    phone: string;
    role: string;
    age?: number;
    experience?: number;
    specialization?: string;
    area?: string;
  }

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [toggleMode, setToggleMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [experience, setExperience] = useState('');
  const [specialization, setSpecialization] = useState('Silk');
  const [area, setArea] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentLocale = pathname.split('/')[1] || 'en';

  const localeNames: Record<string, string> = {
    'en': 'English',
    'hi': 'हिन्दी',
    'ta': 'தமிழ்'
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Monitor Firestore sync status if authenticated
    let unsubSync: () => void = () => {};
    if (user) {
      const docRef = doc(db, 'members', user.uid);
      unsubSync = onSnapshot(docRef, { includeMetadataChanges: true }, (snapshot) => {
        setIsSyncing(snapshot.metadata.hasPendingWrites);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSync();
    };
  }, [user]);

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');
    router.push(newPath);
  };

  const handleBack = () => {
    if (backPath) {
      router.push(backPath);
    } else {
      router.back();
    }
  };

  const handleOpenAddMember = async () => {
    setLoadingCandidates(true);
    setToggleMode('new');
    setName('');
    setPhone('');
    setAge('');
    setExperience('');
    setSpecialization('Silk');
    setArea('');
    setSelectedCandidate(null);
    setShowAddMemberModal(true);
    try {
      const q = query(collection(db, 'members'), where('coopId', '==', ''));
      const querySnapshot = await getDocs(q);
      const list: Candidate[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name || 'Anonymous',
          phone: data.phone || '',
          role: data.role || 'weaver',
          age: data.age,
          experience: data.experience,
          specialization: data.specialization,
          area: data.area
        });
      });
      setCandidates(list);
    } catch (err) {
      console.error("Error fetching candidates in Header:", err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleSelectCandidate = (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
      setSelectedCandidate(candidate);
      setName(candidate.name);
      setPhone(candidate.phone);
      setAge(candidate.age?.toString() || '');
      setExperience(candidate.experience?.toString() || '');
      setSpecialization(candidate.specialization || 'Silk');
      setArea(candidate.area || '');
    } else {
      setSelectedCandidate(null);
      setName('');
      setPhone('');
      setAge('');
      setExperience('');
      setSpecialization('Silk');
      setArea('');
    }
  };

  const handleConfirmAddMember = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !phone.trim() || !memberProfile) return;

    const myCoopId = memberProfile.coopId || 'coop-kanchipuram';
    
    // Normalization of phone number client-side
    let normalizedPhone = phone.trim().replace(/[\s-()]/g, '');
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+91' + normalizedPhone; // Default to India country code
    }

    try {
      if (toggleMode === 'existing' && selectedCandidate) {
        // Mode 1: Claim existing candidate
        const memberRef = doc(db, 'members', selectedCandidate.id);
        await updateDoc(memberRef, {
          coopId: myCoopId,
          role: 'weaver'
        });

        // Add structured system message
        await addDoc(collection(db, 'cooperatives', myCoopId, 'messages'), {
          senderId: 'system',
          senderName: 'System Log',
          messageText: `${selectedCandidate.name} added to the group`,
          isAudio: false,
          timestamp: new Date(),
          systemMessageType: 'member_added',
          systemMessageMetadata: {
            name: selectedCandidate.name
          }
        });
      } else {
        // Mode 2: Create a brand new member document with auto-generated ID
        await addDoc(collection(db, 'members'), {
          name: name.trim(),
          phone: normalizedPhone,
          age: parseInt(age) || 0,
          experience: parseInt(experience) || 0,
          specialization: specialization.trim(),
          area: area.trim(),
          coopId: myCoopId,
          role: 'weaver',
          capacity: 5,
          loomId: `LOM-${Math.floor(100 + Math.random() * 900)}`
        });

        // Add structured system message
        await addDoc(collection(db, 'cooperatives', myCoopId, 'messages'), {
          senderId: 'system',
          senderName: 'System Log',
          messageText: `${name.trim()} added to the group`,
          isAudio: false,
          timestamp: new Date(),
          systemMessageType: 'member_added',
          systemMessageMetadata: {
            name: name.trim()
          }
        });
      }

      setToastMsg(t('successAddMember'));
      setTimeout(() => setToastMsg(''), 4000);
      
      setTimeout(() => setShowAddMemberModal(false), 800);
    } catch (err: any) {
      console.error("Error adding member in Header:", err);
      setToastMsg("Error: " + err.message);
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface dark:bg-surface shadow-sm shadow-secondary/10 flex justify-between items-center w-full px-container-padding py-stack-sm h-touch-target">
        <div className="flex items-center gap-2">
          {showBack && (
            <button 
              onClick={handleBack} 
              className="material-symbols-outlined text-primary hover:bg-surface-container-high p-2 rounded-full transition-colors active:scale-95 duration-150 mr-2"
            >
              arrow_back
            </button>
          )}
        </div>

        <div 
          onClick={() => router.push(`/${pathname.split('/')[1]}`)}
          className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary cursor-pointer select-none truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none"
        >
          {title || t('title')}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Add Members Icon for Admin */}
          {isAdmin && (
            <button 
              onClick={handleOpenAddMember}
              className="hover:bg-surface-container-high p-1.5 rounded-full transition-colors active:scale-95 duration-150 relative cursor-pointer mr-0.5"
              title={t('addMembers') || "Add Members"}
            >
              <span className="material-symbols-outlined text-primary text-[20px] font-bold">group_add</span>
            </button>
          )}

          {/* Language Switcher Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)} 
              className="flex items-center gap-1 sm:gap-1.5 hover:bg-surface-container px-2 sm:px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-container-low transition-all duration-200 active:scale-95 cursor-pointer text-xs font-bold text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-primary text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>language</span>
              <span className="hidden sm:inline">{localeNames[currentLocale] || currentLocale}</span>
              <span className="inline sm:hidden uppercase font-mono text-[10px]">{currentLocale}</span>
              <span className={`material-symbols-outlined text-xs transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {dropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-outline-variant p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {Object.entries(localeNames).map(([code, name]) => (
                    <button
                      key={code}
                      onClick={() => {
                        switchLocale(code);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                        currentLocale === code 
                          ? 'bg-primary/10 text-primary font-bold' 
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      {name}
                      {currentLocale === code && (
                        <span className="material-symbols-outlined text-xs text-primary font-extrabold">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sync / Online Indicator */}
          {isSyncing ? (
            <div className="flex items-center gap-1 px-1.5 sm:px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200" title={t('syncing') || "Syncing"}>
              <span className="material-symbols-outlined text-xs animate-spin">sync</span>
              <span className="text-[10px] font-bold uppercase hidden sm:inline">{t('syncing')}</span>
            </div>
          ) : isOnline ? (
            <div className="flex items-center gap-1.5 px-1.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-100" title="Online">
              <span className="material-symbols-outlined text-primary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-1.5 sm:px-3 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-200" title="Offline">
              <span className="material-symbols-outlined text-xs">cloud_off</span>
              <span className="text-[10px] font-bold uppercase hidden sm:inline">Offline</span>
            </div>
          )}

          {/* Quick Profile Signout */}
          {user && (
            <button 
              onClick={logout} 
              className="ml-1 hover:bg-surface-container-high p-1.5 rounded-full transition-colors active:scale-95 duration-150"
              title="Log Out"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-lg">logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-gutter font-sans">
          <div className="bg-white border border-outline-variant rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200 font-sans text-left">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-surface-container mb-3 flex-shrink-0">
              <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">group_add</span>
                {t('addMembers')}
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container active:scale-95 duration-100 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* New / Existing segment toggle */}
            <div className="flex bg-surface-container rounded-xl p-1 mb-3 border border-outline-variant/60 flex-shrink-0 select-none">
              <button 
                type="button"
                onClick={() => {
                  setToggleMode('new');
                  setSelectedCandidate(null);
                  setName('');
                  setPhone('');
                  setAge('');
                  setExperience('');
                  setSpecialization('Silk');
                  setArea('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  toggleMode === 'new' 
                    ? 'bg-white text-primary shadow-sm font-bold' 
                    : 'text-on-surface-variant hover:text-on-surface font-semibold'
                }`}
              >
                New Member
              </button>
              <button 
                type="button"
                onClick={() => {
                  setToggleMode('existing');
                  setSelectedCandidate(null);
                  setName('');
                  setPhone('');
                  setAge('');
                  setExperience('');
                  setSpecialization('Silk');
                  setArea('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  toggleMode === 'existing' 
                    ? 'bg-white text-primary shadow-sm font-bold' 
                    : 'text-on-surface-variant hover:text-on-surface font-semibold'
                }`}
              >
                Existing Candidate
              </button>
            </div>

            {/* Candidate Search Dropdown (Existing mode only) */}
            {toggleMode === 'existing' && (
              <div className="space-y-1 mb-3 text-left flex-shrink-0">
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider select-none">Select Existing Candidate</label>
                {loadingCandidates ? (
                  <div className="text-xs text-on-surface-variant py-2 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading candidates...</span>
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="text-xs text-rose-600 font-semibold py-1">
                    {t('noCandidates')}
                  </div>
                ) : (
                  <select
                    value={selectedCandidate?.id || ''}
                    onChange={(e) => handleSelectCandidate(e.target.value)}
                    className="w-full bg-white border border-outline-variant rounded-xl p-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-on-surface cursor-pointer"
                  >
                    <option value="">-- Choose Candidate --</option>
                    {candidates.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Input Form Fields */}
            {(toggleMode === 'new' || selectedCandidate) ? (
              <form onSubmit={handleConfirmAddMember} className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin flex flex-col justify-between">
                <div className="space-y-3">
                  {/* Name */}
                  <div className="space-y-1 text-left">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider select-none">Full Name</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      disabled={toggleMode === 'existing'}
                      placeholder="e.g. Gita Devi"
                      required
                      className="w-full bg-white border border-outline-variant rounded-xl p-2.5 text-xs focus:border-primary focus:outline-none disabled:bg-surface-container/50 disabled:text-on-surface-variant text-on-surface"
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1 text-left">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider select-none">Mobile Number</label>
                    <input 
                      type="tel" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      disabled={toggleMode === 'existing'}
                      placeholder="e.g. 9876543210"
                      required
                      className="w-full bg-white border border-outline-variant rounded-xl p-2.5 text-xs focus:border-primary focus:outline-none disabled:bg-surface-container/50 disabled:text-on-surface-variant text-on-surface"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Age */}
                    <div className="space-y-1 text-left">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider select-none">Age</label>
                      <input 
                        type="number" 
                        value={age} 
                        onChange={(e) => setAge(e.target.value)} 
                        disabled={toggleMode === 'existing'}
                        placeholder="e.g. 34"
                        className="w-full bg-white border border-outline-variant rounded-xl p-2.5 text-xs focus:border-primary focus:outline-none disabled:bg-surface-container/50 disabled:text-on-surface-variant text-on-surface font-mono"
                      />
                    </div>

                    {/* Experience */}
                    <div className="space-y-1 text-left">
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider select-none">Experience (Years)</label>
                      <input 
                        type="number" 
                        value={experience} 
                        onChange={(e) => setExperience(e.target.value)} 
                        disabled={toggleMode === 'existing'}
                        placeholder="e.g. 8"
                        className="w-full bg-white border border-outline-variant rounded-xl p-2.5 text-xs focus:border-primary focus:outline-none disabled:bg-surface-container/50 disabled:text-on-surface-variant text-on-surface font-mono"
                      />
                    </div>
                  </div>

                  {/* Weaving Specialization dropdown */}
                  <div className="space-y-1 text-left">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider select-none">Weaving Specialization</label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      disabled={toggleMode === 'existing'}
                      className="w-full bg-white border border-outline-variant rounded-xl p-2.5 text-xs focus:border-primary focus:outline-none disabled:bg-surface-container/50 disabled:text-on-surface-variant text-on-surface cursor-pointer"
                    >
                      <option value="Silk">Silk</option>
                      <option value="Cotton">Cotton</option>
                      <option value="Zari">Zari</option>
                      <option value="Polyester">Polyester</option>
                      <option value="Linen">Linen</option>
                    </select>
                  </div>

                  {/* Village/Area */}
                  <div className="space-y-1 text-left">
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider select-none">Village / Area</label>
                    <input 
                      type="text" 
                      value={area} 
                      onChange={(e) => setArea(e.target.value)} 
                      disabled={toggleMode === 'existing'}
                      placeholder="e.g. Kanchipuram Outer"
                      className="w-full bg-white border border-outline-variant rounded-xl p-2.5 text-xs focus:border-primary focus:outline-none disabled:bg-surface-container/50 disabled:text-on-surface-variant text-on-surface"
                    />
                  </div>
                </div>

                {/* Confirm Section Prompt & Action buttons */}
                <div className="pt-3 border-t border-surface-container bg-surface-container-lowest/50 rounded-xl space-y-3 flex-shrink-0">
                  <p className="text-[11px] text-on-surface-variant leading-relaxed px-1">
                    {toggleMode === 'existing' 
                      ? t('confirmAddMember', { name: selectedCandidate?.name || '' })
                      : t('confirmAddMember', { name: name.trim() || 'this member' })}
                  </p>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowAddMemberModal(false)}
                      className="flex-grow py-2 border border-outline text-outline font-bold text-xs text-center rounded-xl hover:bg-surface-container active:scale-95 duration-100 cursor-pointer bg-white"
                    >
                      {t('cancel')}
                    </button>
                    <button 
                      type="submit"
                      disabled={!name.trim() || !phone.trim()}
                      className="flex-grow py-2 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary-container active:scale-95 duration-100 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">check</span>
                      {t('confirmBtn')}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-xs text-on-surface-variant gap-2 select-none">
                <span className="material-symbols-outlined text-outline text-4xl">contact_page</span>
                <p>Choose an unassigned weaver candidate above to review and add them to your cooperative.</p>
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
    </>
  );
};
