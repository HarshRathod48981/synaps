'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { MediaGrid } from '@/components/MediaGrid';
import { useAppStore } from '@/lib/store';
import { getMedia, getMediaStats } from '@/lib/api';
import { ChevronRight, Filter, LayoutGrid, List } from 'lucide-react';

interface TimelineGroup {
  year: number;
  month: number;
  month_name: string;
  items: any[];
}

export default function MediaBrowser() {
  // View State
  const [viewType, setViewType] = useState<'timeline' | 'gallery'>('timeline');
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  
  // Data State
  const [timelineGroups, setTimelineGroups] = useState<TimelineGroup[]>([]);
  const [galleryItems, setGalleryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState<any>(null);
  
  // Timeline Hierarchy State
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [hasInitializedState, setHasInitializedState] = useState(false);

  // Gallery Sticky Date State
  const [activeDateHeader, setActiveDateHeader] = useState<string | null>(null);
  
  const { activeFilter } = useAppStore();
  const observerRef = useRef<HTMLDivElement>(null);
  const galleryContainerRef = useRef<HTMLDivElement>(null);

  // Available Sources Configuration (can be fetched from API later)
  const availableSources = [
    { id: 'iphone', label: 'iPhone' },
    { id: 'mac', label: 'Mac' },
    { id: 'windows', label: 'Windows' }
  ];

  const fetchPage = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: any = { 
        page: pageNum, 
        per_page: viewType === 'gallery' ? 100 : 80,
        view: viewType
      };
      
      if (activeFilter) params.media_type = activeFilter;
      if (activeSources.size > 0) {
        params.sources = Array.from(activeSources).join(',');
      }

      const data = await getMedia(params);

      if (viewType === 'timeline') {
        if (reset) {
          setTimelineGroups(data.groups || []);
        } else {
          setTimelineGroups(prev => {
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
            merged.sort((a, b) => {
              if (a.year !== b.year) return b.year - a.year;
              return b.month - a.month;
            });
            return merged;
          });
        }
      } else {
        // Gallery View
        if (reset) {
          setGalleryItems(data.items || []);
        } else {
          setGalleryItems(prev => {
            const existingIds = new Set(prev.map(i => i.id));
            const newItems = (data.items || []).filter((item: any) => !existingIds.has(item.id));
            return [...prev, ...newItems];
          });
        }
      }

      setHasMore(pageNum < data.total_pages);
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeFilter, viewType, activeSources]);

  // Reset when filter, viewType, or sources change
  useEffect(() => {
    setPage(1);
    setTimelineGroups([]);
    setGalleryItems([]);
    setHasMore(true);
    setHasInitializedState(false);
    fetchPage(1, true);
  }, [activeFilter, viewType, activeSources]);

  useEffect(() => {
    getMediaStats().then(setStats).catch(console.error);
  }, []);

  // Transform flat month groups into year-based groups for Timeline
  const yearGroups = useMemo(() => {
    if (viewType !== 'timeline') return [];
    const grouped = new Map<number, { year: number; months: TimelineGroup[]; totalItems: number }>();
    
    for (const group of timelineGroups) {
      if (!grouped.has(group.year)) {
        grouped.set(group.year, { year: group.year, months: [], totalItems: 0 });
      }
      const yearObj = grouped.get(group.year)!;
      yearObj.months.push(group);
      yearObj.totalItems += group.items.length;
    }
    
    return Array.from(grouped.values()).sort((a, b) => b.year - a.year);
  }, [timelineGroups, viewType]);

  // Auto-collapse logic for Timeline
  useEffect(() => {
    if (viewType === 'timeline' && yearGroups.length > 0 && !hasInitializedState) {
      const latestYear = yearGroups[0].year;
      const latestMonthKey = `${yearGroups[0].months[0].year}-${yearGroups[0].months[0].month}`;
      
      const newCollapsedYears = new Set<number>();
      const newExpandedMonths = new Set<string>();
      
      for (const yg of yearGroups) {
        if (yg.year !== latestYear) {
          newCollapsedYears.add(yg.year);
        }
      }
      newExpandedMonths.add(latestMonthKey);
      
      setCollapsedYears(newCollapsedYears);
      setExpandedMonths(newExpandedMonths);
      setHasInitializedState(true);
    }
  }, [yearGroups, hasInitializedState, viewType]);

  // Infinite scroll
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

  // Gallery Sticky Date Observer
  useEffect(() => {
    if (viewType !== 'gallery' || galleryItems.length === 0) return;
    
    const handleScroll = () => {
      const elements = document.querySelectorAll('[data-date]');
      let activeDate = null;
      
      // Find the first element that is at or above the top of the viewport (with offset)
      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        if (rect.top <= 120) {
          activeDate = elements[i].getAttribute('data-date');
        } else {
          break; // Since they are ordered, we can stop once we find one below the threshold
        }
      }
      
      if (!activeDate && elements.length > 0) {
        // If scrolled to top, just use the first item's date
        activeDate = elements[0].getAttribute('data-date');
      }
      
      setActiveDateHeader(activeDate);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    setTimeout(handleScroll, 100);
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [viewType, galleryItems]);

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

  const toggleSource = (sourceId: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  const filterLabel = activeFilter
    ? activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1) + 's'
    : 'All Media';

  return (
    <div className="min-h-screen">
      <TopBar
        title="Library"
        subtitle={stats ? `${stats.total_files.toLocaleString()} items · ${stats.total_size_human}` : undefined}
      />

      <div className="px-4 lg:px-6 pb-8 sticky top-[72px] z-30 bg-[#0a0a0b]/80 backdrop-blur-xl py-4 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* View Toggles */}
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl w-fit">
            <button
              onClick={() => setViewType('timeline')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewType === 'timeline' 
                  ? 'bg-synaps-500 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <List size={16} /> Timeline
            </button>
            <button
              onClick={() => setViewType('gallery')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewType === 'gallery' 
                  ? 'bg-synaps-500 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutGrid size={16} /> Gallery
            </button>
          </div>

          {/* Source Filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <div className="text-gray-400 text-sm font-medium flex items-center gap-1.5 mr-2">
              <Filter size={14} /> Sources:
            </div>
            {availableSources.map(source => (
              <button
                key={source.id}
                onClick={() => toggleSource(source.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  activeSources.has(source.id)
                    ? 'bg-synaps-500/20 text-synaps-400 border-synaps-500/30'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Gallery Sticky Date Overlay */}
      <AnimatePresence>
        {viewType === 'gallery' && activeDateHeader && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-[150px] left-1/2 -translate-x-1/2 z-40"
          >
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-2xl">
              {activeDateHeader}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 lg:px-6 pb-8 mt-6">
        
        {viewType === 'timeline' ? (
          /* TIMELINE VIEW */
          <div className="space-y-8">
            {yearGroups.map((yearGroup) => {
              const yearCollapsed = collapsedYears.has(yearGroup.year);

              return (
                <div key={yearGroup.year} className="space-y-4">
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

                  {!yearCollapsed && (
                    <div className="pl-3 lg:pl-6 space-y-6">
                      {yearGroup.months.map((group) => {
                        const key = `${group.year}-${group.month}`;
                        const monthExpanded = expandedMonths.has(key);

                        return (
                          <section key={key} style={{ contentVisibility: 'auto' }}>
                            <button
                              onClick={() => toggleMonth(key)}
                              className="month-header flex items-center gap-2 group w-full text-left
                                bg-[#0a0a0b]/60 backdrop-blur-xl py-2 focus:outline-none"
                            >
                              <motion.div
                                animate={{ rotate: monthExpanded ? 90 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronRight size={14} className="text-gray-500 dark:text-gray-400" />
                              </motion.div>
                              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                                {group.year === 0 ? "Archive" : group.month_name}
                              </h2>
                              <span className="text-xs text-gray-500 ml-2">{group.items.length} items</span>
                            </button>

                            {monthExpanded && (
                              <div className="mt-4">
                                <MediaGrid items={group.items} layout="grid" />
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
        ) : (
          /* GALLERY VIEW */
          <div className="w-full">
            <MediaGrid 
              items={galleryItems} 
              layout="grid" 
            />
          </div>
        )}

        {/* Loading Indicator & Infinite Scroll Target */}
        <div ref={observerRef} className="h-20 flex items-center justify-center mt-8">
          {(loading || loadingMore) && (
            <div className="flex gap-2">
              <div className="w-2 h-2 bg-synaps-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-synaps-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-synaps-500 rounded-full animate-bounce" />
            </div>
          )}
          {!hasMore && !loading && (timelineGroups.length > 0 || galleryItems.length > 0) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">You've reached the end</p>
          )}
        </div>
      </div>
    </div>
  );
}
