import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Synaps — Personal Media Cloud',
  description: 'A beautiful personal media cloud for your NAS. Browse, stream, and sync your media effortlessly.',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  themeColor: '#0a0a0b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-white dark:bg-[#0a0a0b] text-gray-900 dark:text-gray-100 min-h-screen antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

// Client component wrapper for sidebar + viewer
import { AppShell } from '@/components/AppShell';
