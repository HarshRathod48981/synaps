'use client';

import { Sidebar } from '@/components/Sidebar';
import { MediaViewer } from '@/components/MediaViewer';
import { useAppStore } from '@/lib/store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useAppStore();

  return (
    <>
      <Sidebar />
      <MediaViewer />
      <main
        className={`min-h-screen transition-all duration-300 ease-out
          ${sidebarOpen ? 'lg:ml-[260px]' : ''}`}
      >
        {children}
      </main>
    </>
  );
}
