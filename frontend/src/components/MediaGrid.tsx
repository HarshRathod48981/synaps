'use client';

import { motion } from 'framer-motion';
import { getThumbnailUrl } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Play, Star } from 'lucide-react';
import { useState, useEffect } from 'react';

interface MediaItem {
  id: string;
  filename: string;
  media_type: string;
  extension: string;
  is_favorite: boolean;
  date_taken: string | null;
  has_thumbnail?: boolean;
  thumbnail_url: string;
  file_url: string;
  stream_url?: string;
  duration?: number;
  date_string?: string;
}

interface MediaGridProps {
  items: MediaItem[];
}

function MediaThumbnail({ item, index }: { item: MediaItem; index: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(getThumbnailUrl(item.id));
  const { openViewer } = useAppStore();

  // Poll for thumbnail if it wasn't ready when we fetched the timeline
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    if (!item.has_thumbnail) {
      const checkThumbnail = async () => {
        try {
          const url = getThumbnailUrl(item.id);
          const res = await fetch(url, { method: 'HEAD' });
          if (!mounted) return;

          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('svg')) {
            // Still generating, poll again
            timeoutId = setTimeout(checkThumbnail, 2500);
          } else {
            // Ready! Bust the cache to load the real WebP thumbnail
            setImgSrc(`${url}?t=${Date.now()}`);
          }
        } catch (err) {
          // Ignore network errors during polling
        }
      };

      // Start polling after a short delay
      timeoutId = setTimeout(checkThumbnail, 2000);
    }

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [item.id, item.has_thumbnail]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.01, 0.3), duration: 0.25 }}
      className="media-thumb group"
      onClick={() => openViewer(item.id)}
      data-date={item.date_string}
    >
      {/* Skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 skeleton" />
      )}

      {/* Thumbnail image */}
      <img
        src={imgSrc}
        alt={item.filename}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => { setError(true); setLoaded(true); }}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--glass-bg)]">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-medium">{item.extension.replace('.', '')}</span>
        </div>
      )}

      {/* Video duration badge */}
      {item.media_type === 'video' && (
        <div className="video-duration">
          <Play size={8} fill="currentColor" />
          {item.duration ? formatDuration(item.duration) : ''}
        </div>
      )}

      {/* Video play overlay on hover */}
      {item.media_type === 'video' && (
        <div className="video-overlay">
          <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10">
            <Play size={16} className="text-white ml-0.5" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Favorite badge */}
      {item.is_favorite && (
        <div className="absolute top-1.5 right-1.5">
          <Star size={12} className="text-amber-400 drop-shadow-lg" fill="currentColor" />
        </div>
      )}

      {/* Hover info overlay */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent
        opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="absolute bottom-1.5 left-2 text-[9px] text-white/80 truncate max-w-[90%] font-medium">
          {item.filename}
        </span>
      </div>
    </motion.div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MediaGrid({ items }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--glass-bg)] flex items-center justify-center mb-4 border border-[var(--glass-border)]">
          <Star size={22} className="text-[var(--text-tertiary)]" />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">No media found</p>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="media-grid">
      {items.map((item, index) => (
        <MediaThumbnail key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}
