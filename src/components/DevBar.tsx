"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const DevBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, memberProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  const locale = pathname.split('/')[1] || 'en';

  useEffect(() => {
    // Clean up container on unmount
    return () => {
      const container = document.getElementById('dev-recaptcha');
      if (container) container.innerHTML = '';
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch (e) {
          console.warn(e);
        }
      }
    };
  }, []);

  const switchRole = async (role: 'admin' | 'weaver' | 'treasurer') => {
    setLoading(true);
    setStatusMsg(`Signing in as ${role}...`);
    try {
      const phoneMap = {
        admin: '+919999999999',
        weaver: '+918888888888',
        treasurer: '+917777777777',
      };
      
      const phone = phoneMap[role];

      // Clean up old verifier if it exists
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch (e) {
          console.warn("Error clearing verifier:", e);
        }
        verifierRef.current = null;
      }

      // Create a temporary element for recaptcha
      let recaptchaContainer = document.getElementById('dev-recaptcha');
      if (!recaptchaContainer) {
        recaptchaContainer = document.createElement('div');
        recaptchaContainer.id = 'dev-recaptcha';
        document.body.appendChild(recaptchaContainer);
      }
      recaptchaContainer.innerHTML = '';

      const verifier = new RecaptchaVerifier(auth, recaptchaContainer, {
        size: 'invisible',
      });
      verifierRef.current = verifier;

      // 2. Trigger Phone Auth
      const confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
      
      // 3. Confirm with the test code configured in Firebase
      await confirmationResult.confirm('123456');

      setStatusMsg(`Success! Signed in as ${role}`);
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      console.error("DevBar login error:", err);
      setStatusMsg(`Error: ${(err as Error).message || 'Authentication failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const screens = [
    { num: 1, name: 'S1: Order Received (Admin)', path: `/orders/order-8922` },
    { num: 2, name: 'S2: Share to Chat (Admin)', path: `/orders/order-8922/share` },
    { num: 3, name: 'S3: Weaver Chat (Weaver)', path: `/chat/coop-kanchipuram` },
    { num: 4, name: 'S4: Consensus (Admin)', path: `/orders/order-8922/consensus` },
    { num: 5, name: 'S5: Allocation (Admin)', path: `/orders/order-4421/allocate` },
    { num: 6, name: 'S6: Tracking (Both)', path: `/production/order-4421` },
    { num: 7, name: 'S7: Payments (Both)', path: `/payments/order-4421` },
    { num: 8, name: 'S8: Federation (Stretch)', path: `/federation` }
  ];

  if (process.env.NODE_ENV === 'production' && !pathname.includes('demo')) {
    // Hide in production unless explicitly demo route
    // return null;
  }

  return (
    <div className="fixed left-4 bottom-24 z-50 font-sans">
      <div id="dev-recaptcha" className="hidden"></div>
      
      {/* Dev Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-indigo-900 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-indigo-950 transition-colors active:scale-95 cursor-pointer"
        title="Developer Hackathon Menu"
      >
        <span className="material-symbols-outlined">{isOpen ? 'close' : 'terminal'}</span>
      </button>

      {/* Dev Panel */}
      {isOpen && (
        <div className="absolute left-0 bottom-14 w-80 bg-slate-900 text-slate-100 rounded-xl p-4 shadow-2xl border border-slate-700 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex justify-between items-center border-b border-slate-700 pb-2">
            <span className="font-bold text-xs uppercase tracking-wider text-indigo-400">Hackathon Panel</span>
            <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full font-bold">Demo Mode</span>
          </div>

          {/* Current Auth Status */}
          <div className="text-xs bg-slate-800 p-2.5 rounded-lg border border-slate-700 space-y-1">
            <div>
              <span className="text-slate-400">User:</span>{' '}
              <span className="font-mono text-[11px] text-emerald-400">
                {user ? user.phoneNumber : 'Not Logged In'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Role:</span>{' '}
              <span className="font-bold text-indigo-300 uppercase">
                {memberProfile?.role || 'Guest'}
              </span>
            </div>
            {statusMsg && (
              <div className="text-[10px] font-medium text-amber-300 animate-pulse mt-1">
                {statusMsg}
              </div>
            )}
          </div>

          {/* Role Quick Switcher */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Auth Role Switcher</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button 
                disabled={loading}
                onClick={() => switchRole('admin')}
                className="py-1 px-2 text-[10px] font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800 disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                Admin
              </button>
              <button 
                disabled={loading}
                onClick={() => switchRole('weaver')}
                className="py-1 px-2 text-[10px] font-semibold bg-amber-700 text-white rounded hover:bg-amber-800 disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                Weaver
              </button>
              <button 
                disabled={loading}
                onClick={() => switchRole('treasurer')}
                className="py-1 px-2 text-[10px] font-semibold bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                Treasurer
              </button>
            </div>
          </div>

          {/* Screen Jumper */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Screen Quick Jump</span>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
              {screens.map((scr) => (
                <button
                  key={scr.num}
                  onClick={() => {
                    router.push(`/${locale}${scr.path}`);
                    setIsOpen(false);
                  }}
                  className="w-full text-left py-1.5 px-2 text-xs hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors border border-transparent hover:border-slate-700 flex justify-between items-center cursor-pointer"
                >
                  <span>{scr.name}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
