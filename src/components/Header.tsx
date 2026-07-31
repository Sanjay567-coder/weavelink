"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';

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
  }

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState('');

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
    setSelectedIds(new Set());
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
          role: data.role || 'weaver'
        });
      });
      setCandidates(list);
    } catch (err) {
      console.error("Error fetching candidates in Header:", err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmAddMembers = async () => {
    if (selectedIds.size === 0 || !memberProfile) return;
    const myCoopId = memberProfile.coopId || 'coop-kanchipuram';
    try {
      const batch = writeBatch(db);
      
      selectedIds.forEach((id) => {
        const candidate = candidates.find(c => c.id === id);
        if (!candidate) return;

        const memberRef = doc(db, 'members', id);
        batch.update(memberRef, {
          coopId: myCoopId,
          role: 'weaver'
        });

        const msgRef = doc(collection(db, 'cooperatives', myCoopId, 'messages'));
        batch.set(msgRef, {
          senderId: 'system',
          senderName: 'System Log',
          messageText: `${candidate.name} added to the group`,
          isAudio: false,
          timestamp: new Date(),
          systemMessageType: 'member_added',
          systemMessageMetadata: {
            name: candidate.name
          }
        });
      });

      await batch.commit();

      setCandidates(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      
      setToastMsg(t('successAddMember'));
      setTimeout(() => setToastMsg(''), 4000);
      
      setTimeout(() => setShowAddMemberModal(false), 800);
    } catch (err: any) {
      console.error("Error adding members in Header:", err);
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
          className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary cursor-pointer select-none"
        >
          {title || t('title')}
        </div>

        <div className="flex items-center gap-2">
          {/* Add Members Icon for Admin */}
          {isAdmin && (
            <button 
              onClick={handleOpenAddMember}
              className="hover:bg-surface-container-high p-1.5 rounded-full transition-colors active:scale-95 duration-150 relative cursor-pointer mr-1"
              title={t('addMembers') || "Add Members"}
            >
              <span className="material-symbols-outlined text-primary text-[20px] font-bold">group_add</span>
            </button>
          )}

          {/* Language Switcher Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)} 
              className="flex items-center gap-1.5 hover:bg-surface-container px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-container-low transition-all duration-200 active:scale-95 cursor-pointer text-xs font-bold text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-primary text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>language</span>
              <span>{localeNames[currentLocale] || currentLocale}</span>
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
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
              <span className="material-symbols-outlined text-xs animate-spin">sync</span>
              <span className="text-[10px] font-bold uppercase">{t('syncing')}</span>
            </div>
          ) : isOnline ? (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-200">
              <span className="material-symbols-outlined text-xs">cloud_off</span>
              <span className="text-[10px] font-bold uppercase">Offline</span>
            </div>
          )}

          {/* Quick Profile Signout */}
          {user && (
            <button 
              onClick={logout} 
              className="ml-2 hover:bg-surface-container-high p-1.5 rounded-full transition-colors active:scale-95 duration-150"
              title="Log Out"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-lg">logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-gutter">
          <div className="bg-white border border-outline-variant rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200 font-sans text-left">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-surface-container mb-4">
              <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">group_add</span>
                {t('addMembers')}
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
                  <p>{t('noCandidates')}</p>
                </div>
              ) : (
                candidates.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                    <div 
                      key={c.id}
                      onClick={() => toggleSelect(c.id)}
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
                        {isSelected && <span className="material-symbols-outlined text-xs font-extrabold animate-scale-up text-primary">check</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selection Details & Confirm */}
            {selectedIds.size > 0 && (
              <div className="mt-4 pt-4 border-t border-surface-container bg-surface-container-lowest/50 rounded-xl space-y-4 animate-in slide-in-from-bottom-2 duration-200">
                <p className="text-xs text-on-surface-variant leading-relaxed px-1">
                  {selectedIds.size === 1 
                    ? t('confirmAddMember', { name: candidates.find(c => selectedIds.has(c.id))?.name || '' })
                    : t('confirmAddMembers', { count: selectedIds.size })}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSelectedIds(new Set())}
                    className="flex-grow py-2.5 border border-outline text-outline font-bold text-xs text-center rounded-xl hover:bg-surface-container active:scale-95 duration-100 cursor-pointer bg-white"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={handleConfirmAddMembers}
                    className="flex-grow py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary-container active:scale-95 duration-100 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                    {t('confirmBtn')}
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
    </>
  );
};
