"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';

export const Navbar: React.FC = () => {
  const t = useTranslations('common');
  const pathname = usePathname();
  const { memberProfile } = useAuth();
  const locale = pathname.split('/')[1] || 'en';

  // Get active route tab
  const getActiveTab = () => {
    if (pathname.includes('/chat/')) return 'chat';
    if (pathname.includes('/payments/')) return 'payments';
    if (pathname.includes('/orders/') || pathname.includes('/production/')) return 'orders';
    return 'home';
  };

  const activeTab = getActiveTab();

  const tabClass = (tab: string) => {
    const isActive = activeTab === tab;
    return isActive
      ? "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-gutter py-1 transition-all duration-200 scale-95"
      : "flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors px-gutter py-1 rounded-full";
  };

  const isWeaver = memberProfile?.role === 'weaver';

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 bg-surface border-t border-outline-variant shadow-[0_-4px_12px_rgba(30,27,75,0.08)] rounded-t-xl">
      {/* Home */}
      <Link href={`/${locale}/home`} className={tabClass('home')}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'home' ? "'FILL' 1" : undefined }}>home</span>
        <span className="font-label-sm text-label-sm">{t('home')}</span>
      </Link>

      {/* Orders List Screen */}
      <Link href={`/${locale}/orders`} className={tabClass('orders')}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'orders' ? "'FILL' 1" : undefined }}>assignment</span>
        <span className="font-label-sm text-label-sm">{t('orders')}</span>
      </Link>

      {/* Payments (Link to payments ledger by default) */}
      <Link href={`/${locale}/payments/order-4421`} className={tabClass('payments')}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'payments' ? "'FILL' 1" : undefined }}>payments</span>
        <span className="font-label-sm text-label-sm">
          {isWeaver ? t('myPayments') : t('ledger')}
        </span>
      </Link>

      {/* Chat */}
      <Link href={`/${locale}/chat/coop-kanchipuram`} className={tabClass('chat')}>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'chat' ? "'FILL' 1" : undefined }}>forum</span>
        <span className="font-label-sm text-label-sm">{t('chat')}</span>
      </Link>
    </nav>
  );
};
