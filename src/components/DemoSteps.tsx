"use client";

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

export const DemoSteps: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, demoLogin } = useAuth();
  const [loading, setLoading] = useState(false);

  // Parse path to match route localization
  const pathParts = pathname.split('/');
  const locale = pathParts[1] || 'en';

  const isScreen1 = pathParts.includes('orders') && pathParts.length === 4 && !pathParts.includes('share') && !pathParts.includes('consensus') && !pathParts.includes('allocate');
  const isScreen2 = pathParts.includes('share');
  const isScreen3 = pathParts.includes('chat');
  const isScreen4 = pathParts.includes('consensus');
  const isScreen5 = pathParts.includes('allocate');
  const isScreen6 = pathParts.includes('production');
  const isScreen7 = pathParts.includes('payments');
  const isScreen8 = pathParts.includes('federation');

  let currentStep = 0;
  let title = '';
  let description = '';
  let activeRole = '';
  let nextActionLabel = '';

  const orderIdIdx = pathParts.indexOf('orders');
  const prodIdIdx = pathParts.indexOf('production');
  const payIdIdx = pathParts.indexOf('payments');
  let orderId = 'order-8922';

  if (orderIdIdx !== -1 && pathParts[orderIdIdx + 1]) {
    orderId = pathParts[orderIdIdx + 1];
  } else if (prodIdIdx !== -1 && pathParts[prodIdIdx + 1]) {
    orderId = pathParts[prodIdIdx + 1];
  } else if (payIdIdx !== -1 && pathParts[payIdIdx + 1]) {
    orderId = pathParts[payIdIdx + 1];
  }

  if (isScreen1) {
    currentStep = 1;
    title = "Step 1 of 7: Review Order Request";
    description = "Amit Patel (Admin) reviews a new silk contract. Tap 'Discuss with Members' or use voice control to initiate voting.";
    activeRole = "Amit Patel (Admin)";
    nextActionLabel = "Discuss with Members";
  } else if (isScreen2) {
    currentStep = 2;
    title = "Step 2 of 7: Dispatch Summary";
    description = "Admin shares the summarized contract terms. Click 'Send to Group Chat' to post to the cooperative chat logs.";
    activeRole = "Amit Patel (Admin)";
    nextActionLabel = "Send to Chat";
  } else if (isScreen3) {
    currentStep = 3;
    title = "Step 3 of 7: Weaver Consensus Chat";
    description = "Weaver Ramesh Vankar reviews the parameters. Tap 'I Agree' or 'Raise Concern' inside the chat header to cast a vote.";
    activeRole = "Ramesh Vankar (Weaver)";
    nextActionLabel = "Check Consensus";
  } else if (isScreen4) {
    currentStep = 4;
    title = "Step 4 of 7: Check Consensus Report";
    description = "Admin reviews voting breakdown on the SVG Donut chart and clicks 'Confirm Order' to seal the contract.";
    activeRole = "Amit Patel (Admin)";
    nextActionLabel = "Go to Allocation";
  } else if (isScreen5) {
    currentStep = 5;
    title = "Step 5 of 7: Proportional Allocation";
    description = "Admin divides units. Tap 'Apply All' to split by capacity, then click 'Finalize Allocation & Notify'.";
    activeRole = "Amit Patel (Admin)";
    nextActionLabel = "Track Production";
  } else if (isScreen6) {
    currentStep = 6;
    title = "Step 6 of 7: Production Sliders";
    description = "Weaver Ramesh slides progress meters or registers voice logs. Admin views late warning alerts.";
    activeRole = "Ramesh Vankar (Weaver)";
    nextActionLabel = "Disburse Payments";
  } else if (isScreen7) {
    currentStep = 7;
    title = "Step 7 of 7: Wage Ledger";
    description = "Meera Devi (Treasurer) pays the salary. Click 'Mark All Paid' to settle wages directly in bank records.";
    activeRole = "Meera Devi (Treasurer)";
    nextActionLabel = "View Federation Map";
  } else if (isScreen8) {
    currentStep = 8;
    title = "Completed!";
    description = "Cooperative metrics benchmarking. Click Coordinate Map markers to pool yarn purchases.";
    activeRole = "Amit Patel (Admin)";
    nextActionLabel = "Restart Demo";
  } else {
    return null;
  }

  const handleNextStep = async () => {
    setLoading(true);
    try {
      if (currentStep === 1) {
        router.push(`/${locale}/orders/${orderId}/share`);
      } else if (currentStep === 2) {
        router.push(`/${locale}/chat/coop-kanchipuram?orderId=${orderId}`);
      } else if (currentStep === 3) {
        // Auto-switch to Admin and go to Screen 4
        await auth.signOut();
        await demoLogin('admin');
        router.push(`/${locale}/orders/${orderId}/consensus`);
      } else if (currentStep === 4) {
        await updateDoc(doc(db, 'orders', orderId), { status: 'confirmed' });
        router.push(`/${locale}/orders/${orderId}/allocate`);
      } else if (currentStep === 5) {
        // Auto-switch to Weaver and go to Screen 6
        await auth.signOut();
        await demoLogin('weaver');
        router.push(`/${locale}/production/${orderId}`);
      } else if (currentStep === 6) {
        // Auto-switch to Treasurer and go to Screen 7
        await auth.signOut();
        await demoLogin('treasurer');
        router.push(`/${locale}/payments/${orderId}`);
      } else if (currentStep === 7) {
        // Auto-switch to Admin and go to Screen 8 (Federation)
        await auth.signOut();
        await demoLogin('admin');
        router.push(`/${locale}/federation`);
      } else if (currentStep === 8) {
        // Restart back to Screen 1
        await auth.signOut();
        await demoLogin('admin');
        router.push(`/${locale}/orders/order-8922`);
      }
    } catch (e) {
      console.error("Demo progression error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border-b border-indigo-950 text-slate-100 py-3 px-gutter relative z-40 animate-in slide-in-from-top duration-300 shadow-md font-sans">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-primary text-on-primary px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {title}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Evaluator Persona: <strong className="text-indigo-400 font-semibold">{activeRole}</strong>
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-normal">{description}</p>
        </div>

        <button 
          onClick={handleNextStep}
          disabled={loading}
          className="flex-shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow active:scale-95 disabled:opacity-50 cursor-pointer w-full md:w-auto justify-center"
        >
          {loading ? (
            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          ) : (
            <>
              <span>{nextActionLabel}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </>
          )}
        </button>
      </div>
      <div id="demo-recaptcha-helper" className="hidden"></div>
    </div>
  );
};
