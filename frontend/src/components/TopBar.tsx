'use client';

import { useAppStore } from '@/lib/store';
import { Menu, Search } from 'lucide-react';
import Link from 'next/link';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { toggleSidebar } = useAppStore();

  return (
    <header className="sticky top-0 z-20 px-4 lg:px-6 py-4
      bg-white/70 dark:bg-[#0a0a0b]/70
      backdrop-blur-2xl border-b border-black/[0.04] dark:border-white/[0.04]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        <Link
          href="/search"
          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Search size={20} className="text-gray-600 dark:text-gray-400" />
        </Link>
      </div>
    </header>
  );
}
