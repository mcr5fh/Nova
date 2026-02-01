import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionView } from './SessionView';

// Mock the hooks
vi.mock('@/api/hooks', () => ({
  useSessionSummary: vi.fn(() => ({
    data: {
      session_id: 'test-session',
      start_time: Date.now(),
      end_time: null,
      duration_ms: null,
      total_cost: 0.5,
      total_tokens: 1000,
      tool_calls: 10,
      files_modified: 3,
      errors: 0,
      tasks_completed: 5,
      tasks_in_progress: 2,
      tasks_failed: 0,
      tasks_pending: 1,
      top_tools: [],
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
    selectedSessionId: 'test-session',
  })),
}));

// Mock the components
vi.mock('@/components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock('@/components/TraceTable', () => ({
  TraceTable: () => <div data-testid="trace-table">TraceTable</div>,
}));

vi.mock('@/components/Analytics', () => ({
  CostChart: () => <div data-testid="cost-chart">CostChart</div>,
  TokenChart: () => <div data-testid="token-chart">TokenChart</div>,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('SessionView', () => {
  it('should render the Layout component', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SessionView />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('should render session summary stats', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SessionView />
      </QueryClientProvider>
    );

    expect(screen.getByText('Session Summary')).toBeInTheDocument();
  });

  it('should render the TraceTable component', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SessionView />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('trace-table')).toBeInTheDocument();
  });
});
