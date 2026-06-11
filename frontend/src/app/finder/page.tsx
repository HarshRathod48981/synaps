'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { browseDirectory, getThumbnailUrl } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import {
  Folder, FolderOpen, FileText, Image, Film, File,
  ChevronRight, ArrowLeft, HardDrive, AlertCircle
} from 'lucide-react';

function FileIcon({ type }: { type: string }) {
  const size = 18;
  switch (type) {
    case 'image': return <Image size={size} className="text-blue-400" />;
    case 'video': return <Film size={size} className="text-purple-400" />;
    case 'document': return <FileText size={size} className="text-amber-400" />;
    default: return <File size={size} className="text-[var(--text-tertiary)]" />;
  }
}

export default function FinderPage() {
  const [currentPath, setCurrentPath] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openViewer } = useAppStore();

  const navigate = async (path: string) => {
    setCurrentPath(path);
    setLoading(true);
    setError(null);
    try {
      const result = await browseDirectory(path);
      setData(result);
    } catch (err: any) {
      console.error('Finder browse error:', err);
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    navigate('');
  }, []);

  return (
    <div className="min-h-screen">
      <TopBar title="Finder" subtitle={currentPath || 'Storage Root'} />

      <div className="px-4 lg:px-6 py-6">
        {/* Breadcrumb */}
        {data?.breadcrumb && (
          <div className="flex items-center gap-1 mb-5 text-xs overflow-x-auto no-scrollbar">
            {data.breadcrumb.map((crumb: any, i: number) => (
              <div key={i} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ChevronRight size={11} className="text-[var(--text-muted)]" />}
                <button
                  onClick={() => navigate(crumb.path)}
                  className={`px-2 py-1 rounded-lg transition-colors
                    ${i === data.breadcrumb.length - 1
                      ? 'text-[var(--text-primary)] font-medium bg-[var(--glass-bg)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]'
                    }`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle size={32} className="text-red-400/70 mb-3" />
            <p className="text-sm text-red-400/80 mb-2">{error}</p>
            <button
              onClick={() => navigate(currentPath)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
          </div>
        ) : !error && (
          <div>
            {/* Back button */}
            {currentPath && (
              <button
                onClick={() => {
                  const parent = currentPath.split('/').slice(0, -1).join('/');
                  navigate(parent);
                }}
                className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl text-sm
                  text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] transition-colors"
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}

            {/* Folders */}
            {data?.folders?.length > 0 && (
              <div className="mb-6">
                <h3 className="section-label mb-3">
                  Folders ({data.total_folders})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {data.folders.map((folder: any) => (
                    <motion.button
                      key={folder.path}
                      onClick={() => navigate(folder.path)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl
                        glass-panel glass-hover group transition-all duration-200"
                    >
                      <Folder size={32} className="text-[var(--accent)] group-hover:text-[var(--accent-light)] transition-colors" />
                      <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate w-full text-center">
                        {folder.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        {folder.children_count} items
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {data?.files?.length > 0 && (
              <div>
                <h3 className="section-label mb-3">
                  Files ({data.total_files})
                </h3>
                <div className="space-y-1">
                  {data.files.map((file: any) => (
                    <div
                      key={file.path}
                      onClick={() => {
                        if (file.media_id) openViewer(file.media_id);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                        hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer group"
                    >
                      <FileIcon type={file.file_type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--text-primary)] truncate">{file.name}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">{file.size_human}</p>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase font-medium">{file.extension.replace('.', '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty */}
            {(!data?.folders?.length && !data?.files?.length) && (
              <div className="flex flex-col items-center justify-center py-20">
                <Folder size={36} className="text-[var(--text-muted)] mb-3" />
                <p className="text-sm text-[var(--text-tertiary)]">Empty folder</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
