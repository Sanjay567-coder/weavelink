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

interface OrderItem {
  id: string;
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
  expiresAt?: any;
}

export default function OrdersListPage() {
  const t = useTranslations('screen1');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { user, memberProfile, loading: authLoading } = useAuth();
  
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/${locale}`);
      return;
    }

    const coopId = memberProfile?.coopId || 'coop-kanchipuram';
    
    // Query orders for this cooperative
    const q = query(
      collection(db, 'orders'),
      where('coopId', '==', coopId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: OrderItem[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrderItem);
      });
      
      // Sort orders: new ones (by enteredAt/createdAt) at the top
      list.sort((a, b) => {
        const timeA = a.enteredAt?.seconds ? a.enteredAt.seconds * 1000 : new Date(a.enteredAt || 0).getTime();
        const timeB = b.enteredAt?.seconds ? b.enteredAt.seconds * 1000 : new Date(b.enteredAt || 0).getTime();
        return timeB - timeA;
      });

      setOrders(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching orders list:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, memberProfile, authLoading, locale, router]);

  if (authLoading || loading) {
    return <BrandedLoader message="Synchronizing cooperative orders..." fullScreen />;
  }

  const isAdmin = memberProfile?.role === 'admin';

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (filter === 'active') {
      return order.status === 'pending_review' || order.status === 'discussing' || order.status === 'confirmed';
    }
    return true; // Show all
  });

  const getStatusBadge = (status: string, buyerConfirmed?: boolean) => {
    switch (status) {
      case 'pending_review':
        return (
          <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            New Quote
          </span>
        );
      case 'discussing':
        return (
          <span className="bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Discussing
          </span>
        );
      case 'confirmed':
        return (
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[12px] font-extrabold">verified</span>
            Confirmed
          </span>
        );
      case 'declined':
        return (
          <span className="bg-rose-50 border border-rose-200 text-rose-800 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Declined
          </span>
        );
      default:
        return (
          <span className="bg-surface-container border border-outline-variant text-on-surface-variant px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  const getHoursRemaining = (order: OrderItem) => {
    if (!order.expiresAt && !order.enteredAt) return null;
    const expiryTime = order.expiresAt
      ? (order.expiresAt.seconds ? order.expiresAt.seconds * 1000 : new Date(order.expiresAt).getTime())
      : (order.enteredAt.seconds ? order.enteredAt.seconds * 1000 : new Date(order.enteredAt).getTime()) + (48 * 60 * 60 * 1000);
    
    const diffMs = expiryTime - new Date().getTime();
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));
    return hours > 0 ? hours : 0;
  };

  const handleCardClick = (order: OrderItem) => {
    if (isAdmin) {
      if (order.status === 'confirmed') {
        router.push(`/${locale}/orders/${order.id}/allocate`);
      } else {
        router.push(`/${locale}/orders/${order.id}`);
      }
    } else {
      // Weaver flow
      if (order.status === 'confirmed') {
        router.push(`/${locale}/production/${order.id}`);
      } else {
        router.push(`/${locale}/chat/coop-kanchipuram?orderId=${order.id}`);
      }
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-32 flex flex-col relative overflow-hidden">
      {/* Background Ikat texture overlay */}
      <div className="absolute inset-0 ikat-pattern pointer-events-none opacity-5" style={{ height: '300px' }}></div>
      <Header />

      <main className="flex-1 max-w-md mx-auto px-container-padding py-stack-lg flex flex-col gap-stack-md w-full relative z-10">
        
        {/* Page Title & Post Button */}
        <section className="flex justify-between items-center gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold">Cooperative Orders</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Manage and track weaver contracts</p>
          </div>
          
          {isAdmin && (
            <button 
              onClick={() => router.push(`/${locale}/orders/new`)}
              className="flex items-center gap-1 px-3 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-md active:scale-95 duration-100 hover:bg-primary-container cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-sm font-bold">add</span>
              Post Order
            </button>
          )}
        </section>

        {/* Filter Tabs */}
        <div className="flex bg-surface-container border border-outline-variant p-1 rounded-full w-full">
          <button 
            onClick={() => setFilter('active')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              filter === 'active' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Active Orders
          </button>
          <button 
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              filter === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            All History
          </button>
        </div>

        {/* Order Cards List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-outline-variant rounded-xl p-8 text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-outline">assignment_late</span>
              <p className="font-bold text-sm text-on-surface">No Orders Found</p>
              <p className="text-xs text-on-surface-variant">There are currently no orders in this list.</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const hoursLeft = getHoursRemaining(order);
              return (
                <div 
                  key={order.id}
                  onClick={() => handleCardClick(order)}
                  className="bg-white border border-outline-variant hover:border-primary rounded-xl p-4 shadow-sm flex flex-col gap-3 cursor-pointer transition-colors duration-150 hover:shadow-md relative overflow-hidden group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-label-lg text-on-surface font-bold">Order #{order.id.replace('order-', '')}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{order.item}</p>
                    </div>
                    {getStatusBadge(order.status, order.buyerConfirmed)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-surface-container py-2 my-1">
                    <div>
                      <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Buyer</span>
                      <span className="font-semibold text-on-surface truncate block">{order.buyerName}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[10px] uppercase font-bold">Price</span>
                      <span className="font-bold text-primary block">₹{order.price.toLocaleString('en-IN')}</span>
                      {order.buyerConfirmed ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-1.5">
                          <span className="material-symbols-outlined text-[11px] font-extrabold">check_circle</span>
                          Buyer Confirmed ✓
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-1.5">
                          <span className="material-symbols-outlined text-[11px] font-extrabold">pending</span>
                          Awaiting Buyer Confirmation
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-outline">event</span>
                      Del: {new Date(order.deadline).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    
                    {(order.status === 'discussing' || order.status === 'pending_review') && hoursLeft !== null && (
                      <span className={`flex items-center gap-1 font-bold ${hoursLeft < 12 ? 'text-error' : 'text-amber-800'}`}>
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        {hoursLeft > 0 ? `${hoursLeft}h left` : 'Expired'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <Navbar />
      <DevBar />
    </div>
  );
}
