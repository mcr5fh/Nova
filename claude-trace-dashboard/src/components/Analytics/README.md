# Analytics Components

Recharts-based visualization components for Claude Trace Dashboard analytics.

## Components

### CostChart

Displays cost over time with dual y-axes showing daily cost and cumulative cost.

```tsx
import { CostChart } from '@/components/Analytics';

<CostChart traces={traceEvents} />
```

**Features:**
- Daily cost aggregation by date
- Cumulative cost tracking
- Dual y-axis for comparing daily vs cumulative
- Responsive container (300px height)
- Custom tooltips with formatted currency

### TokenChart

Stacked area chart showing token usage breakdown over time.

```tsx
import { TokenChart } from '@/components/Analytics';

<TokenChart traces={traceEvents} />
```

**Features:**
- Stacked areas for input/output/cache read/cache write tokens
- Automatic date-based aggregation
- Color-coded by token type using design system colors
- Y-axis formatted in thousands (K)
- Responsive container (300px height)

### ToolUsage

Horizontal bar chart with tool invocation counts and detailed breakdown table.

```tsx
import { ToolUsage } from '@/components/Analytics';

<ToolUsage traces={traceEvents} limit={10} />
```

**Props:**
- `traces` (required): Array of TraceEvent objects
- `limit` (optional): Maximum number of tools to display (default: 10)

**Features:**
- Sorted by invocation count (descending)
- Color-coded bars
- Summary table with count, cost, and token totals
- Monospace font for data values
- Responsive layout

## Usage Example

```tsx
import { CostChart, TokenChart, ToolUsage } from '@/components/Analytics';
import { useTraces } from '@/api/hooks';

function AnalyticsPage() {
  const { data } = useTraces({ session_id: 'abc123' });

  if (!data) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-card rounded-lg shadow-card p-6">
        <CostChart traces={data.traces} />
      </div>

      <div className="bg-card rounded-lg shadow-card p-6">
        <TokenChart traces={data.traces} />
      </div>

      <div className="col-span-2 bg-card rounded-lg shadow-card p-6">
        <ToolUsage traces={data.traces} limit={10} />
      </div>
    </div>
  );
}
```

## Design System Integration

All components use CSS variables from the design system:

- `--color-accent`, `--color-accent-2`: Primary chart colors
- `--color-status-*`: Status colors for different data series
- `--color-text-0/1/2`: Text hierarchy
- `--color-border`: Grid and borders
- `--color-card`: Tooltip backgrounds

Font families:
- **IBM Plex Mono**: Data values, axes, tables
- **Sora**: Chart titles, headers

## Data Requirements

All components expect `TraceEvent[]` with the following structure:

```typescript
interface TraceEvent {
  timestamp: number;  // Unix timestamp in milliseconds
  tool_name?: string;
  metrics: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
    estimated_cost?: number;
  };
  // ... other fields
}
```

## Empty State Handling

All charts gracefully handle empty data:
- No matching traces: Shows "No [type] data available" message
- All metrics undefined: Shows empty state
- Partial data: Renders available data only

## Performance Considerations

- Charts use `ResponsiveContainer` for automatic sizing
- Data is aggregated client-side (suitable for <10K traces)
- For larger datasets, consider server-side aggregation
- Memoize trace data to prevent unnecessary re-renders

## Testing

See `AnalyticsDemo.tsx` for a complete example with mock data generation.

```bash
npm run dev
# Visit http://localhost:3000 to see the demo
```
