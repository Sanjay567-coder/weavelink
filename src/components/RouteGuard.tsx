"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { BrandedLoader } from './BrandedLoader';

interface RouteGuardProps {
  children: React.ReactNode;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, memberProfile, loading } = useAuth();

  const locale = pathname.split('/')[1] || 'en';
  const rawPath = pathname.replace(`/${locale}`, ''); // e.g., '/orders/new'

  useEffect(() => {
    if (loading) return;

    // 1. Unauthenticated handling
    if (!user) {
      // Allow only the login page (empty rawPath or '/') and the public confirm page
      const isLoginPath = rawPath === '' || rawPath === '/';
      const isConfirmPath = rawPath.startsWith('/confirm/');
      
      if (!isLoginPath && !isConfirmPath) {
        console.warn(`Unauthenticated access to protected route: ${rawPath}. Redirecting to login.`);
        router.push(`/${locale}`);
      }
      return;
    }

    // 2. Authenticated handling
    if (user && memberProfile) {
      const role = memberProfile.role;

      // If user is logged in but tries to visit the login page, redirect to home dashboard
      if (rawPath === '' || rawPath === '/') {
        router.push(`/${locale}/home`);
        return;
      }

      // Check Admin-only routes
      const isAdminRoute = 
        rawPath.startsWith('/orders/new') ||
        rawPath.startsWith('/federation') ||
        (rawPath.startsWith('/orders/') && (
          rawPath.endsWith('/share') ||
          rawPath.endsWith('/consensus') ||
          rawPath.endsWith('/allocate') ||
          // Admin details screen is for Admins only
          (!rawPath.includes('/share') && !rawPath.includes('/consensus') && !rawPath.includes('/allocate') && rawPath.split('/').length === 3)
        ));

      if (isAdminRoute && role !== 'admin') {
        console.warn(`Role ${role} blocked from Admin route: ${rawPath}. Redirecting to home.`);
        router.push(`/${locale}/home`);
      }
    }
  }, [user, memberProfile, loading, rawPath, locale, router]);

  if (loading) {
    return <BrandedLoader message="Authenticating credentials..." fullScreen />;
  }

  // Hide page content during redirects to prevent flashes of protected screens
  if (!user) {
    const isLoginPath = rawPath === '' || rawPath === '/';
    const isConfirmPath = rawPath.startsWith('/confirm/');
    if (!isLoginPath && !isConfirmPath) {
      return <BrandedLoader message="Redirecting to login..." fullScreen />;
    }
  } else if (memberProfile) {
    const role = memberProfile.role;
    if (rawPath === '' || rawPath === '/') {
      return <BrandedLoader message="Loading dashboard..." fullScreen />;
    }

    const isAdminRoute = 
      rawPath.startsWith('/orders/new') ||
      rawPath.startsWith('/federation') ||
      (rawPath.startsWith('/orders/') && (
        rawPath.endsWith('/share') ||
        rawPath.endsWith('/consensus') ||
        rawPath.endsWith('/allocate') ||
        (!rawPath.includes('/share') && !rawPath.includes('/consensus') && !rawPath.includes('/allocate') && rawPath.split('/').length === 3)
      ));

    if (isAdminRoute && role !== 'admin') {
      return <BrandedLoader message="Access Denied. Redirecting..." fullScreen />;
    }
  }

  return <>{children}</>;
};
