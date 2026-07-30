import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AuthProvider } from '../../context/AuthContext';
import { DemoSteps } from "@/components/DemoSteps";
import { RouteGuard } from "@/components/RouteGuard";
import "../globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "WeaveLink",
  description: "Digital Craftsmanship Cooperative platform for handloom weavers",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WeaveLink",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9f5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params;
  // Fetch translation messages
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${ibmPlexSans.variable} h-full antialiased`}>
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-surface">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            <RouteGuard>
              <DemoSteps />
              {children}
            </RouteGuard>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
