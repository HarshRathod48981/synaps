'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  
  // State for collapsible hierarchies
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [hasInitializedState, setHasInitializedState] = useState(false);
  
  const { activeFilter, deletedMediaIds } = useAppStore();
  const observerRef = useRef<HTMLDivElement>(null);

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
        setGroups(data.groups);
      } else {
        // Append — merge into existing groups, dedup by ID safely
        setGroups(prev => {
          const merged = prev.map(g => ({ ...g, items: [...g.items] }));
          
          for (const group of data.groups) {
            const key = `${group.year}-${group.month}`;
            const existing = merged.find(g => `${g.year}-${g.month}` === key);
            
            if (existing) {
              const existingIds = new Set(existing.items.map((i: any) => i.id));
              const newItems = group.items.filter((item: any) => !existingIds.has(item.id));
              existing.items.push(...newItems);
            } else if (group.items.length > 0) {
              merged.push({ ...group });
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
    setHasInitializedState(false); // Re-initialize collapse states for new filter
    fetchPage(1, true);
  }, [activeFilter]); // intentionally exclude fetchPage to avoid loops

  useEffect(() => {
    getMediaStats().then(setStats).catch(console.error);
  }, []);

  // Transform flat month groups into year-based groups
  const yearGroups = useMemo(() => {
    const grouped = new Map<number, { year: number; months: TimelineGroup[]; totalItems: number }>();
    
    for (const group of groups) {
      if (!grouped.has(group.year)) {
        grouped.set(group.year, { year: group.year, months: [], totalItems: 0 });
      }
      const yearObj = grouped.get(group.year)!;
      yearObj.months.push(group);
      yearObj.totalItems += group.items.length;
    }
    
    return Array.from(grouped.values()).sort((a, b) => b.year - a.year);
  }, [groups]);

  // Auto-collapse logic on initial load
  useEffect(() => {
    if (yearGroups.length > 0 && !hasInitializedState) {
      const latestYear = yearGroups[0].year;
      // Since yearGroups are sorted descending, [0] is the most recent
      const latestMonthKey = `${yearGroups[0].months[0].year}-${yearGroups[0].months[0].month}`;
      
      const newCollapsedYears = new Set<number>();
      const newExpandedMonths = new Set<string>();
      
      for (const yg of yearGroups) {
        if (yg.year !== latestYear) {
          newCollapsedYears.add(yg.year);
        }
      }
      
      // Expand only the very first month by default
      newExpandedMonths.add(latestMonthKey);
      
      setCollapsedYears(newCollapsedYears);
      setExpandedMonths(newExpandedMonths);
      setHasInitializedState(true);
    }
  }, [yearGroups, hasInitializedState]);

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

  const toggleYear = (year: number) => {
    setCollapsedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
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

        {/* Two-Level Timeline Hierarchy */}
        <div className="space-y-8 mt-6">
          {yearGroups.map((yearGroup) => {
            const yearCollapsed = collapsedYears.has(yearGroup.year);

            return (
              <div key={yearGroup.year} className="space-y-4">
                {/* Year Header */}
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={() => toggleYear(yearGroup.year)}
                    className="flex items-center gap-2 group text-left shrink-0 focus:outline-none"
                  >
                    <motion.div
                      animate={{ rotate: yearCollapsed ? 0 : 90 }}
                      transition={{ duration: 0.2 }}
                      className="bg-gray-100 dark:bg-white/[0.05] rounded-full p-1 group-hover:bg-gray-200 dark:group-hover:bg-white/[0.1] transition-colors"
                    >
                      <ChevronRight size={16} className="text-gray-500 dark:text-gray-400" />
                    </motion.div>
                    <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                      {yearGroup.year === 0 ? "Old Photos" : yearGroup.year}
                    </h1>
                  </button>
                  <div className="h-px bg-gray-200 dark:bg-white/10 flex-1 ml-2" />
                  <span className="text-xs font-medium text-gray-400 shrink-0">
                    {yearGroup.totalItems.toLocaleString()} items
                  </span>
                </div>

                {/* Months Loop */}
                {!yearCollapsed && (
                  <div className="pl-3 lg:pl-6 space-y-6">
                    {yearGroup.months.map((group) => {
                      const key = `${group.year}-${group.month}`;
                      const monthExpanded = expandedMonths.has(key);

                      return (
                        <section key={key} style={{ contentVisibility: 'auto' }}>
                          {/* Sticky month header */}
                          <button
                            onClick={() => toggleMonth(key)}
                            className="month-header flex items-center gap-2 group w-full text-left
                              bg-white/60 dark:bg-[#0a0a0b]/60 backdrop-blur-xl py-2 focus:outline-none"
                          >
                            <motion.div
                              animate={{ rotate: monthExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight size={14} className="text-gray-400 group-hover:text-synaps-500 transition-colors" />
                            </motion.div>
                            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                              {yearGroup.year === 0 ? "Archive" : `${group.month_name} ${group.year}`}
                            </h2>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {group.items.length} items
                            </span>
                          </button>

                          {/* Media grid */}
                          {monthExpanded && (
                            <div className="pt-2">
                              <MediaGrid items={group.items.filter((item: any) => !deletedMediaIds.has(item.id))} />
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
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
