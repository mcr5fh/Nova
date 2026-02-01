import { create } from 'zustand';

interface UIState {
  // Selected items
  selectedSessionId: string | null;
  selectedTaskId: string | null;

  // Filters
  filters: {
    timeRange: { from: string; to: string };
    toolNames: string[];
    taskStatus: string[];
  };

  // UI state
  sidebarOpen: boolean;

  // Actions
  setSelectedSession: (id: string | null) => void;
  setSelectedTask: (id: string | null) => void;
  setFilters: (filters: Partial<UIState['filters']>) => void;
  toggleSidebar: () => void;
  reset: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedSessionId: null,
  selectedTaskId: null,
  filters: {
    timeRange: { from: '', to: '' },
    toolNames: [],
    taskStatus: [],
  },
  sidebarOpen: true,

  setSelectedSession: (id) => set({ selectedSessionId: id }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  reset: () =>
    set({
      selectedSessionId: null,
      selectedTaskId: null,
      filters: { timeRange: { from: '', to: '' }, toolNames: [], taskStatus: [] },
      sidebarOpen: true,
    }),
}));
