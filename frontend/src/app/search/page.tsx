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
        {/* Search bar — glass */}
        <div className="relative mb-6">
          <div className="relative flex items-center">
            <SearchIcon size={18} className="absolute left-4 text-[var(--text-tertiary)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search files, folders, media..."
              className="glass-input pl-11 pr-10"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setShowSuggestions(false); }}
                className="absolute right-4 p-1 rounded-full hover:bg-[var(--glass-bg-hover)]"
              >
                <X size={14} className="text-[var(--text-tertiary)]" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown — glass */}
          <AnimatePresence>
            {showSuggestions && (suggestions.files.length > 0 || suggestions.directories.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-30 glass-panel-elevated"
              >
                {suggestions.directories.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => { setQuery(dir); handleSearch(dir); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm
                      hover:bg-[var(--glass-bg-hover)] transition-colors"
                  >
                    <SearchIcon size={14} className="text-[var(--text-tertiary)]" />
                    <span className="text-[var(--text-secondary)] truncate">{dir}</span>
                    <ArrowRight size={12} className="text-[var(--text-muted)] ml-auto" />
                  </button>
                ))}
                {suggestions.files.map((file) => (
                  <button
                    key={file}
                    onClick={() => { setQuery(file); handleSearch(file); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm
                      hover:bg-[var(--glass-bg-hover)] transition-colors"
                  >
                    <Clock size={14} className="text-[var(--text-tertiary)]" />
                    <span className="text-[var(--text-secondary)] truncate">{file}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick filters — glass pills */}
        <div className="flex gap-2 mb-6">
          {quickFilters.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key ?? 'all'}
                onClick={() => { setFilter(f.key); if (query) handleSearch(); }}
                className={`glass-pill ${isActive ? 'glass-pill-active' : ''}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
          </div>
        ) : results.length > 0 ? (
          <div>
            <p className="text-[11px] text-[var(--text-tertiary)] mb-3">{total} results found</p>
            <div className="space-y-1">
              {results.map((item) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => openViewer(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                    hover:bg-[var(--glass-bg-hover)] transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--glass-bg)] shrink-0 border border-[var(--glass-border)]">
                    <img
                      src={getThumbnailUrl(item.id)}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--text-primary)] truncate">{item.filename}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] truncate">{item.directory}</p>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase shrink-0 font-medium">
                    {item.extension.replace('.', '')}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : query && !loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <SearchIcon size={32} className="text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-tertiary)]">No results for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <SearchIcon size={32} className="text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">Search your media library</p>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Search by filename, folder, or extension</p>
          </div>
        )}
      </div>
    </div>
  );
}
