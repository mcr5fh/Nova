import { Layout } from '@/components/Layout';
import { TraceTable } from '@/components/TraceTable';
import { CostChart, TokenChart, ToolUsage } from '@/components/Analytics';
import { useTraces, useTraceStream } from '@/api/hooks';
import { useUIStore } from '@/stores/uiStore';

/**
 * Dashboard - Main page for Claude Trace Dashboard
 *
 * Features:
 * - Real-time trace table with all events
 * - Analytics charts (cost, tokens, tool usage)
 * - Live updates via SSE
 */
export function Dashboard() {
  const { filters } = useUIStore();
  const { data, isLoading } = useTraces({
    from: filters.timeRange.from || undefined,
    to: filters.timeRange.to || undefined,
  });

  // Enable real-time streaming
  useTraceStream({ enabled: true });

  const traces = data?.traces || [];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-0">Dashboard</h1>
            <p className="text-sm text-text-2 mt-1">
              Monitor Claude Code execution traces and analytics
            </p>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <CostChart traces={traces} />
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <TokenChart traces={traces} />
          </div>
          <div className="bg-card border border-border rounded-lg p-6 lg:col-span-2">
            <ToolUsage traces={traces} />
          </div>
        </div>

        {/* Trace Table */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-text-0 mb-4">Recent Traces</h2>
          <TraceTable traces={traces} isLoading={isLoading} />
        </div>
      </div>
    </Layout>
  );
}
