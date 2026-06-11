'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { getStorageUsage } from '@/lib/api';
import {
  Clock, LayoutGrid, Folder, Search, Upload, Trash2, Settings, X,
  Smartphone, Monitor, Laptop, Star, Camera, FolderInput, MapPin
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Library', icon: LayoutGrid },
  { href: '/', label: 'Timeline', icon: Clock, viewFilter: 'timeline' as const },
  { href: '/', label: 'Gallery', icon: LayoutGrid, viewFilter: 'gallery' as const },
  { href: '/finder', label: 'Finder', icon: Folder },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/sync', label: 'Sync', icon: Upload },
  { href: '/trash', label: 'Trash', icon: Trash2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const sourceItems = [
  { key: 'iphone', label: 'iPhone', icon: Smartphone },
  { key: 'mac', label: 'Mac', icon: Laptop },
  { key: 'windows', label: 'Windows', icon: Monitor },
];

const shortcutItems = [
  { key: 'favorite', label: 'Favorites', icon: Star },
  { key: 'screenshot', label: 'Screenshots', icon: Camera },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarOpen, setSidebarOpen,
    activeFilter, setFilter,
    activeSources, toggleSource,
    activeView, setActiveView,
  } = useAppStore();

  const [storageData, setStorageData] = useState<any>(null);

  useEffect(() => {
    getStorageUsage()
      .then(setStorageData)
      .catch(() => {});
  }, []);

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.viewFilter) {
      setActiveView(item.viewFilter);
      setFilter(null);
    }
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleFilterClick = (key: string | null) => {
    setFilter(activeFilter === key ? null : key);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleSourceClick = (key: string) => {
    toggleSource(key);
  };

  const isNavActive = (item: typeof navItems[0]) => {
    if (item.viewFilter) {
      return pathname === '/' && activeView === item.viewFilter;
    }
    if (item.href === '/' && item.label === 'Library') {
      return pathname === '/' && !navItems.some(n => n.viewFilter && activeView === n.viewFilter);
    }
    return pathname === item.href && !item.viewFilter;
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] z-50 lg:z-30
              glass-panel-sidebar flex flex-col overflow-hidden"
          >
            {/* ── App Header ── */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] flex items-center justify-center shadow-lg shadow-[var(--accent-glow)]">
                  <span className="text-white text-sm font-bold">S</span>
                </div>
                <div>
                  <div className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                    Synaps
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] -mt-0.5">
                    Personal Media Cloud
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-colors"
              >
                <X size={16} className="text-[var(--text-tertiary)]" />
              </button>
            </div>

            {/* ── Navigation ── */}
            <nav className="px-2.5 mt-2 space-y-0.5">
              {navItems.map((item) => {
                const active = isNavActive(item);
                const Icon = item.icon;

                // Skip Library entry — Timeline & Gallery replace it
                if (item.label === 'Library') return null;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={(e) => {
                      if (item.viewFilter) {
                        e.preventDefault();
                        handleNavClick(item);
                      } else {
                        handleNavClick(item);
                      }
                    }}
                    className={`nav-item ${active ? 'nav-item-active' : ''}`}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* ── Sources ── */}
            <div className="mt-5 mb-1">
              <div className="section-label">Sources</div>
            </div>
            <nav className="px-2.5 space-y-0.5">
              {sourceItems.map((item) => {
                const active = activeSources.has(item.key);
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleSourceClick(item.key)}
                    className={`nav-item w-full ${active ? 'nav-item-active' : ''}`}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* ── Shortcuts ── */}
            <div className="mt-5 mb-1">
              <div className="section-label">Shortcuts</div>
            </div>
            <nav className="px-2.5 space-y-0.5 flex-1 overflow-y-auto no-scrollbar">
              {shortcutItems.map((item) => {
                const active = activeFilter === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleFilterClick(item.key)}
                    className={`nav-item w-full ${active ? 'nav-item-active' : ''}`}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* ── Storage Indicator ── */}
            <div className="px-4 py-4 border-t border-[var(--glass-border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  Storage
                </span>
                {storageData && (
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {storageData.total_indexed_human} indexed
                  </span>
                )}
              </div>
              <div className="storage-bar">
                <div
                  className="storage-bar-fill"
                  style={{
                    width: storageData
                      ? `${Math.min((storageData.total_files / Math.max(storageData.total_files * 2, 1)) * 100, 50)}%`
                      : '0%'
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {storageData
                    ? `${storageData.total_files?.toLocaleString()} files`
                    : '—'
                  }
                </span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
