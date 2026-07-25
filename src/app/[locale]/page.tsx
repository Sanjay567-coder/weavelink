"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { DevBar } from '@/components/DevBar';

export default function LoginPage() {
  const t = useTranslations('common');
  const router = useRouter();
  const { user, memberProfile, loading, setupRecaptcha, sendOtp } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  // Clean up verifier on unmount
  useEffect(() => {
    return () => {
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch (e) {
          console.warn(e);
        }
      }
    };
  }, []);

  // If already authenticated and member profile loaded, redirect automatically
  useEffect(() => {
    if (!loading && user && memberProfile) {
      if (memberProfile.role === 'admin') {
        router.push('/en/orders/order-8922'); // Redirect to Screen 1
      } else {
        router.push('/en/chat/coop-kanchipuram'); // Redirect to Screen 3
      }
    }
  }, [user, memberProfile, loading, router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setErrorMsg('');
    setStatusMsg('');
    setAuthLoading(true);

    try {
      // Setup invisible recaptcha verifier
      const verifier = await setupRecaptcha('recaptcha-container');
      const confirmationResult = await sendOtp(phoneNumber, verifier);
      confirmationResultRef.current = confirmationResult;
      
      setStep('otp');
      setStatusMsg('OTP Sent successfully to ' + phoneNumber);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to send OTP. Please check the number format.');
      // Reset recaptcha container
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = '';
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !confirmationResultRef.current) return;

    setErrorMsg('');
    setStatusMsg('');
    setAuthLoading(true);

    try {
      await confirmationResultRef.current.confirm(otpCode);
      setStatusMsg('OTP Verified! Signing in...');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Invalid verification code. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Helper for quick logging in with mock numbers (preconfigured in Firebase console)
  const quickLogin = async (phone: string) => {
    setErrorMsg('');
    setAuthLoading(true);
    setStatusMsg('Logging in with test account...');
    try {
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch (e) {
          console.warn("Error clearing verifier:", e);
        }
        verifierRef.current = null;
      }

      let recaptchaContainer = document.getElementById('recaptcha-container');
      if (!recaptchaContainer) {
        recaptchaContainer = document.createElement('div');
        recaptchaContainer.id = 'recaptcha-container';
        document.body.appendChild(recaptchaContainer);
      }
      recaptchaContainer.innerHTML = '';

      const verifier = new RecaptchaVerifier(auth, recaptchaContainer, {
        size: 'invisible',
      });
      verifierRef.current = verifier;

      const confirmationResult = await sendOtp(phone, verifier);
      await confirmationResult.confirm('123456');
      setStatusMsg('Logged in successfully!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Quick login failed: ' + (err.message || 'Make sure test accounts are set in console.'));
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
          <p className="font-label-lg text-on-surface-variant">Loading WeaveLink...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-gutter py-12 relative overflow-hidden bg-background">
      {/* Background Texture Overlay */}
      <div className="absolute inset-0 ikat-pattern pointer-events-none opacity-[0.03]" style={{ height: '300px' }}></div>
      <div className="absolute inset-0 texture-overlay pointer-events-none opacity-40"></div>

      {/* Recaptcha Anchor */}
      <div id="recaptcha-container"></div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white border border-outline-variant rounded-2xl shadow-[0_4px_12px_rgba(30,27,75,0.08)] p-8 relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>language</span>
            <h1 className="font-headline-lg text-primary text-3xl font-extrabold tracking-tight">WeaveLink</h1>
          </div>
          <p className="font-body-md text-on-surface-variant">Digital Craftsmanship Cooperative Platform</p>
        </div>

        {/* Status / Error Toast */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-sm font-medium">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm font-medium">
            {statusMsg}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="block font-label-sm text-on-surface-variant">
                Enter Mobile Number (with country code)
              </label>
              <div className="flex rounded-lg shadow-sm border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden">
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919999999999"
                  required
                  disabled={authLoading}
                  className="w-full bg-transparent border-0 px-4 py-3 text-body-md text-on-surface focus:ring-0 h-touch-target"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading || !phoneNumber}
              className="w-full h-touch-target bg-primary text-on-primary font-label-lg rounded-xl shadow-md hover:bg-primary-container transition-all active:scale-95 duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                'Send OTP via SMS'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="otp" className="block font-label-sm text-on-surface-variant">
                Enter Verification Code (OTP)
              </label>
              <div className="flex rounded-lg shadow-sm border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden">
                <input
                  type="text"
                  id="otp"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  required
                  disabled={authLoading}
                  className="w-full bg-transparent border-0 px-4 py-3 text-body-md text-on-surface focus:ring-0 h-touch-target text-center tracking-widest font-mono text-lg"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                disabled={authLoading}
                className="flex-1 h-touch-target border border-outline text-outline font-label-lg rounded-xl hover:bg-surface-container transition-all active:scale-95 duration-200 cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={authLoading || !otpCode}
                className="flex-1 h-touch-target bg-primary text-on-primary font-label-lg rounded-xl shadow-md hover:bg-primary-container transition-all active:scale-95 duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  'Verify & Log In'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Demo Fast Login Switcher (visible for easy hackathon validation) */}
        <div className="border-t border-outline-variant pt-6 space-y-4">
          <div className="text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
              Demo Test Accounts (One-Tap Bypass)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => quickLogin('+919999999999')}
              disabled={authLoading}
              className="w-full text-left py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold flex justify-between items-center transition-colors cursor-pointer"
            >
              <span>Amit Patel (Admin)</span>
              <span className="font-mono bg-emerald-800 text-white px-2 py-0.5 rounded text-[10px]">+919999999999</span>
            </button>
            <button
              onClick={() => quickLogin('+918888888888')}
              disabled={authLoading}
              className="w-full text-left py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-200 text-xs font-semibold flex justify-between items-center transition-colors cursor-pointer"
            >
              <span>Ramesh Vankar (Weaver)</span>
              <span className="font-mono bg-amber-800 text-white px-2 py-0.5 rounded text-[10px]">+918888888888</span>
            </button>
            <button
              onClick={() => quickLogin('+917777777777')}
              disabled={authLoading}
              className="w-full text-left py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl border border-blue-200 text-xs font-semibold flex justify-between items-center transition-colors cursor-pointer"
            >
              <span>Meera Devi (Treasurer)</span>
              <span className="font-mono bg-blue-800 text-white px-2 py-0.5 rounded text-[10px]">+917777777777</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Dev panel switcher */}
      <DevBar />
    </main>
  );
}
