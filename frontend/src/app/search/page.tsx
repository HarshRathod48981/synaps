'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { searchMedia, getSearchSuggestions, getThumbnailUrl } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import {
  Search as SearchIcon, X, Image, Film, FileText,
  Clock, ArrowRight
} from 'lucide-react';

const quickFilters = [
  { key: null, label: 'All', icon: SearchIcon },
  { key: 'image', label: 'Photos', icon: Image },
  { key: 'video', label: 'Videos', icon: Film },
  { key: 'document', label: 'Docs', icon: FileText },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<{ files: string[]; directories: string[] }>({ files: [], directories: [] });
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openViewer } = useAppStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setSuggestions({ files: [], directories: [] });
      return;
    }
    const timer = setTimeout(() => {
      getSearchSuggestions(query).then(setSuggestions).catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setShowSuggestions(false);
    try {
      const data = await searchMedia(q, filter || undefined);
      setResults(data.results);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Search" />

      <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
        {/* Search bar */}
        <div className="relative mb-6">
          <div className="relative flex items-center">
            <SearchIcon size={18} className="absolute left-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search files, folders, media..."
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm
                bg-gray-100 dark:bg-white/[0.06]
                border border-transparent focus:border-synaps-500/30
                text-gray-900 dark:text-white placeholder:text-gray-400
                outline-none transition-all duration-200"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setShowSuggestions(false); }}
                className="absolute right-4 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && (suggestions.files.length > 0 || suggestions.directories.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-30
                  bg-white dark:bg-[#1c1c1f] border border-gray-200 dark:border-white/[0.08]
                  shadow-xl"
              >
                {suggestions.directories.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => { setQuery(dir); handleSearch(dir); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm
                      hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <SearchIcon size={14} className="text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300 truncate">{dir}</span>
                    <ArrowRight size={12} className="text-gray-400 ml-auto" />
                  </button>
                ))}
                {suggestions.files.map((file) => (
                  <button
                    key={file}
                    onClick={() => { setQuery(file); handleSearch(file); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm
                      hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300 truncate">{file}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick filters */}
        <div className="flex gap-2 mb-6">
          {quickFilters.map((f) => {
            const Icon = f.icon;
            const isActive = filter === f.key;
            return (
              <button
                key={f.key ?? 'all'}
                onClick={() => { setFilter(f.key); if (query) handleSearch(); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-synaps-500 text-white shadow-lg shadow-synaps-500/20'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                  }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-synaps-500/20 border-t-synaps-500 animate-spin" />
          </div>
        ) : results.length > 0 ? (
          <div>
            <p className="text-xs text-gray-500 mb-3">{total} results found</p>
            <div className="space-y-1">
              {results.map((item) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => openViewer(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                    hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                    <img
                      src={getThumbnailUrl(item.id)}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.filename}</p>
                    <p className="text-[10px] text-gray-400 truncate">{item.directory}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 uppercase shrink-0">
                    {item.extension.replace('.', '')}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : query && !loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <SearchIcon size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">No results for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <SearchIcon size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">Search your media library</p>
            <p className="text-xs text-gray-400 mt-1">Search by filename, folder, or extension</p>
          </div>
        )}
      </div>
    </div>
  );
}
