'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import {
  Clock, Folder, Upload, Search, Trash2, Settings, X,
  Image, Film, FileText, Camera, Monitor, Star, HardDrive
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Timeline', icon: Clock },
  { href: '/finder', label: 'Finder', icon: Folder },
  { href: '/sync', label: 'Sync', icon: Upload },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/trash', label: 'Trash', icon: Trash2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const filters = [
  { key: null, label: 'All Media', icon: HardDrive },
  { key: 'image', label: 'Photos', icon: Image },
  { key: 'video', label: 'Videos', icon: Film },
  { key: 'document', label: 'Documents', icon: FileText },
  { key: 'screenshot', label: 'Screenshots', icon: Monitor },
  { key: 'favorite', label: 'Favorites', icon: Star },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, activeFilter, setFilter } = useAppStore();

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-[260px] z-50 lg:z-30
              bg-white/80 dark:bg-[#1a1a1d]/90
              backdrop-blur-2xl border-r border-black/[0.06] dark:border-white/[0.06]
              flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-synaps-500 to-synaps-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">S</span>
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-white">
                  Synaps
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="px-3 space-y-0.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (window.innerWidth < 1024) setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-synaps-500/10 text-synaps-600 dark:text-synaps-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                      }`}
                  >
                    <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Divider */}
            <div className="mx-5 my-4 h-px bg-black/[0.06] dark:bg-white/[0.06]" />

            {/* Filters */}
            <div className="px-5 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Library
              </span>
            </div>
            <nav className="px-3 space-y-0.5 flex-1 overflow-y-auto">
              {filters.map((f) => {
                const isActive = activeFilter === f.key;
                const Icon = f.icon;
                return (
                  <button
                    key={f.key ?? 'all'}
                    onClick={() => setFilter(f.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-synaps-500/10 text-synaps-600 dark:text-synaps-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                      }`}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                    {f.label}
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div className="text-[11px] text-gray-400 dark:text-gray-500">
                Synaps v1.0 · Local Network
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
