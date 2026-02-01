'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { ViewLevel, DashboardMode, NavigationState, NavigationContextValue } from '@/types';

const NavigationContext = createContext<NavigationContextValue | null>(null);

function getInitialState(): NavigationState {
  // Default state for SSR
  const defaultState: NavigationState = {
    currentView: 'l0',
    selectedL1: null,
    selectedL2: null,
    selectedTaskId: null,
    mode: 'cascade',
    epicId: null,
  };

  // Only access localStorage on the client
  if (typeof window === 'undefined') {
    return defaultState;
  }

  const savedMode = localStorage.getItem('dashboard-mode') as DashboardMode | null;
  const savedEpicId = localStorage.getItem('selected-epic');

  return {
    ...defaultState,
    mode: savedMode || 'cascade',
    epicId: savedEpicId,
  };
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavigationState>(getInitialState);
  const isFirstRender = useRef(true);

  // Persist mode to localStorage (skip first render to avoid writing default values)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem('dashboard-mode', state.mode);
  }, [state.mode]);

  // Persist epicId to localStorage
  useEffect(() => {
    if (state.epicId) {
      localStorage.setItem('selected-epic', state.epicId);
    } else {
      localStorage.removeItem('selected-epic');
    }
  }, [state.epicId]);

  const showView = useCallback((view: ViewLevel, l1?: string, l2?: string, taskId?: string) => {
    setState(prev => ({
      ...prev,
      currentView: view,
      selectedL1: l1 ?? null,
      selectedL2: l2 ?? null,
      selectedTaskId: taskId ?? null,
    }));
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      switch (prev.currentView) {
        case 'l3':
          return { ...prev, currentView: 'l2' as ViewLevel, selectedTaskId: null };
        case 'l2':
          return { ...prev, currentView: 'l1' as ViewLevel, selectedL2: null };
        case 'l1':
          return { ...prev, currentView: 'l0' as ViewLevel, selectedL1: null };
        default:
          return prev;
      }
    });
  }, []);

  const setMode = useCallback((mode: DashboardMode) => {
    setState(prev => ({
      ...prev,
      mode,
      // Reset navigation when switching modes
      currentView: 'l0',
      selectedL1: null,
      selectedL2: null,
      selectedTaskId: null,
    }));
  }, []);

  const setEpicId = useCallback((epicId: string | null) => {
    setState(prev => ({
      ...prev,
      epicId,
      // Reset navigation when switching epics
      currentView: 'l0',
      selectedL1: null,
      selectedL2: null,
      selectedTaskId: null,
    }));
  }, []);

  const value: NavigationContextValue = {
    ...state,
    showView,
    goBack,
    setMode,
    setEpicId,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
