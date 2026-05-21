'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/TopBar';
import { browseDirectory } from '@/lib/api';
import {
  Folder, FolderOpen, FileText, Image, Film, File,
  ChevronRight, ArrowLeft, HardDrive, AlertCircle
} from 'lucide-react';

function FileIcon({ type }: { type: string }) {
  const size = 18;
  switch (type) {
    case 'image': return <Image size={size} className="text-blue-500" />;
    case 'video': return <Film size={size} className="text-purple-500" />;
    case 'document': return <FileText size={size} className="text-amber-500" />;
    default: return <File size={size} className="text-gray-400" />;
  }
}

export default function FinderPage() {
  const [currentPath, setCurrentPath] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <div className="flex items-center gap-1 mb-4 text-xs overflow-x-auto">
            {data.breadcrumb.map((crumb: any, i: number) => (
              <div key={i} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ChevronRight size={12} className="text-gray-400" />}
                <button
                  onClick={() => navigate(crumb.path)}
                  className={`px-1.5 py-0.5 rounded-md transition-colors
                    ${i === data.breadcrumb.length - 1
                      ? 'text-gray-900 dark:text-white font-medium'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
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
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <button
              onClick={() => navigate(currentPath)}
              className="text-xs text-synaps-500 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-synaps-500/20 border-t-synaps-500 animate-spin" />
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
                className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-sm
                  text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}

            {/* Folders */}
            {data?.folders?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Folders ({data.total_folders})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {data.folders.map((folder: any) => (
                    <motion.button
                      key={folder.path}
                      onClick={() => navigate(folder.path)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl
                        bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06]
                        border border-transparent hover:border-gray-200 dark:hover:border-white/[0.08]
                        transition-all duration-200 group"
                    >
                      <Folder size={36} className="text-synaps-500 group-hover:text-synaps-400 transition-colors" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full text-center">
                        {folder.name}
                      </span>
                      <span className="text-[10px] text-gray-400">
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
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Files ({data.total_files})
                </h3>
                <div className="space-y-1">
                  {data.files.map((file: any) => (
                    <div
                      key={file.path}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                        hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      <FileIcon type={file.file_type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-400">{file.size_human}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 uppercase">{file.extension.replace('.', '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty */}
            {(!data?.folders?.length && !data?.files?.length) && (
              <div className="flex flex-col items-center justify-center py-20">
                <Folder size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500">Empty folder</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
