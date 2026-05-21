'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { MediaGrid } from '@/components/MediaGrid';
import { useAppStore } from '@/lib/store';
import { getTimeline, getMediaStats } from '@/lib/api';
import { ChevronRight } from 'lucide-react';

interface TimelineGroup {
  year: number;
  month: number;
  month_name: string;
  items: any[];
}

export default function TimelinePage() {
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { activeFilter } = useAppStore();
  const observerRef = useRef<HTMLDivElement>(null);
  // Track loaded item IDs globally to prevent duplicates
  const loadedIdsRef = useRef<Set<string>>(new Set());

  const fetchPage = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: any = { page: pageNum, per_page: 80 };
      if (activeFilter) params.media_type = activeFilter;

      const data = await getTimeline(params);

      if (reset) {
        // Fresh load — replace all data
        loadedIdsRef.current = new Set();
        const newGroups: TimelineGroup[] = [];
        for (const group of data.groups) {
          const dedupedItems = group.items.filter((item: any) => {
            if (loadedIdsRef.current.has(item.id)) return false;
            loadedIdsRef.current.add(item.id);
            return true;
          });
          if (dedupedItems.length > 0) {
            newGroups.push({ ...group, items: dedupedItems });
          }
        }
        setGroups(newGroups);
      } else {
        // Append — merge into existing groups, dedup by ID
        setGroups(prev => {
          const merged = prev.map(g => ({ ...g, items: [...g.items] }));
          for (const group of data.groups) {
            const key = `${group.year}-${group.month}`;
            const existing = merged.find(g => `${g.year}-${g.month}` === key);
            const newItems = group.items.filter((item: any) => {
              if (loadedIdsRef.current.has(item.id)) return false;
              loadedIdsRef.current.add(item.id);
              return true;
            });
            if (existing) {
              existing.items.push(...newItems);
            } else if (newItems.length > 0) {
              merged.push({ ...group, items: newItems });
            }
          }
          // Sort groups descending by date
          merged.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
          });
          return merged;
        });
      }

      setHasMore(pageNum < data.total_pages);
    } catch (error) {
      console.error('Failed to fetch timeline:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeFilter]);

  // Reset when filter changes
  useEffect(() => {
    setPage(1);
    setGroups([]);
    setHasMore(true);
    fetchPage(1, true);
  }, [activeFilter]); // intentionally exclude fetchPage to avoid loops

  useEffect(() => {
    getMediaStats().then(setStats).catch(console.error);
  }, []);

  // Infinite scroll with debounce guard
  useEffect(() => {
    if (!observerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(prev => {
            const next = prev + 1;
            fetchPage(next);
            return next;
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchPage]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filterLabel = activeFilter
    ? activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1) + 's'
    : 'All Media';

  return (
    <div className="min-h-screen">
      <TopBar
        title="Timeline"
        subtitle={stats ? `${stats.total_files.toLocaleString()} items · ${stats.total_size_human}` : undefined}
      />

      <div className="px-4 lg:px-6 pb-8">
        {/* Filter badge */}
        {activeFilter && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 mb-2"
          >
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium
              bg-synaps-500/10 text-synaps-600 dark:text-synaps-400 border border-synaps-500/20">
              Showing: {filterLabel}
            </span>
          </motion.div>
        )}

        {/* Timeline groups */}
        <div className="space-y-6 mt-4">
          {groups.map((group) => {
            const key = `${group.year}-${group.month}`;
            const collapsed = collapsedGroups.has(key);

            return (
              <section key={key}>
                {/* Sticky month header */}
                <button
                  onClick={() => toggleGroup(key)}
                  className="month-header flex items-center gap-2 group w-full text-left
                    bg-white/60 dark:bg-[#0a0a0b]/60 backdrop-blur-xl"
                >
                  <motion.div
                    animate={{ rotate: collapsed ? 0 : 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight size={14} className="text-gray-400" />
                  </motion.div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {group.month_name} {group.year}
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {group.items.length} items
                  </span>
                </button>

                {/* Media grid — simply show/hide, no animation to prevent re-render issues */}
                {!collapsed && (
                  <MediaGrid items={group.items} />
                )}
              </section>
            );
          })}
        </div>

        {/* Loading indicator */}
        {(loading || loadingMore) && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-2 border-synaps-500/20 border-t-synaps-500 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && groups.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-synaps-500/20 to-synaps-700/20 flex items-center justify-center mb-5">
              <span className="text-3xl">📸</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              No media yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs text-center">
              Your timeline will populate once the scanner indexes your NAS files.
            </p>
          </motion.div>
        )}

        {/* Infinite scroll trigger */}
        <div ref={observerRef} className="h-4" />
      </div>
    </div>
  );
}
