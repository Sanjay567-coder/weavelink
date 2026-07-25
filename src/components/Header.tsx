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
    // Current path is e.g. /en/orders/123 or /hi/orders/123
    // We want to replace the first segment /en or /hi with newLocale
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');
    router.push(newPath);
  };

  const getLanguageLabel = () => {
    // Check path to see current locale
    const currentLocale = pathname.split('/')[1];
    return currentLocale === 'hi' ? 'English' : 'हिन्दी';
  };

  const toggleLanguage = () => {
    const currentLocale = pathname.split('/')[1];
    const newLocale = currentLocale === 'hi' ? 'en' : 'hi';
    switchLocale(newLocale);
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
        {showBack ? (
          <button 
            onClick={handleBack} 
            className="material-symbols-outlined text-primary hover:bg-surface-container-high p-2 rounded-full transition-colors active:scale-95 duration-150 mr-2"
          >
            arrow_back
          </button>
        ) : (
          <button 
            onClick={toggleLanguage} 
            className="flex items-center gap-1 hover:bg-surface-container-high px-2 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>language</span>
            <span className="font-label-lg text-label-lg text-on-surface">{getLanguageLabel()}</span>
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
