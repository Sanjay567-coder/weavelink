'use client';

import React from 'react';

export default function OfflineFallbackPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f5] items-center justify-center p-8 text-center font-sans">
      <div className="w-20 h-20 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <span className="material-symbols-outlined text-[#9b2f00] text-4xl">wifi_off</span>
      </div>
      
      <h1 className="text-2xl font-bold text-on-surface mb-2 font-serif text-[#432a21]">
        Running Offline
      </h1>
      
      <p className="text-sm text-on-surface-variant max-w-sm mb-8 leading-relaxed">
        WeaveLink is running in offline mode. Previously viewed orders, chat conversations, progress reports, and ledger splits are fully accessible.
      </p>

      <div className="bg-white border border-outline-variant/30 p-4 rounded-xl max-w-xs w-full text-left mb-8 shadow-sm space-y-2 text-xs text-on-surface-variant">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">check_circle</span>
          <span>View previously cached orders & reports</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">check_circle</span>
          <span>Draft responses & log loom progress</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600 text-base shrink-0">sync</span>
          <span>Writes will automatically sync when online</span>
        </div>
      </div>
      
      <button 
        onClick={() => window.location.reload()}
        className="px-6 py-2.5 bg-[#9b2f00] text-white rounded-xl font-bold text-xs shadow-md active:scale-95 duration-100 hover:bg-[#802600] transition-colors cursor-pointer"
      >
        Retry Connection
      </button>
    </div>
  );
}