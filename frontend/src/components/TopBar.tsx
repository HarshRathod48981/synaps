'use client';

import { useAppStore } from '@/lib/store';
import { usePathname } from 'next/navigation';
import { GlassSegmentedControl } from '@/components/glass/GlassSegmentedControl';
import { GlassButton } from '@/components/glass/GlassButton';
import { Menu, Search, SlidersHorizontal, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

interface TopBarProps {
  title: string;
  subtitle?: string;
  showViewControls?: boolean;
  showSourcesButton?: boolean;
  children?: React.ReactNode;
}

const viewOptions = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'gallery', label: 'All Photos' },
];

export function TopBar({
  title,
  subtitle,
  showViewControls = false,
  showSourcesButton = false,
  children,
}: TopBarProps) {
  const { toggleSidebar, activeView, setActiveView, activeSources } = useAppStore();
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-20 px-4 lg:px-6 py-3
        bg-[var(--bg-deep)]/60
        backdrop-blur-2xl"
      style={{
        background: 'rgba(12, 10, 26, 0.6)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleSidebar}
            className="p-2 -ml-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors lg:hidden"
          >
            <Menu size={20} className="text-[var(--text-secondary)]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Center: Segmented Control (Library page only) */}
        {showViewControls && (
          <div className="hidden sm:flex items-center">
            <GlassSegmentedControl
              options={viewOptions}
              value={activeView}
              onChange={(key) => setActiveView(key as 'timeline' | 'gallery')}
            />
          </div>
        )}

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1">
          {showSourcesButton && activeSources.size > 0 && (
            <div className="glass-pill glass-pill-active mr-1 text-[11px]">
              <SlidersHorizontal size={12} />
              {activeSources.size} source{activeSources.size > 1 ? 's' : ''}
            </div>
          )}
          {children}
          <Link href="/search">
            <GlassButton variant="ghost" size="md">
              <Search size={18} className="text-[var(--text-secondary)]" />
            </GlassButton>
          </Link>
        </div>
      </div>

      {/* Mobile view toggle */}
      {showViewControls && (
        <div className="sm:hidden mt-3 flex justify-center">
          <GlassSegmentedControl
            options={viewOptions}
            value={activeView}
            onChange={(key) => setActiveView(key as 'timeline' | 'gallery')}
          />
        </div>
      )}
    </header>
  );
}
