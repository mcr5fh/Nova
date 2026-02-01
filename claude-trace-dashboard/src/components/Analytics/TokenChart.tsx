import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TraceEvent } from '@/types/api';

interface TokenChartProps {
  traces: TraceEvent[];
}

interface TokenDataPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  total: number;
}

export function TokenChart({ traces }: TokenChartProps) {
  // Aggregate token usage over time
  const data: TokenDataPoint[] = traces
    .filter((t) => t.metrics && (
      t.metrics.input_tokens ||
      t.metrics.output_tokens ||
      t.metrics.cache_read_tokens ||
      t.metrics.cache_write_tokens
    ))
    .reduce((acc, trace) => {
      const date = new Date(trace.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
      const existingIndex = acc.findIndex((d) => d.date === date);

      const inputTokens = trace.metrics.input_tokens || 0;
      const outputTokens = trace.metrics.output_tokens || 0;
      const cacheReadTokens = trace.metrics.cache_read_tokens || 0;
      const cacheWriteTokens = trace.metrics.cache_write_tokens || 0;

      if (existingIndex !== -1) {
        acc[existingIndex].inputTokens += inputTokens;
        acc[existingIndex].outputTokens += outputTokens;
        acc[existingIndex].cacheReadTokens += cacheReadTokens;
        acc[existingIndex].cacheWriteTokens += cacheWriteTokens;
        acc[existingIndex].total += inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
      } else {
        acc.push({
          date,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          total: inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens,
        });
      }

      return acc;
    }, [] as TokenDataPoint[])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-text-2">
        No token data available
      </div>
    );
  }

  return (
    <div className="token-chart">
      <h3 className="text-base font-semibold mb-4 text-text-0">Token Usage Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            stroke="var(--color-text-2)"
            style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <YAxis
            stroke="var(--color-text-2)"
            label={{
              value: 'Tokens',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: '13px', fill: 'var(--color-text-1)' },
            }}
            style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              fontSize: '13px',
            }}
            formatter={(value: number) => `${(value / 1000).toFixed(1)}K`}
          />
          <Legend
            wrapperStyle={{ fontSize: '13px' }}
          />
          <Area
            type="monotone"
            dataKey="inputTokens"
            stackId="1"
            stroke="var(--color-accent)"
            fill="var(--color-accent)"
            fillOpacity={0.6}
            name="Input Tokens"
          />
          <Area
            type="monotone"
            dataKey="outputTokens"
            stackId="1"
            stroke="var(--color-accent-2)"
            fill="var(--color-accent-2)"
            fillOpacity={0.6}
            name="Output Tokens"
          />
          <Area
            type="monotone"
            dataKey="cacheReadTokens"
            stackId="1"
            stroke="var(--color-status-green)"
            fill="var(--color-status-green)"
            fillOpacity={0.6}
            name="Cache Read"
          />
          <Area
            type="monotone"
            dataKey="cacheWriteTokens"
            stackId="1"
            stroke="var(--color-status-amber)"
            fill="var(--color-status-amber)"
            fillOpacity={0.6}
            name="Cache Write"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
