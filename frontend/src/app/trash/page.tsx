'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { getTrash, restoreFromTrash, permanentDelete } from '@/lib/api';
import { Trash2, RotateCcw, AlertTriangle, Clock } from 'lucide-react';

export default function TrashPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const data = await getTrash();
      setItems(data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrash(); }, []);

  const handleRestore = async (id: string) => {
    await restoreFromTrash(id);
    fetchTrash();
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('Permanently delete this file? This cannot be undone.')) return;
    await permanentDelete(id);
    fetchTrash();
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Trash" subtitle="Files are auto-deleted after 30 days" />

      <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-synaps-500/20 border-t-synaps-500 animate-spin" />
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl
                  bg-gray-50 dark:bg-white/[0.03]
                  border border-gray-100 dark:border-white/[0.04]"
              >
                {item.thumbnail_url ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 border border-gray-200 dark:border-white/[0.05]">
                    <img
                      src={item.thumbnail_url}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-red-400/70" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.filename}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={10} className="text-gray-400" />
                    <span className="text-[10px] text-gray-400">
                      {item.days_remaining} days remaining
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleRestore(item.id)}
                    className="p-2 rounded-xl hover:bg-green-500/10 transition-colors group"
                    title="Restore"
                  >
                    <RotateCcw size={14} className="text-gray-400 group-hover:text-green-500" />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item.id)}
                    className="p-2 rounded-xl hover:bg-red-500/10 transition-colors group"
                    title="Delete permanently"
                  >
                    <Trash2 size={14} className="text-gray-400 group-hover:text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Trash2 size={24} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Trash is empty</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Deleted files will appear here</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
