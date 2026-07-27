"use client";

import React from 'react';

interface BrandedLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export const BrandedLoader: React.FC<BrandedLoaderProps> = ({ message = "Weaving threads...", fullScreen = false }) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 gap-4 animate-in fade-in duration-300 text-center">
      <div className="relative">
        <svg width="160" height="60" viewBox="0 0 160 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
          {/* Warp threads (horizontal loom lines) */}
          <line x1="10" y1="15" x2="150" y2="15" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
          <line x1="5" y1="30" x2="155" y2="30" stroke="currentColor" strokeWidth="2" opacity="0.4" />
          <line x1="10" y1="45" x2="150" y2="45" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />

          {/* Vertical warp cross hairs */}
          <line x1="30" y1="10" x2="30" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.1" />
          <line x1="60" y1="10" x2="60" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.1" />
          <line x1="90" y1="10" x2="90" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.1" />
          <line x1="120" y1="10" x2="120" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.1" />

          {/* Shuttle boat translation */}
          <g>
            {/* Shuttle body (curved boat shape) */}
            <path d="M 0 6 C 5 2, 25 2, 30 6 C 25 10, 5 10, 0 6 Z" fill="currentColor">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="10,24; 120,24; 120,24; 10,24; 10,24"
                keyTimes="0; 0.45; 0.5; 0.95; 1"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </path>
            
            {/* Bobbin center circle */}
            <circle cx="15" cy="6" r="2" fill="#faf9f5">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="10,24; 120,24; 120,24; 10,24; 10,24"
                keyTimes="0; 0.45; 0.5; 0.95; 1"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </svg>
      </div>
      <p className="font-label-sm text-primary animate-pulse tracking-widest uppercase text-[11px] font-bold">
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        {content}
      </div>
    );
  }

  return content;
};
