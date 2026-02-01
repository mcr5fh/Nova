export type ViewLevel = 'l0' | 'l1' | 'l2' | 'l3';
export type DashboardMode = 'cascade' | 'bead';

export interface NavigationState {
  currentView: ViewLevel;
  selectedL1: string | null;
  selectedL2: string | null;
  selectedTaskId: string | null;
  mode: DashboardMode;
  epicId: string | null;
}

export interface NavigationContextValue extends NavigationState {
  showView: (view: ViewLevel, l1?: string, l2?: string, taskId?: string) => void;
  goBack: () => void;
  setMode: (mode: DashboardMode) => void;
  setEpicId: (epicId: string | null) => void;
}
