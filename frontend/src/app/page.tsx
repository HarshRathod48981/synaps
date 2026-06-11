'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { MediaGrid } from '@/components/MediaGrid';
import { GlassToolbar, ToolbarButton, ToolbarDivider } from '@/components/glass/GlassToolbar';
import { useAppStore } from '@/lib/store';
import { getMedia, getMediaStats } from '@/lib/api';
import { ChevronRight, ChevronDown, LayoutGrid, List, Heart, Share2, Trash2, Grid3X3 } from 'lucide-react';

interface TimelineGroup {
  year: number;
  month: number;
  month_name: string;
  items: any[];
}

export default function MediaBrowser() {
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

  const { activeFilter, activeView, activeSources } = useAppStore();
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: any = {
        page: pageNum,
        per_page: activeView === 'gallery' ? 100 : 80,
        view: activeView
      };

      if (activeFilter) params.media_type = activeFilter;
      if (activeSources.size > 0) {
        params.sources = Array.from(activeSources).join(',');
      }

      const data = await getMedia(params);

      if (activeView === 'timeline') {
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
  }, [activeFilter, activeView, activeSources]);

  // Reset when filter, viewType, or sources change
  useEffect(() => {
    setPage(1);
    setTimelineGroups([]);
    setGalleryItems([]);
    setHasMore(true);
    setHasInitializedState(false);
    fetchPage(1, true);
  }, [activeFilter, activeView, activeSources]);

  useEffect(() => {
    getMediaStats().then(setStats).catch(console.error);
  }, []);

  // Transform flat month groups into year-based groups for Timeline
  const yearGroups = useMemo(() => {
    if (activeView !== 'timeline') return [];
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
  }, [timelineGroups, activeView]);

  // Auto-collapse logic for Timeline
  useEffect(() => {
    if (activeView === 'timeline' && yearGroups.length > 0 && !hasInitializedState) {
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
  }, [yearGroups, hasInitializedState, activeView]);

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
    if (activeView !== 'gallery' || galleryItems.length === 0) return;

    const handleScroll = () => {
      const elements = document.querySelectorAll('[data-date]');
      let activeDate = null;

      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        if (rect.top <= 120) {
          activeDate = elements[i].getAttribute('data-date');
        } else {
          break;
        }
      }

      if (!activeDate && elements.length > 0) {
        activeDate = elements[0].getAttribute('data-date');
      }

      setActiveDateHeader(activeDate);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeView, galleryItems]);

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

  return (
    <div className="min-h-screen pb-24">
      <TopBar
        title="Library"
        subtitle={stats ? `${stats.total_files.toLocaleString()} items · ${stats.total_size_human}` : undefined}
        showViewControls
        showSourcesButton
      />

      {/* Gallery Sticky Date Overlay */}
      <AnimatePresence>
        {activeView === 'gallery' && activeDateHeader && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40"
          >
            <div
              className="px-5 py-1.5 rounded-full text-[13px] font-medium text-[var(--text-primary)] shadow-2xl"
              style={{
                background: 'rgba(20, 18, 40, 0.7)',
                backdropFilter: 'blur(40px) saturate(200%)',
                WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                border: '1px solid var(--glass-border-light)',
              }}
            >
              {activeDateHeader}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 lg:px-5 pb-8 mt-2">
        {activeView === 'timeline' ? (
          /* ═══ TIMELINE VIEW ═══ */
          <div className="space-y-6">
            {yearGroups.map((yearGroup) => {
              const yearCollapsed = collapsedYears.has(yearGroup.year);

              return (
                <div key={yearGroup.year} className="space-y-3">
                  {/* Year Header */}
                  <div className="flex items-center gap-3 w-full group">
                    <button
                      onClick={() => toggleYear(yearGroup.year)}
                      className="flex items-center gap-2.5 text-left shrink-0 focus:outline-none"
                    >
                      <motion.div
                        animate={{ rotate: yearCollapsed ? 0 : 90 }}
                        transition={{ duration: 0.2 }}
                        className="w-6 h-6 rounded-full bg-[var(--glass-bg-hover)] flex items-center justify-center
                          group-hover:bg-[var(--glass-bg-active)] transition-colors"
                      >
                        <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                      </motion.div>
                      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                        {yearGroup.year === 0 ? 'Old Photos' : yearGroup.year}
                      </h1>
                    </button>
                    <div className="h-px bg-[var(--glass-border)] flex-1 ml-1" />
                    <span className="text-[11px] font-medium text-[var(--text-tertiary)] shrink-0">
                      {yearGroup.totalItems.toLocaleString()} items
                    </span>
                  </div>

                  {/* Months */}
                  <AnimatePresence>
                    {!yearCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="pl-2 lg:pl-4 space-y-4 overflow-hidden"
                      >
                        {yearGroup.months.map((group) => {
                          const key = `${group.year}-${group.month}`;
                          const monthExpanded = expandedMonths.has(key);

                          return (
                            <section key={key} style={{ contentVisibility: 'auto' }}>
                              <button
                                onClick={() => toggleMonth(key)}
                                className="month-header flex items-center gap-2.5 group/month w-full text-left
                                  focus:outline-none"
                                style={{
                                  background: 'rgba(12, 10, 26, 0.5)',
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                                }}
                              >
                                <motion.div
                                  animate={{ rotate: monthExpanded ? 90 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
                                </motion.div>
                                <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                                  {group.year === 0 ? 'Archive' : group.month_name}
                                </h2>
                                <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
                                  · {group.items.length} items
                                </span>
                              </button>

                              <AnimatePresence>
                                {monthExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="mt-3"
                                  >
                                    <MediaGrid items={group.items} />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </section>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ GALLERY VIEW ═══ */
          <div className="w-full">
            <MediaGrid items={galleryItems} />
          </div>
        )}

        {/* Loading Indicator & Infinite Scroll Target */}
        <div ref={observerRef} className="h-20 flex items-center justify-center mt-8">
          {(loading || loadingMore) && (
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" />
            </div>
          )}
          {!hasMore && !loading && (timelineGroups.length > 0 || galleryItems.length > 0) && (
            <p className="text-[12px] text-[var(--text-tertiary)]">You've reached the end</p>
          )}
        </div>
      </div>

      {/* ═══ FLOATING BOTTOM TOOLBAR ═══ */}
      <GlassToolbar visible={!loading && (timelineGroups.length > 0 || galleryItems.length > 0)}>
        <ToolbarButton icon={<LayoutGrid size={16} />} label="Grid View" active={activeView === 'gallery'} />
        <ToolbarButton icon={<List size={16} />} label="Timeline View" active={activeView === 'timeline'} />
        <ToolbarDivider />
        <ToolbarButton icon={<Heart size={16} />} label="Favorites" />
        <ToolbarButton icon={<Share2 size={16} />} label="Share" />
        <ToolbarButton icon={<Trash2 size={16} />} label="Delete" danger />
      </GlassToolbar>
    </div>
  );
}
