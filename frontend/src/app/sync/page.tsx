'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import {
  uploadFile,
  scanImports,
  previewImports,
  executeImport,
  getImportProgress,
  getLatestImport,
  ImportScanResult,
  ImportPreviewResult,
  ImportProgress,
} from '@/lib/api';
import {
  Upload, Smartphone, CheckCircle2, XCircle, Clock,
  Loader2, CloudUpload, Image as ImageIcon, Film,
  Package, FolderInput, Scan, ArrowRight, AlertTriangle,
  HardDrive, Camera, Video, FolderOpen, FileQuestion,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'duplicate' | 'error';
  progress: number;
  message?: string;
}

type ImportState =
  | 'idle'
  | 'scanning'
  | 'scanned'
  | 'previewing'
  | 'previewed'
  | 'importing'
  | 'complete'
  | 'error';

// ── Import Section Component ──────────────────────────────────────────

function ImportSection() {
  const [importState, setImportState] = useState<ImportState>('idle');
  const [scanResult, setScanResult] = useState<ImportScanResult | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Check for existing running job on mount
  useEffect(() => {
    const checkLatest = async () => {
      try {
        const latest = await getLatestImport();
        if (latest && latest.status !== 'none') {
          if (['scanning', 'importing', 'indexing', 'pending'].includes(latest.status)) {
            setJobId(latest.job_id);
            setProgress(latest);
            setImportState('importing');
            startPolling(latest.job_id);
          } else if (latest.status === 'complete') {
            setProgress(latest);
            setImportState('complete');
          }
        }
      } catch {
        // No previous job, stay idle
      }
    };
    checkLatest();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const p = await getImportProgress(id);
        setProgress(p);
        if (p.status === 'complete') {
          setImportState('complete');
          stopPolling();
        } else if (p.status === 'error') {
          setImportState('error');
          setError(p.phase || 'Unknown error');
          stopPolling();
        }
      } catch {
        // Keep polling, might be a transient error
      }
    }, 2000);
  };

  const handleScan = async () => {
    setImportState('scanning');
    setError(null);
    try {
      const result = await scanImports();
      setScanResult(result);
      setImportState(result.total_files > 0 ? 'scanned' : 'idle');
      if (result.total_files === 0) {
        setError('No files found in import folder');
      }
    } catch (err: any) {
      setImportState('error');
      setError(err.message || 'Scan failed');
    }
  };

  const handlePreview = async () => {
    setImportState('previewing');
    setError(null);
    try {
      const result = await previewImports();
      setPreviewResult(result);
      setImportState('previewed');
    } catch (err: any) {
      setImportState('error');
      setError(err.message || 'Preview failed');
    }
  };

  const handleExecute = async () => {
    setError(null);
    try {
      const result = await executeImport();
      if (result.status === 'already_running') {
        setJobId(result.job_id);
        setImportState('importing');
        startPolling(result.job_id);
      } else {
        setJobId(result.job_id);
        setImportState('importing');
        startPolling(result.job_id);
      }
    } catch (err: any) {
      setImportState('error');
      setError(err.message || 'Import failed to start');
    }
  };

  const handleReset = () => {
    stopPolling();
    setImportState('idle');
    setScanResult(null);
    setPreviewResult(null);
    setProgress(null);
    setJobId(null);
    setError(null);
  };

  // Folder icon with a nice gradient
  const folderIcon = (path: string) => {
    if (path.startsWith('Timeline/')) return <FolderOpen size={15} className="text-synaps-400" />;
    if (path === 'Old_Photos') return <Camera size={15} className="text-amber-400" />;
    if (path === 'Unknown_Date') return <FileQuestion size={15} className="text-gray-400" />;
    return <FolderOpen size={15} className="text-gray-400" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-3xl p-8
        bg-gradient-to-br from-emerald-500/[0.07] via-teal-600/[0.04] to-transparent
        border border-emerald-500/10 dark:border-emerald-500/[0.08]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
          <Package size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Imports
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Organize media from import folder
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── IDLE STATE ── */}
        {importState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              Scan your import folder to find new media waiting to be organized
              into your library.
            </p>

            {error && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleScan}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium text-white
                bg-gradient-to-r from-emerald-500 to-teal-600
                hover:from-emerald-600 hover:to-teal-700
                transition-all duration-200 shadow-lg shadow-emerald-500/20
                flex items-center justify-center gap-2"
            >
              <Scan size={16} />
              Scan Imports
            </button>
          </motion.div>
        )}

        {/* ── SCANNING STATE ── */}
        {importState === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center py-6"
          >
            <Loader2 size={28} className="text-emerald-500 animate-spin mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Scanning import folder...</p>
          </motion.div>
        )}

        {/* ── SCANNED STATE (show stats) ── */}
        {importState === 'scanned' && scanResult && (
          <motion.div
            key="scanned"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl bg-white/50 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04] p-3 text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {scanResult.total_files}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">
                  files waiting
                </p>
              </div>
              <div className="rounded-xl bg-white/50 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <Camera size={13} className="text-blue-400" />
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {scanResult.photos}
                  </span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">photos</p>
              </div>
              <div className="rounded-xl bg-white/50 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <Video size={13} className="text-purple-400" />
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {scanResult.videos}
                  </span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">videos</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl bg-white/30 dark:bg-white/[0.03]">
              <HardDrive size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {scanResult.total_size_human}
              </span>
              <span className="text-xs text-gray-400">total size</span>
            </div>

            <button
              onClick={handlePreview}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium text-white
                bg-gradient-to-r from-emerald-500 to-teal-600
                hover:from-emerald-600 hover:to-teal-700
                transition-all duration-200 shadow-lg shadow-emerald-500/20
                flex items-center justify-center gap-2"
            >
              <FolderInput size={16} />
              Preview Import
            </button>
          </motion.div>
        )}

        {/* ── PREVIEWING STATE ── */}
        {importState === 'previewing' && (
          <motion.div
            key="previewing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center py-6"
          >
            <Loader2 size={28} className="text-emerald-500 animate-spin mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Extracting metadata & computing destinations...</p>
            <p className="text-[11px] text-gray-400 mt-1">This may take a moment for large libraries</p>
          </motion.div>
        )}

        {/* ── PREVIEWED STATE (show destinations) ── */}
        {importState === 'previewed' && previewResult && (
          <motion.div
            key="previewed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Import Preview
              </h3>
            </div>

            <div className="space-y-1 mb-5">
              {previewResult.destinations.map((dest, i) => (
                <motion.div
                  key={dest.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl
                    bg-white/50 dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.03]"
                >
                  <div className="flex items-center gap-2.5">
                    {folderIcon(dest.path)}
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                      {dest.path}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-gray-300 dark:text-gray-600" />
                    <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                      {dest.count}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {dest.count === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-3 rounded-xl text-sm font-medium
                  text-gray-600 dark:text-gray-400
                  bg-gray-100 dark:bg-white/[0.05]
                  hover:bg-gray-200 dark:hover:bg-white/[0.08]
                  transition-all duration-200 flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className="px-4 py-3 rounded-xl text-sm font-medium text-white
                  bg-gradient-to-r from-emerald-500 to-teal-600
                  hover:from-emerald-600 hover:to-teal-700
                  transition-all duration-200 shadow-lg shadow-emerald-500/20
                  flex items-center justify-center gap-2 flex-[2]"
              >
                <FolderInput size={16} />
                Start Import
              </button>
            </div>
          </motion.div>
        )}

        {/* ── IMPORTING STATE (progress) ── */}
        {importState === 'importing' && progress && (
          <motion.div
            key="importing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-emerald-500 animate-spin" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {progress.phase}
                  </span>
                </div>
                <span className="text-sm font-bold text-emerald-500 tabular-nums">
                  {progress.progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>

              {progress.total_files > 0 && (
                <p className="text-[11px] text-gray-400 mt-2 tabular-nums">
                  {progress.processed_files} / {progress.total_files} processed
                </p>
              )}
            </div>

            {/* Live stats during import */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="px-3 py-2 rounded-lg bg-white/30 dark:bg-white/[0.03]">
                <span className="text-gray-400">Imported </span>
                <span className="font-semibold text-emerald-500 tabular-nums">{progress.imported}</span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-white/30 dark:bg-white/[0.03]">
                <span className="text-gray-400">Skipped </span>
                <span className="font-semibold text-amber-500 tabular-nums">{progress.duplicates_skipped}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── COMPLETE STATE ── */}
        {importState === 'complete' && progress && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 size={18} className="text-emerald-500" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Import Complete
              </h3>
            </div>

            <div className="space-y-1.5 mb-5">
              {[
                { label: 'Imported', value: progress.imported, color: 'text-emerald-500' },
                { label: 'Duplicates Skipped', value: progress.duplicates_skipped, color: 'text-amber-500' },
                { label: 'Unknown Date', value: progress.unknown_date, color: 'text-gray-400' },
                { label: 'Errors', value: progress.errors, color: progress.errors > 0 ? 'text-red-500' : 'text-gray-400' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between px-3 py-2 rounded-xl
                    bg-white/50 dark:bg-white/[0.03]"
                >
                  <span className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${stat.color}`}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>

            {progress.error_log && progress.error_log.length > 0 && (
              <div className="mb-5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] max-h-40 overflow-y-auto border border-black/[0.03] dark:border-white/[0.03]">
                <p className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Import Log</p>
                <div className="space-y-1">
                  {progress.error_log.map((log, i) => (
                    <p key={i} className="text-[10px] text-gray-400 font-mono leading-relaxed">
                      {log}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-400 text-center mb-4">
              New media is now visible in your Timeline
            </p>

            <button
              onClick={handleReset}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium
                text-gray-600 dark:text-gray-400
                bg-gray-100 dark:bg-white/[0.05]
                hover:bg-gray-200 dark:hover:bg-white/[0.08]
                transition-all duration-200"
            >
              Done
            </button>
          </motion.div>
        )}

        {/* ── ERROR STATE ── */}
        {importState === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 mb-4 px-3 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <XCircle size={16} className="text-red-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-600 dark:text-red-400">Import Error</p>
                <p className="text-[11px] text-red-500/70 mt-0.5">{error}</p>
              </div>
            </div>

            {progress && progress.errors > 0 && progress.error_log.length > 0 && (
              <div className="mb-4 px-3 py-2 rounded-xl bg-white/30 dark:bg-white/[0.03] max-h-32 overflow-y-auto">
                {progress.error_log.map((log, i) => (
                  <p key={i} className="text-[10px] text-gray-400 font-mono py-0.5">{log}</p>
                ))}
              </div>
            )}

            <button
              onClick={handleReset}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium
                text-gray-600 dark:text-gray-400
                bg-gray-100 dark:bg-white/[0.05]
                hover:bg-gray-200 dark:hover:bg-white/[0.08]
                transition-all duration-200"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Sync Page ────────────────────────────────────────────────────

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
      <TopBar title="Sync" subtitle="Upload & Import Media" />

      <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto space-y-6">
        {/* ── Import Manager Section ── */}
        <ImportSection />

        {/* ── iPhone Sync Section (existing) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl p-8
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
