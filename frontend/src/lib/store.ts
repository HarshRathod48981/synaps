import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  viewerOpen: boolean;
  viewerMediaId: string | null;
  activeFilter: string | null;
  searchQuery: string;
  deletedMediaIds: Set<string>;

  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openViewer: (mediaId: string) => void;
  closeViewer: () => void;
  setFilter: (filter: string | null) => void;
  setSearchQuery: (query: string) => void;
  markAsDeleted: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  sidebarOpen: true,
  viewerOpen: false,
  viewerMediaId: null,
  activeFilter: null,
  searchQuery: '',
  deletedMediaIds: new Set(),

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openViewer: (mediaId) => set({ viewerOpen: true, viewerMediaId: mediaId }),
  closeViewer: () => set({ viewerOpen: false, viewerMediaId: null }),
  setFilter: (filter) => set({ activeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  markAsDeleted: (id) => set((s) => {
    const newSet = new Set(s.deletedMediaIds);
    newSet.add(id);
    return { deletedMediaIds: newSet };
  }),
}));
