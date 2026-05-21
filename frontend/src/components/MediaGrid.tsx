'use client';

import { motion } from 'framer-motion';
import { getThumbnailUrl } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Play, Star } from 'lucide-react';
import { useState } from 'react';

interface MediaItem {
  id: string;
  filename: string;
  media_type: string;
  extension: string;
  is_favorite: boolean;
  date_taken: string | null;
  thumbnail_url: string;
  file_url: string;
  stream_url?: string;
  duration?: number;
}

interface MediaGridProps {
  items: MediaItem[];
}

function MediaThumbnail({ item, index }: { item: MediaItem; index: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const { openViewer } = useAppStore();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.3 }}
      className="media-thumb group"
      onClick={() => openViewer(item.id)}
    >
      {/* Skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 skeleton" />
      )}

      {/* Thumbnail image */}
      <img
        src={getThumbnailUrl(item.id)}
        alt={item.filename}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => { setError(true); setLoaded(true); }}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-xs text-gray-400 uppercase">{item.extension.replace('.', '')}</span>
        </div>
      )}

      {/* Video play icon */}
      {item.media_type === 'video' && (
        <div className="video-overlay">
          <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center shadow-lg">
            <Play size={18} className="text-gray-900 dark:text-white ml-0.5" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Favorite badge */}
      {item.is_favorite && (
        <div className="absolute top-2 right-2">
          <Star size={14} className="text-amber-400" fill="currentColor" />
        </div>
      )}

      {/* Bottom gradient overlay on hover */}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="absolute bottom-2 left-2 text-[10px] text-white/90 truncate max-w-[90%]">
          {item.filename}
        </span>
      </div>
    </motion.div>
  );
}

export function MediaGrid({ items }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <Star size={24} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">No media found</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
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
