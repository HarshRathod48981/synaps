'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { uploadFile } from '@/lib/api';
import {
  Upload, Smartphone, CheckCircle2, XCircle, Clock,
  Loader2, CloudUpload, Image as ImageIcon, Film
} from 'lucide-react';

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'duplicate' | 'error';
  progress: number;
  message?: string;
}

export default function SyncPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newUploads: UploadItem[] = Array.from(files).map((file) => ({
      file,
      status: 'pending',
      progress: 0,
    }));
    setUploads((prev) => [...prev, ...newUploads]);
  };

  const startUpload = useCallback(async () => {
    const pending = uploads.filter((u) => u.status === 'pending');
    if (pending.length === 0) return;

    setIsUploading(true);

    for (let i = 0; i < uploads.length; i++) {
      if (uploads[i].status !== 'pending') continue;

      setUploads((prev) =>
        prev.map((u, idx) => (idx === i ? { ...u, status: 'uploading', progress: 50 } : u))
      );

      try {
        const result = await uploadFile(uploads[i].file, 'iPhone');
        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i
              ? {
                  ...u,
                  status: result.status === 'duplicate' ? 'duplicate' : 'success',
                  progress: 100,
                  message: result.message,
                }
              : u
          )
        );
      } catch (err: any) {
        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i
              ? { ...u, status: 'error', progress: 0, message: err.message }
              : u
          )
        );
      }
    }

    setIsUploading(false);
  }, [uploads]);

  const stats = {
    total: uploads.length,
    success: uploads.filter((u) => u.status === 'success').length,
    duplicate: uploads.filter((u) => u.status === 'duplicate').length,
    error: uploads.filter((u) => u.status === 'error').length,
    pending: uploads.filter((u) => u.status === 'pending').length,
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Sync" subtitle="Upload from iPhone" />

      <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-8 mb-8
            bg-gradient-to-br from-synaps-500/10 via-synaps-600/5 to-transparent
            border border-synaps-500/10 dark:border-synaps-500/10"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-synaps-500 to-synaps-700 flex items-center justify-center">
              <Smartphone size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                iPhone Sync
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Upload photos & videos to your NAS
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            Select photos and videos from your iPhone. Files are automatically organized
            by date and deduplicated. Only missing files will be uploaded.
          </p>

          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-synaps-500/30 rounded-2xl p-8
              flex flex-col items-center justify-center cursor-pointer
              hover:border-synaps-500/50 hover:bg-synaps-500/5 transition-all duration-200"
          >
            <CloudUpload size={32} className="text-synaps-500 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tap to select files
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Photos, Videos, HEIC, RAW supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.heic,.heif,.raw,.cr2,.nef,.arw,.dng"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </motion.div>

        {/* Upload queue */}
        {uploads.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Stats bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">{stats.total} files</span>
                {stats.success > 0 && (
                  <span className="text-green-500">{stats.success} uploaded</span>
                )}
                {stats.duplicate > 0 && (
                  <span className="text-amber-500">{stats.duplicate} duplicates</span>
                )}
                {stats.error > 0 && (
                  <span className="text-red-500">{stats.error} failed</span>
                )}
              </div>
              <button
                onClick={startUpload}
                disabled={isUploading || stats.pending === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white
                  bg-gradient-to-r from-synaps-500 to-synaps-600
                  hover:from-synaps-600 hover:to-synaps-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200 shadow-lg shadow-synaps-500/20"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Uploading...
                  </span>
                ) : (
                  `Upload ${stats.pending} files`
                )}
              </button>
            </div>

            {/* File list */}
            <div className="space-y-1.5">
              <AnimatePresence>
                {uploads.map((item, index) => (
                  <motion.div
                    key={`${item.file.name}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                      bg-gray-50 dark:bg-white/[0.03]"
                  >
                    {item.file.type.startsWith('video') ? (
                      <Film size={16} className="text-purple-500 shrink-0" />
                    ) : (
                      <ImageIcon size={16} className="text-blue-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-900 dark:text-gray-100 truncate">
                        {item.file.name}
                      </p>
                      {item.status === 'uploading' && (
                        <div className="mt-1 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="upload-progress h-full" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                      {item.message && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.message}</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {item.status === 'pending' && <Clock size={14} className="text-gray-400" />}
                      {item.status === 'uploading' && <Loader2 size={14} className="text-synaps-500 animate-spin" />}
                      {item.status === 'success' && <CheckCircle2 size={14} className="text-green-500" />}
                      {item.status === 'duplicate' && <CheckCircle2 size={14} className="text-amber-500" />}
                      {item.status === 'error' && <XCircle size={14} className="text-red-500" />}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
