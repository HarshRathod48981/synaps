import { create } from 'zustand';

interface AppState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Media Viewer
  viewerOpen: boolean;
  viewerMediaId: string | null;
  openViewer: (mediaId: string) => void;
  closeViewer: () => void;

  // Library filter (media type)
  activeFilter: string | null;
  setFilter: (filter: string | null) => void;

  // View mode (timeline vs gallery)
  activeView: 'timeline' | 'gallery';
  setActiveView: (view: 'timeline' | 'gallery') => void;

  // Source filter (sidebar)
  activeSources: Set<string>;
  toggleSource: (source: string) => void;
  clearSources: () => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Deleted items tracking
  deletedMediaIds: Set<string>;
  markAsDeleted: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Theme
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Viewer
  viewerOpen: false,
  viewerMediaId: null,
  openViewer: (mediaId) => set({ viewerOpen: true, viewerMediaId: mediaId }),
  closeViewer: () => set({ viewerOpen: false, viewerMediaId: null }),

  // Library filter
  activeFilter: null,
  setFilter: (filter) => set({ activeFilter: filter }),

  // View mode
  activeView: 'timeline',
  setActiveView: (view) => set({ activeView: view }),

  // Source filter
  activeSources: new Set(),
  toggleSource: (source) =>
    set((s) => {
      const next = new Set(s.activeSources);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return { activeSources: next };
    }),
  clearSources: () => set({ activeSources: new Set() }),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Deleted
  deletedMediaIds: new Set(),
  markAsDeleted: (id) =>
    set((s) => {
      const newSet = new Set(s.deletedMediaIds);
      newSet.add(id);
      return { deletedMediaIds: newSet };
    }),
}));
