"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { DevBar } from '@/components/DevBar';
import { BrandedLoader } from '@/components/BrandedLoader';

const STOCK_IMAGES = [
  {
    name: 'Mulberry Silk Brocade',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBG_YlJTCRvUd7y3r-HlmMgAritfMApf0uM14D4QZVVZc6lPlek8zDTMKehFCTTs8DmcWcR3j-WAGoSttHGGWC2jfF_JKhbX1GAsxunXzSfsdeFJH_0NlJAE3Qyia_hv6jrhne1FlWGTbZzNBMgR7LA4qd7y9dHhTLTlRE7ZN0p93HX2QsGO8AfKoL3JaCu4uxipURt5Pi5mggBNuL3zWwa1NtoVwnE_S0Z-kw0xnB6xRP-ol43sjdJ-2FsunLHf5tLfRC9COvNsAKe'
  },
  {
    name: 'Classic Spring Jamdani',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCivaz3HtK7yLT-FmqQtya3bQ57HI10CVv1se4peq9xph55kAzDDgve0wE9oQdZGuTJmV21-lGb_d3qczRmnbvD8Nto7sha652CldLwQ4qn5LfYKs0oC6nn2FsP6TN2XFTz9-7gJVg1wPSI5bKDE90vm8BiEV568L8CoEC2k_PCMqryTHYpa_MAkqaburTXTN6GDYyP94wXCSw6zF31V66yg2XU0cnih0PIW_4TxrIiTe6AG3tNRC98q0pZpBii-biniQQRuyfTcusE'
  }
];

export default function NewOrderPage() {
  const t = useTranslations('screen1');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { user, memberProfile, loading: authLoading } = useAuth();
  
  const [submitting, setSubmitting] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  
  // Set default deadline to 30 days from now (YYYY-MM-DD)
  const getDefaultDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };
  const [deadline, setDeadline] = useState(getDefaultDeadline());
  
  const [expiryHours, setExpiryHours] = useState(48);
  const [selectedImage, setSelectedImage] = useState(STOCK_IMAGES[0].url);
  const [errorMsg, setErrorMsg] = useState('');

  // Access check
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/${locale}`);
      return;
    }
    if (memberProfile && memberProfile.role !== 'admin') {
      alert("Unauthorized: Only Admins can access this page.");
      router.push(`/${locale}/orders`);
    }
  }, [user, memberProfile, authLoading, locale, router]);

  if (authLoading || submitting) {
    return <BrandedLoader message="Registering new cooperative order..." fullScreen />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !item.trim() || !quantity || !price || !deadline) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (Number(quantity) <= 0 || Number(price) <= 0) {
      setErrorMsg('Quantity and Price must be positive values.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (deadline < todayStr) {
      setErrorMsg('Deadline cannot be in the past.');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    try {
      const newOrderId = `order-${Math.floor(1000 + Math.random() * 9000)}`;
      const coopId = memberProfile?.coopId || 'coop-kanchipuram';
      const adminName = memberProfile?.name || 'Amit Patel';
      const enteredBy = `${adminName} (Admin)`;

      // Set order expiresAt timestamp
      const expiresAtDate = new Date();
      expiresAtDate.setHours(expiresAtDate.getHours() + expiryHours);

      // Create order document in Firestore
      await setDoc(doc(db, 'orders', newOrderId), {
        coopId,
        buyerName: buyerName.trim(),
        item: item.trim(),
        quantity: Number(quantity),
        price: Number(price),
        deadline,
        status: 'discussing', // Automatically starts in Discussing status
        buyerConfirmed: false,
        enteredBy,
        enteredAt: serverTimestamp(),
        expiresAt: expiresAtDate,
        imageUrl: selectedImage,
      });

      // Auto-post system notification message to cooperative chat
      await addDoc(collection(db, 'cooperatives', coopId, 'messages'), {
        senderId: 'system',
        senderName: 'System Log',
        messageText: `New order #${newOrderId.replace('order-', '')} posted by ${adminName} — ${item.trim()}, ${quantity} units, ₹${Number(price).toLocaleString('en-IN')}`,
        isAudio: false,
        timestamp: serverTimestamp(),
      });

      // Redirect to newly created order's detail screen
      router.push(`/${locale}/orders/${newOrderId}`);
    } catch (err: any) {
      console.error("Error creating order:", err);
      setErrorMsg(`Failed to create order: ${err.message}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen pb-32 flex flex-col relative overflow-hidden">
      {/* Background Ikat texture overlay */}
      <div className="absolute inset-0 ikat-pattern pointer-events-none opacity-5" style={{ height: '300px' }}></div>
      <Header showBack backPath={`/${locale}/orders`} />

      <main className="flex-1 max-w-md mx-auto px-container-padding py-stack-md flex flex-col gap-stack-md w-full relative z-10">
        
        {/* Title */}
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold">Post New Order</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">Quote and initiate weaver consensus</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Glassmorphic Form */}
        <form onSubmit={handleSubmit} className="bg-white/80 border border-outline-variant/60 rounded-xl p-5 shadow-sm space-y-4">
          
          {/* Buyer */}
          <div className="space-y-1.5">
            <label htmlFor="buyerName" className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('buyerNameLabel')}
            </label>
            <input 
              type="text"
              id="buyerName"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder={t('buyerNamePlaceholder')}
              required
              className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Item Description */}
          <div className="space-y-1.5">
            <label htmlFor="item" className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('itemDescLabel')}
            </label>
            <input 
              type="text"
              id="item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder={t('itemDescPlaceholder')}
              required
              className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label htmlFor="quantity" className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('qtyLabel')}
              </label>
              <div className="relative">
                <input 
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value !== '' ? Number(e.target.value) : '')}
                  placeholder="50"
                  required
                  min="1"
                  className="w-full bg-white border border-outline-variant rounded-lg pl-3 pr-12 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-on-surface-variant">{t('quantityUnit')}</span>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <label htmlFor="price" className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('priceLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-on-surface-variant">₹</span>
                <input 
                  type="number"
                  id="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value !== '' ? Number(e.target.value) : '')}
                  placeholder="75000"
                  required
                  min="1"
                  className="w-full bg-white border border-outline-variant rounded-lg pl-6 pr-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Deadline */}
            <div className="space-y-1.5">
              <label htmlFor="deadline" className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('deadlineLabel')}
              </label>
              <input 
                type="date"
                id="deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
                className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Expiry Window */}
            <div className="space-y-1.5">
              <label htmlFor="expiry" className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('expiryTimerLabel')}
              </label>
              <select 
                id="expiry"
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value={24}>{t('opt24h')}</option>
                <option value={48}>{t('opt48h')}</option>
                <option value={72}>{t('opt72h')}</option>
                <option value={120}>{t('opt5d')}</option>
              </select>
            </div>
          </div>

          {/* Product Image Carousel */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('selectImageLabel')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {STOCK_IMAGES.map((img) => (
                <div 
                  key={img.name}
                  onClick={() => setSelectedImage(img.url)}
                  className={`border-2 rounded-xl p-2 cursor-pointer transition-all flex flex-col gap-2 ${
                    selectedImage === img.url ? 'border-primary bg-primary/5 shadow-sm' : 'border-outline-variant hover:border-outline bg-white'
                  }`}
                >
                  <div 
                    className="h-20 w-full rounded-lg bg-cover bg-center" 
                    style={{ backgroundImage: `url('${img.url}')` }}
                  ></div>
                  <span className="text-[10px] font-bold text-center truncate">{img.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={() => router.push(`/${locale}/orders`)}
              className="flex-1 py-2.5 border border-outline text-outline font-bold text-xs rounded-xl hover:bg-surface-container active:scale-95 transition-transform duration-100 cursor-pointer"
            >
              {tCommon('cancel')}
            </button>
            <button 
              type="submit"
              className="flex-1 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary-container active:scale-95 transition-transform duration-100 cursor-pointer"
            >
              {t('submitOrderBtn')}
            </button>
          </div>

        </form>

      </main>

      <Navbar />
      <DevBar />
    </div>
  );
}
