import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskDetail } from './TaskDetail';

// Mock the hooks
vi.mock('@/api/hooks', () => ({
  useTask: vi.fn(() => ({
    data: {
      task_id: 'test-task',
      parent_task_id: null,
      task_description: 'Test task description',
      status: 'in_progress',
      start_time: Date.now(),
      end_time: null,
      duration_ms: null,
      total_tokens: 500,
      total_cost: 0.25,
      tool_calls: 5,
      files_modified: 1,
    },
    isLoading: false,
    error: null,
  })),
  useTaskTree: vi.fn(() => ({
    data: {
      task_id: 'test-task',
      parent_task_id: null,
      children: [],
      summary: {
        task_id: 'test-task',
        parent_task_id: null,
        task_description: 'Test task',
        status: 'in_progress',
        start_time: Date.now(),
        end_time: null,
        duration_ms: null,
        total_tokens: 500,
        total_cost: 0.25,
        tool_calls: 5,
        files_modified: 1,
      },
    },
    isLoading: false,
    error: null,
  })),
  useTraces: vi.fn(() => ({
    data: { traces: [], total: 0, limit: 50, offset: 0 },
    isLoading: false,
    error: null,
  })),
  useTraceStream: vi.fn(),
}));

// Mock the UI store
vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    selectedTaskId: 'test-task',
  })),
}));

// Mock the components
vi.mock('@/components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock('@/components/TaskTree', () => ({
  TaskTree: () => <div data-testid="task-tree">TaskTree</div>,
}));

vi.mock('@/components/TraceTable', () => ({
  TraceTable: () => <div data-testid="trace-table">TraceTable</div>,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('TaskDetail', () => {
  it('should render the Layout component', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TaskDetail />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('should render task summary', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TaskDetail />
      </QueryClientProvider>
    );

    expect(screen.getByText('Task Details')).toBeInTheDocument();
  });

  it('should render TaskTree component', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TaskDetail />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('task-tree')).toBeInTheDocument();
  });

  it('should render the TraceTable component', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TaskDetail />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('trace-table')).toBeInTheDocument();
  });
});
