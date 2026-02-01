import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUIStore.getState().reset();
  });

  it('initializes with default state', () => {
    const state = useUIStore.getState();

    expect(state.selectedSessionId).toBeNull();
    expect(state.selectedTaskId).toBeNull();
    expect(state.sidebarOpen).toBe(true);
    expect(state.filters).toEqual({
      timeRange: { from: '', to: '' },
      toolNames: [],
      taskStatus: [],
    });
  });

  it('sets selected session', () => {
    const { setSelectedSession } = useUIStore.getState();

    setSelectedSession('session-123');

    expect(useUIStore.getState().selectedSessionId).toBe('session-123');
  });

  it('clears selected session', () => {
    const { setSelectedSession } = useUIStore.getState();

    setSelectedSession('session-123');
    setSelectedSession(null);

    expect(useUIStore.getState().selectedSessionId).toBeNull();
  });

  it('sets selected task', () => {
    const { setSelectedTask } = useUIStore.getState();

    setSelectedTask('task-456');

    expect(useUIStore.getState().selectedTaskId).toBe('task-456');
  });

  it('clears selected task', () => {
    const { setSelectedTask } = useUIStore.getState();

    setSelectedTask('task-456');
    setSelectedTask(null);

    expect(useUIStore.getState().selectedTaskId).toBeNull();
  });

  it('updates filters partially', () => {
    const { setFilters } = useUIStore.getState();

    setFilters({ toolNames: ['Read', 'Write'] });

    expect(useUIStore.getState().filters.toolNames).toEqual(['Read', 'Write']);
    expect(useUIStore.getState().filters.timeRange).toEqual({ from: '', to: '' });
    expect(useUIStore.getState().filters.taskStatus).toEqual([]);
  });

  it('updates multiple filter properties', () => {
    const { setFilters } = useUIStore.getState();

    setFilters({
      timeRange: { from: '2026-01-01', to: '2026-01-31' },
      toolNames: ['Read'],
      taskStatus: ['completed'],
    });

    const filters = useUIStore.getState().filters;
    expect(filters.timeRange).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(filters.toolNames).toEqual(['Read']);
    expect(filters.taskStatus).toEqual(['completed']);
  });

  it('preserves existing filters when updating partial filters', () => {
    const { setFilters } = useUIStore.getState();

    setFilters({ toolNames: ['Read'] });
    setFilters({ taskStatus: ['in_progress'] });

    const filters = useUIStore.getState().filters;
    expect(filters.toolNames).toEqual(['Read']);
    expect(filters.taskStatus).toEqual(['in_progress']);
  });

  it('toggles sidebar', () => {
    const { toggleSidebar } = useUIStore.getState();

    expect(useUIStore.getState().sidebarOpen).toBe(true);

    toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);

    toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it('resets all state', () => {
    const { setSelectedSession, setSelectedTask, setFilters, toggleSidebar, reset } = useUIStore.getState();

    // Set some state
    setSelectedSession('session-123');
    setSelectedTask('task-456');
    setFilters({
      timeRange: { from: '2026-01-01', to: '2026-01-31' },
      toolNames: ['Read', 'Write'],
      taskStatus: ['completed'],
    });
    toggleSidebar(); // Set to false

    // Reset
    reset();

    // Verify reset state
    const state = useUIStore.getState();
    expect(state.selectedSessionId).toBeNull();
    expect(state.selectedTaskId).toBeNull();
    expect(state.sidebarOpen).toBe(true);
    expect(state.filters).toEqual({
      timeRange: { from: '', to: '' },
      toolNames: [],
      taskStatus: [],
    });
  });
});
