'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { getMediaItem, getFileUrl, getStreamUrl, getThumbnailUrl, toggleFavorite, moveToTrash } from '@/lib/api';
import {
  X, ChevronLeft, ChevronRight, Star, Trash2, Download,
  ZoomIn, ZoomOut, Info, Maximize, Play, Pause, AlertCircle
} from 'lucide-react';

export function MediaViewer() {
  const { viewerOpen, viewerMediaId, closeViewer, markAsDeleted } = useAppStore();
  const [media, setMedia] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (viewerMediaId) {
      setLoading(true);
      setZoom(1);
      setShowInfo(false);
      setImageError(false);
      getMediaItem(viewerMediaId)
        .then(setMedia)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [viewerMediaId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!viewerOpen) return;
    if (e.key === 'Escape') {
      if (showInfo) {
        setShowInfo(false);
      } else {
        closeViewer();
      }
    }
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.25, 5));
    if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 0.5));
  }, [viewerOpen, closeViewer, showInfo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFavorite = async () => {
    if (!media) return;
    const result = await toggleFavorite(media.id);
    setMedia({ ...media, is_favorite: result.is_favorite });
  };

  const handleDelete = async () => {
    if (!media) return;
    try {
      await moveToTrash(media.id);
      markAsDeleted(media.id);
      closeViewer();
    } catch (err: any) {
      console.error('Failed to move to trash:', err);
      alert(`Failed to delete: ${err.message || 'Unknown error'}`);
    }
  };

  if (!viewerOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col"
        style={{
          background: 'rgba(5, 3, 12, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Top bar — glass */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between px-4 py-3"
          style={{
            background: 'rgba(15, 12, 30, 0.6)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <button onClick={closeViewer} className="p-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors">
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>

          <div className="text-[13px] text-[var(--text-secondary)] truncate max-w-[50%] font-medium">
            {media?.filename}
          </div>

          <div className="flex items-center gap-0.5">
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} className="p-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors">
              <ZoomIn size={17} className="text-[var(--text-tertiary)]" />
            </button>
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="p-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors">
              <ZoomOut size={17} className="text-[var(--text-tertiary)]" />
            </button>
            <button onClick={handleFavorite} className="p-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors">
              <Star
                size={17}
                className={media?.is_favorite ? 'text-amber-400' : 'text-[var(--text-tertiary)]'}
                fill={media?.is_favorite ? 'currentColor' : 'none'}
              />
            </button>
            <button onClick={() => setShowInfo(!showInfo)} className="p-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors">
              <Info size={17} className="text-[var(--text-tertiary)]" />
            </button>
            <a
              href={media ? getFileUrl(media.id) : '#'}
              download
              className="p-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors"
            >
              <Download size={17} className="text-[var(--text-tertiary)]" />
            </a>
            <button onClick={handleDelete} className="p-2 rounded-xl hover:bg-red-500/10 transition-colors">
              <Trash2 size={17} className="text-red-400/60" />
            </button>
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden relative">
          {loading ? (
            <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
          ) : media?.media_type === 'video' ? (
            <video
              src={getStreamUrl(media.id)}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain"
              style={{ transform: `scale(${zoom})` }}
            />
          ) : media?.media_type === 'image' ? (
            imageError ? (
              <div className="relative flex items-center justify-center w-full h-full">
                <motion.img
                  src={getThumbnailUrl(media.id)}
                  alt={media.filename}
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoom})` }}
                  draggable={false}
                />
                {/* Only show unsupported banner for non-HEIC formats — HEIC is handled by backend transcoding */}
                {!media.filename.toLowerCase().endsWith('.heic') && (
                  <div
                    className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full flex items-center gap-2 text-[var(--text-secondary)] text-xs"
                    style={{
                      background: 'rgba(15, 12, 30, 0.7)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    <AlertCircle size={14} className="text-amber-400" />
                    Could not load full image. Showing preview.
                  </div>
                )}
              </div>
            ) : (
              <motion.img
                key={media.id}
                src={getFileUrl(media.id)}
                alt={media.filename}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
                draggable={false}
                onError={() => setImageError(true)}
              />
            )
          ) : (
            <div className="text-[var(--text-tertiary)] text-sm">Preview not available</div>
          )}
        </div>

        {/* Invisible overlay to close info panel when clicking outside */}
        {showInfo && (
          <div
            className="absolute inset-0 z-10"
            onClick={() => setShowInfo(false)}
          />
        )}

        {/* Info panel — glass */}
        <AnimatePresence>
          {showInfo && media && (
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-72 p-5 overflow-y-auto z-20"
              style={{
                background: 'rgba(15, 12, 30, 0.8)',
                backdropFilter: 'blur(64px) saturate(200%)',
                WebkitBackdropFilter: 'blur(64px) saturate(200%)',
                borderLeft: '1px solid var(--glass-border)',
              }}
            >
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-4">Details</h3>
              <div className="space-y-3 text-xs">
                {[
                  ['Filename', media.filename],
                  ['Type', media.media_type],
                  ['Size', media.file_size_human],
                  ['Dimensions', media.width && media.height ? `${media.width} × ${media.height}` : 'N/A'],
                  ['Date Taken', media.date_taken ? new Date(media.date_taken).toLocaleDateString() : 'N/A'],
                  ['Path', media.path],
                  ['Camera', media.camera_make ? `${media.camera_make} ${media.camera_model || ''}` : 'N/A'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[var(--text-tertiary)] mb-0.5 text-[11px]">{label}</div>
                    <div className="text-[var(--text-secondary)] break-all">{value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
