"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface HeaderProps {
  showBack?: boolean;
  backPath?: string;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ showBack = false, backPath, title }) => {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
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

  return (
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
  );
};
