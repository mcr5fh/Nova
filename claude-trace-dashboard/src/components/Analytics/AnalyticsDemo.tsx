/**
 * Analytics Demo Page
 *
 * Demonstrates all analytics charts with mock data
 */

import { CostChart } from './CostChart';
import { TokenChart } from './TokenChart';
import { ToolUsage } from './ToolUsage';
import type { TraceEvent } from '@/types/api';

// Generate more realistic mock data for better visualization
function generateExtendedMockData(): TraceEvent[] {
  const tools = ['Read', 'Edit', 'Bash', 'Task', 'Glob', 'Write', 'Grep'];
  const traces: TraceEvent[] = [];
  const now = Date.now();

  // Generate data for the last 7 days
  for (let day = 0; day < 7; day++) {
    const dayStart = now - (day * 24 * 60 * 60 * 1000);

    // Generate 5-15 events per day
    const eventsPerDay = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < eventsPerDay; i++) {
      const tool = tools[Math.floor(Math.random() * tools.length)];
      const inputTokens = Math.floor(Math.random() * 500) + 100;
      const outputTokens = Math.floor(Math.random() * 300) + 50;
      const cacheReadTokens = Math.random() > 0.7 ? Math.floor(Math.random() * 200) : 0;
      const cacheWriteTokens = Math.random() > 0.8 ? Math.floor(Math.random() * 100) : 0;

      traces.push({
        span_id: `span-${day}-${i}`,
        trace_id: `trace-${day}`,
        parent_id: i > 0 ? `span-${day}-${i - 1}` : null,
        session_id: 'session-demo',
        task_id: `Nova-${100 + day}`,
        task_status: 'in_progress',
        timestamp: dayStart + (i * 60000), // Space events by 1 minute
        duration_ms: Math.floor(Math.random() * 5000) + 500,
        event_type: 'post_tool_use',
        hook_type: 'PostToolUse',
        tool_name: tool,
        tool_input: null,
        tool_output: null,
        metrics: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheReadTokens,
          cache_write_tokens: cacheWriteTokens,
          estimated_cost: (inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens) * 0.000015,
          files_read: tool === 'Read' ? 1 : 0,
          files_edited: tool === 'Edit' ? 1 : 0,
          files_written: tool === 'Write' ? 1 : 0,
        },
        tags: {},
        metadata: {},
      });
    }
  }

  return traces.sort((a, b) => a.timestamp - b.timestamp);
}

export function AnalyticsDemo() {
  const traces = generateExtendedMockData();

  // Calculate summary stats
  const totalCost = traces.reduce((sum, t) => sum + (t.metrics?.estimated_cost || 0), 0);
  const totalTokens = traces.reduce((sum, t) =>
    sum + (t.metrics?.input_tokens || 0) + (t.metrics?.output_tokens || 0) +
    (t.metrics?.cache_read_tokens || 0) + (t.metrics?.cache_write_tokens || 0), 0
  );
  const totalTools = new Set(traces.map(t => t.tool_name)).size;

  return (
    <div className="min-h-screen bg-bg-0 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-0 mb-2">Analytics Dashboard</h1>
          <p className="text-sm text-text-2">
            Visualizing trace data with Recharts
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-lg shadow-card p-6">
            <div className="text-xs text-text-2 uppercase tracking-wide mb-1">Total Cost</div>
            <div className="text-2xl font-semibold text-text-0 font-mono">
              ${totalCost.toFixed(4)}
            </div>
            <div className="text-xs text-text-2 mt-1">{traces.length} traces</div>
          </div>

          <div className="bg-card rounded-lg shadow-card p-6">
            <div className="text-xs text-text-2 uppercase tracking-wide mb-1">Total Tokens</div>
            <div className="text-2xl font-semibold text-text-0 font-mono">
              {(totalTokens / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-text-2 mt-1">
              Avg: {Math.floor(totalTokens / traces.length)} per trace
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-card p-6">
            <div className="text-xs text-text-2 uppercase tracking-wide mb-1">Tools Used</div>
            <div className="text-2xl font-semibold text-text-0 font-mono">
              {totalTools}
            </div>
            <div className="text-xs text-text-2 mt-1">Unique tool types</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Chart */}
          <div className="bg-card rounded-lg shadow-card p-6">
            <CostChart traces={traces} />
          </div>

          {/* Token Chart */}
          <div className="bg-card rounded-lg shadow-card p-6">
            <TokenChart traces={traces} />
          </div>

          {/* Tool Usage - Full Width */}
          <div className="lg:col-span-2 bg-card rounded-lg shadow-card p-6">
            <ToolUsage traces={traces} limit={10} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-text-2">
          <p>Demo using {traces.length} mock trace events over 7 days</p>
        </div>
      </div>
    </div>
  );
}
