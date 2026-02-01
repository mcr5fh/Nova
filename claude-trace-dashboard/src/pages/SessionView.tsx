import { Layout } from '@/components/Layout';
import { TraceTable } from '@/components/TraceTable';
import { CostChart, TokenChart } from '@/components/Analytics';
import { useSessionSummary, useTraces, useTraceStream } from '@/api/hooks';
import { useUIStore } from '@/stores/uiStore';

/**
 * SessionView - Detailed view for a specific session
 *
 * Features:
 * - Session summary with key metrics
 * - Session-specific trace table
 * - Session analytics charts
 * - Real-time updates for the session
 */
export function SessionView() {
  const { selectedSessionId } = useUIStore();

  const { data: sessionSummary, isLoading: summaryLoading } = useSessionSummary(
    selectedSessionId || ''
  );

  const { data: tracesData, isLoading: tracesLoading } = useTraces({
    session_id: selectedSessionId || undefined,
  });

  // Enable real-time streaming for this session
  useTraceStream({
    sessionId: selectedSessionId || undefined,
    enabled: !!selectedSessionId,
  });

  const traces = tracesData?.traces || [];

  if (!selectedSessionId) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-64">
          <p className="text-text-2">No session selected</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-0">Session Summary</h1>
          <p className="text-sm text-text-2 mt-1 font-mono">{selectedSessionId}</p>
        </div>

        {/* Summary Stats Grid */}
        {summaryLoading ? (
          <div className="text-text-2">Loading session summary...</div>
        ) : sessionSummary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                Total Cost
              </p>
              <p className="text-2xl font-bold text-text-0">
                ${sessionSummary.total_cost.toFixed(4)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                Total Tokens
              </p>
              <p className="text-2xl font-bold text-text-0">
                {sessionSummary.total_tokens.toLocaleString()}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                Tool Calls
              </p>
              <p className="text-2xl font-bold text-text-0">
                {sessionSummary.tool_calls}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                Files Modified
              </p>
              <p className="text-2xl font-bold text-text-0">
                {sessionSummary.files_modified}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                Tasks Completed
              </p>
              <p className="text-2xl font-bold text-status-green">
                {sessionSummary.tasks_completed}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                In Progress
              </p>
              <p className="text-2xl font-bold text-status-amber">
                {sessionSummary.tasks_in_progress}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                Failed
              </p>
              <p className="text-2xl font-bold text-status-red">
                {sessionSummary.tasks_failed}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-text-2 uppercase tracking-wide mb-1">
                Errors
              </p>
              <p className="text-2xl font-bold text-status-red">
                {sessionSummary.errors}
              </p>
            </div>
          </div>
        ) : null}

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <CostChart traces={traces} />
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <TokenChart traces={traces} />
          </div>
        </div>

        {/* Session Traces */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-text-0 mb-4">
            Session Traces
          </h2>
          <TraceTable traces={traces} isLoading={tracesLoading} />
        </div>
      </div>
    </Layout>
  );
}
