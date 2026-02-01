import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { TraceEvent } from '@/types/api';

interface ToolUsageProps {
  traces: TraceEvent[];
  limit?: number;
}

interface ToolUsageDataPoint {
  tool: string;
  count: number;
  totalCost: number;
  totalTokens: number;
}

const TOOL_COLORS = [
  'var(--color-accent)',
  'var(--color-accent-2)',
  'var(--color-status-green)',
  'var(--color-status-amber)',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c',
  '#a78bfa',
  '#f472b6',
];

export function ToolUsage({ traces, limit = 10 }: ToolUsageProps) {
  // Aggregate tool usage
  const toolMap = traces
    .filter((t) => t.tool_name)
    .reduce((acc, trace) => {
      const toolName = trace.tool_name || 'Unknown';

      if (!acc[toolName]) {
        acc[toolName] = {
          tool: toolName,
          count: 0,
          totalCost: 0,
          totalTokens: 0,
        };
      }

      acc[toolName].count += 1;
      acc[toolName].totalCost += trace.metrics?.estimated_cost || 0;
      acc[toolName].totalTokens += (trace.metrics?.input_tokens || 0) + (trace.metrics?.output_tokens || 0);

      return acc;
    }, {} as Record<string, ToolUsageDataPoint>);

  const data = Object.values(toolMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-text-2">
        No tool usage data available
      </div>
    );
  }

  return (
    <div className="tool-usage-chart">
      <h3 className="text-base font-semibold mb-4 text-text-0">Tool Usage Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            type="number"
            stroke="var(--color-text-2)"
            style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <YAxis
            type="category"
            dataKey="tool"
            stroke="var(--color-text-2)"
            width={100}
            style={{ fontSize: '13px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              fontSize: '13px',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'count') return [value, 'Invocations'];
              if (name === 'totalCost') return [`$${value.toFixed(4)}`, 'Total Cost'];
              if (name === 'totalTokens') return [`${(value / 1000).toFixed(1)}K`, 'Total Tokens'];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '13px' }}
          />
          <Bar dataKey="count" name="Invocations" radius={[0, 4, 4, 0]}>
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={TOOL_COLORS[index % TOOL_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary table */}
      <div className="mt-4 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-text-1 font-medium">Tool</th>
              <th className="text-right py-2 px-2 text-text-1 font-medium">Count</th>
              <th className="text-right py-2 px-2 text-text-1 font-medium">Cost</th>
              <th className="text-right py-2 px-2 text-text-1 font-medium">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={item.tool} className="border-b border-border/50">
                <td className="py-2 px-2">
                  <span className="inline-block w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: TOOL_COLORS[index % TOOL_COLORS.length] }} />
                  <span className="font-mono">{item.tool}</span>
                </td>
                <td className="text-right py-2 px-2 font-mono text-text-1">{item.count}</td>
                <td className="text-right py-2 px-2 font-mono text-text-1">${item.totalCost.toFixed(4)}</td>
                <td className="text-right py-2 px-2 font-mono text-text-1">{(item.totalTokens / 1000).toFixed(1)}K</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
