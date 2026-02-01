import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TraceEvent } from '@/types/api';

interface CostChartProps {
  traces: TraceEvent[];
}

interface CostDataPoint {
  date: string;
  cost: number;
  cumulativeCost: number;
}

export function CostChart({ traces }: CostChartProps) {
  // Aggregate cost over time
  const data: CostDataPoint[] = traces
    .filter((t) => t.metrics?.estimated_cost)
    .reduce((acc, trace) => {
      const date = new Date(trace.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
      const existingIndex = acc.findIndex((d) => d.date === date);

      if (existingIndex !== -1) {
        acc[existingIndex].cost += trace.metrics.estimated_cost || 0;
      } else {
        acc.push({
          date,
          cost: trace.metrics.estimated_cost || 0,
          cumulativeCost: 0,
        });
      }

      return acc;
    }, [] as CostDataPoint[])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate cumulative cost
  let cumulative = 0;
  data.forEach((point) => {
    cumulative += point.cost;
    point.cumulativeCost = cumulative;
  });

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-text-2">
        No cost data available
      </div>
    );
  }

  return (
    <div className="cost-chart">
      <h3 className="text-base font-semibold mb-4 text-text-0">Cost Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            stroke="var(--color-text-2)"
            style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <YAxis
            yAxisId="left"
            stroke="var(--color-text-2)"
            label={{
              value: 'Daily Cost ($)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: '13px', fill: 'var(--color-text-1)' },
            }}
            style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="var(--color-text-2)"
            label={{
              value: 'Cumulative ($)',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: '13px', fill: 'var(--color-text-1)' },
            }}
            style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              fontSize: '13px',
            }}
            formatter={(value: number) => `$${value.toFixed(4)}`}
          />
          <Legend
            wrapperStyle={{ fontSize: '13px' }}
            iconType="line"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="cost"
            stroke="var(--color-accent)"
            strokeWidth={2}
            name="Daily Cost"
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulativeCost"
            stroke="var(--color-accent-2)"
            strokeWidth={2}
            name="Cumulative Cost"
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
