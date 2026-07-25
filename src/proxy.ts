import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'hi'],
  defaultLocale: 'en'
});

export function proxy(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(hi|en)/:path*']
};
