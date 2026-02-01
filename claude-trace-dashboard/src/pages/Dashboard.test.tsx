import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './Dashboard';

// Mock the hooks
vi.mock('@/api/hooks', () => ({
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
    selectedSessionId: null,
    filters: {
      timeRange: { from: '', to: '' },
      toolNames: [],
      taskStatus: [],
    },
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
  ToolUsage: () => <div data-testid="tool-usage">ToolUsage</div>,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('Dashboard', () => {
  it('should render the Layout component', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('should render the TraceTable component', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('trace-table')).toBeInTheDocument();
  });

  it('should render analytics charts', () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('cost-chart')).toBeInTheDocument();
    expect(screen.getByTestId('token-chart')).toBeInTheDocument();
    expect(screen.getByTestId('tool-usage')).toBeInTheDocument();
  });
});
