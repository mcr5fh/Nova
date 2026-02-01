# TraceTable Component

A virtualized, sortable, filterable table for displaying Claude trace events using TanStack Table v8.

## Features

- ✅ **Virtualization** - Efficiently handles large datasets (1000+ traces) using `@tanstack/react-virtual`
- ✅ **Column Sorting** - Click column headers to sort ascending/descending
- ✅ **Column Filtering** - Built-in filters for tool name and event type
- ✅ **Row Click Handler** - Optional callback for trace selection
- ✅ **Responsive Design** - Uses Tailwind CSS with design system tokens
- ✅ **Type-Safe** - Full TypeScript support with API types

## Usage

```tsx
import { TraceTable } from '@/components/TraceTable';
import { TraceEvent } from '@/types/api';

function MyComponent() {
  const traces: TraceEvent[] = [...]; // Your trace data

  return (
    <TraceTable
      traces={traces}
      isLoading={false}
      onRowClick={(trace) => {
        console.log('Selected trace:', trace);
      }}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `traces` | `TraceEvent[]` | Required | Array of trace events to display |
| `isLoading` | `boolean` | `false` | Show loading state |
| `onRowClick` | `(trace: TraceEvent) => void` | `undefined` | Callback when row is clicked |

## Columns

The table displays the following columns:

1. **Time** - Timestamp in HH:MM:SS.mmm format (monospace font)
2. **Event Type** - Badge showing pre_tool_use, post_tool_use, or user_prompt
3. **Tool** - Tool name (Read, Write, Bash, etc.)
4. **Task ID** - Beads task identifier (e.g., NOV-123)
5. **Status** - Task status (pending, in_progress, completed, failed, blocked)
6. **Duration** - Formatted duration (ms, s, m, h)
7. **Cost** - Estimated cost in USD ($0.0000 format)
8. **Tokens In** - Input tokens count
9. **Tokens Out** - Output tokens count
10. **Span ID** - Short span ID (first 8 chars)

## Customizing Columns

To modify columns, edit `src/components/TraceTable/columns.tsx`:

```tsx
export const columns: ColumnDef<TraceEvent>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => {
      // Custom rendering
    },
    size: 120,
  },
  // Add more columns...
];
```

## Performance

- **Virtualization**: Only renders visible rows (default: 10 overscan)
- **Estimated Row Height**: 48px
- **Container Height**: 600px (scrollable)
- **Recommended Max**: 10,000 traces without performance degradation

## Filtering

The table includes two built-in filters:

1. **Tool Name Filter** - Text input for filtering by tool name
2. **Event Type Filter** - Dropdown for filtering by event type

To add more filters, use the `table.getColumn()` API:

```tsx
table.getColumn('task_status')?.setFilterValue('in_progress');
```

## Sorting

Click any column header to sort. The table supports:

- Single-column sorting
- Ascending/descending toggle
- Default sort: timestamp descending (newest first)

To change default sorting:

```tsx
const [sorting, setSorting] = useState<SortingState>([
  { id: 'task_id', desc: false }, // Sort by task_id ascending
]);
```

## Integration with React Query

Example with TanStack Query for real-time updates:

```tsx
import { useQuery } from '@tanstack/react-query';
import { TraceTable } from '@/components/TraceTable';
import { api } from '@/api/client';

function SessionTraces({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['traces', sessionId],
    queryFn: () => api.getTraces({ session_id: sessionId }),
  });

  return (
    <TraceTable
      traces={data?.traces || []}
      isLoading={isLoading}
    />
  );
}
```

## Styling

The component uses Tailwind CSS with design system tokens:

- `bg-bg-0`, `bg-bg-1` - Background colors
- `bg-card` - Card background
- `text-text-0`, `text-text-1`, `text-text-2` - Text hierarchy
- `border-border` - Border color
- `status-green`, `status-amber`, `status-red`, `status-gray` - Status colors

To customize styles, modify the Tailwind classes in `TraceTable.tsx`.

## Testing

Run the component in development mode:

```bash
npm run dev
```

The component will be displayed in the main App demo page at http://localhost:3000

## Dependencies

- `@tanstack/react-table` - Table state management
- `@tanstack/react-virtual` - Virtualization
- `react` - UI framework
- `tailwindcss` - Styling

## Files

```
src/components/TraceTable/
├── TraceTable.tsx    # Main component
├── columns.tsx       # Column definitions
├── index.ts          # Exports
└── README.md         # This file
```

## Future Enhancements

- [ ] Column visibility toggle
- [ ] Column reordering
- [ ] Export to CSV
- [ ] Pagination mode (alternative to virtualization)
- [ ] Row selection (checkboxes)
- [ ] Bulk actions
- [ ] Custom column templates
- [ ] Saved filter presets
