'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { getMediaItem, getFileUrl, getStreamUrl, toggleFavorite, moveToTrash } from '@/lib/api';
import {
  X, ChevronLeft, ChevronRight, Star, Trash2, Download,
  ZoomIn, ZoomOut, Info, Maximize, Play, Pause
} from 'lucide-react';

export function MediaViewer() {
  const { viewerOpen, viewerMediaId, closeViewer } = useAppStore();
  const [media, setMedia] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (viewerMediaId) {
      setLoading(true);
      setZoom(1);
      setShowInfo(false); // Reset info panel state on new image
      setImageError(false); // Reset error state on new image
      getMediaItem(viewerMediaId)
        .then(setMedia)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [viewerMediaId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!viewerOpen) return;
    if (e.key === 'Escape') {
      // If info panel is open, close it first. Otherwise close the whole viewer.
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
    await moveToTrash(media.id);
    closeViewer();
  };

  if (!viewerOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      >
        {/* Top bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-xl"
        >
          <button onClick={closeViewer} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
            <X size={20} className="text-white" />
          </button>

          <div className="text-sm text-white/70 truncate max-w-[50%]">
            {media?.filename}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
              <ZoomIn size={18} className="text-white/70" />
            </button>
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
              <ZoomOut size={18} className="text-white/70" />
            </button>
            <button onClick={handleFavorite} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
              <Star
                size={18}
                className={media?.is_favorite ? 'text-amber-400' : 'text-white/70'}
                fill={media?.is_favorite ? 'currentColor' : 'none'}
              />
            </button>
            <button onClick={() => setShowInfo(!showInfo)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
              <Info size={18} className="text-white/70" />
            </button>
            <a
              href={media ? getFileUrl(media.id) : '#'}
              download
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Download size={18} className="text-white/70" />
            </a>
            <button onClick={handleDelete} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
              <Trash2 size={18} className="text-red-400/70" />
            </button>
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden relative">
          {loading ? (
            <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
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
              <div className="flex flex-col items-center gap-3 text-white/50">
                <Info size={48} className="opacity-50" />
                <p>Failed to load image</p>
                <p className="text-xs opacity-70">{media.filename}</p>
              </div>
            ) : (
              <motion.img
                src={getFileUrl(media.id)}
                alt={media.filename}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
                draggable={false}
                onError={() => setImageError(true)}
              />
            )
          ) : (
            <div className="text-white/50 text-sm">Preview not available</div>
          )}
        </div>

        {/* Invisible overlay to close info panel when clicking outside */}
        {showInfo && (
          <div 
            className="absolute inset-0 z-10" 
            onClick={() => setShowInfo(false)} 
          />
        )}

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && media && (
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="absolute right-0 top-0 bottom-0 w-72 bg-black/80 backdrop-blur-2xl border-l border-white/10 p-5 overflow-y-auto z-20"
            >
              <h3 className="text-sm font-semibold text-white mb-4">Details</h3>
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
                    <div className="text-white/40 mb-0.5">{label}</div>
                    <div className="text-white/80 break-all">{value}</div>
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
