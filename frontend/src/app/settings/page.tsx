'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { getSettings, updateSettings, getStorageUsage, triggerScan } from '@/lib/api';
import {
  HardDrive, Image, Film, FileText, Trash2,
  RefreshCw, Moon, Sun, Monitor, FolderSearch, Loader2
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({});
  const [usage, setUsage] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
    getStorageUsage().then(setUsage).catch(console.error);
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await triggerScan();
      // Re-fetch usage after a delay
      setTimeout(() => {
        getStorageUsage().then(setUsage).catch(console.error);
        setScanning(false);
      }, 3000);
    } catch (err) {
      setScanning(false);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setThemeState(newTheme);
    document.documentElement.classList.remove('light', 'dark');
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.classList.add(newTheme);
    }
    updateSettings({ theme: newTheme });
  };

  const themes = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="min-h-screen">
      <TopBar title="Settings" />

      <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto space-y-6">
        {/* Storage Usage */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6
            bg-gray-50 dark:bg-white/[0.03]
            border border-gray-100 dark:border-white/[0.04]"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <HardDrive size={16} className="text-synaps-500" />
            Storage Overview
          </h2>

          {usage ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Files', value: usage.total_files?.toLocaleString(), icon: HardDrive, color: 'text-synaps-500' },
                { label: 'Photos', value: usage.images?.toLocaleString(), icon: Image, color: 'text-blue-500' },
                { label: 'Videos', value: usage.videos?.toLocaleString(), icon: Film, color: 'text-purple-500' },
                { label: 'Documents', value: usage.documents?.toLocaleString(), icon: FileText, color: 'text-amber-500' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 rounded-2xl bg-white dark:bg-white/[0.03]">
                  <stat.icon size={20} className={`${stat.color} mx-auto mb-2`} />
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{stat.value}</div>
                  <div className="text-[10px] text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-synaps-500/20 border-t-synaps-500 animate-spin" />
            </div>
          )}

          {usage && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-2 rounded-xl bg-white dark:bg-white/[0.03]">
                <div className="font-medium text-gray-900 dark:text-white">{usage.total_indexed_human}</div>
                <div className="text-gray-400">Indexed</div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-white/[0.03]">
                <div className="font-medium text-gray-900 dark:text-white">{usage.thumbnail_cache_human}</div>
                <div className="text-gray-400">Thumbnails</div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-white/[0.03]">
                <div className="font-medium text-gray-900 dark:text-white">{usage.trash_size_human}</div>
                <div className="text-gray-400">Trash</div>
              </div>
            </div>
          )}
        </motion.section>

        {/* Theme */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl p-6
            bg-gray-50 dark:bg-white/[0.03]
            border border-gray-100 dark:border-white/[0.04]"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Appearance
          </h2>
          <div className="flex gap-3">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => handleThemeChange(t.key)}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200
                    ${isActive
                      ? 'bg-synaps-500/10 border-synaps-500/30 text-synaps-600 dark:text-synaps-400'
                      : 'bg-white dark:bg-white/[0.03] border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                    } border`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Scan */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl p-6
            bg-gray-50 dark:bg-white/[0.03]
            border border-gray-100 dark:border-white/[0.04]"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <FolderSearch size={16} className="text-synaps-500" />
            Media Scanner
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Rescan your NAS to index new files and generate thumbnails.
          </p>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              bg-synaps-500 text-white hover:bg-synaps-600
              disabled:opacity-50 transition-all duration-200
              shadow-lg shadow-synaps-500/20"
          >
            {scanning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Rescan Now
              </>
            )}
          </button>
        </motion.section>

        {/* Paths */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl p-6
            bg-gray-50 dark:bg-white/[0.03]
            border border-gray-100 dark:border-white/[0.04]"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Configuration
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Storage Path', value: settings.storage_path },
              { label: 'Thumbnail Cache', value: settings.thumbnail_dir },
              { label: 'Trash Directory', value: settings.trash_dir },
            ].map((item) => (
              <div key={item.label}>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{item.label}</label>
                <div className="px-3 py-2 rounded-xl bg-white dark:bg-white/[0.03] text-xs text-gray-700 dark:text-gray-300 font-mono border border-gray-100 dark:border-white/[0.04]">
                  {item.value || 'Not set'}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* About */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center py-8"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-synaps-500 to-synaps-700 flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg font-bold">S</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Synaps v1.0</h3>
          <p className="text-xs text-gray-500 mt-1">Personal NAS Media Cloud</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Local Network Only</p>
        </motion.section>
      </div>
    </div>
  );
}
