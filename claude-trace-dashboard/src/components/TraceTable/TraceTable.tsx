import { useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TraceEvent } from '@/types/api';
import { columns } from './columns';

interface TraceTableProps {
  traces: TraceEvent[];
  isLoading?: boolean;
  onRowClick?: (trace: TraceEvent) => void;
}

/**
 * TraceTable - Virtualized table for displaying trace events
 *
 * Features:
 * - Virtualized rendering for performance with large datasets
 * - Column sorting
 * - Column filtering
 * - Row click handler
 */
export function TraceTable({ traces, isLoading = false, onRowClick }: TraceTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'timestamp', desc: true }, // Default: newest first
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: traces,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Estimated row height in pixels
    overscan: 10, // Number of items to render outside visible area
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1].end
      : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-2">
        Loading traces...
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-2">
        No traces found
      </div>
    );
  }

  return (
    <div className="trace-table-container">
      {/* Filter Controls */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Filter by tool name..."
          className="px-3 py-2 border border-border rounded text-sm"
          onChange={(e) => {
            table.getColumn('tool_name')?.setFilterValue(e.target.value);
          }}
        />
        <select
          className="px-3 py-2 border border-border rounded text-sm"
          onChange={(e) => {
            const value = e.target.value;
            table.getColumn('event_type')?.setFilterValue(value === 'all' ? '' : value);
          }}
        >
          <option value="all">All Event Types</option>
          <option value="pre_tool_use">Pre Tool Use</option>
          <option value="post_tool_use">Post Tool Use</option>
          <option value="user_prompt">User Prompt</option>
        </select>
      </div>

      {/* Table */}
      <div
        ref={parentRef}
        className="overflow-auto border border-border rounded-lg"
        style={{ height: '600px' }}
      >
        <table className="w-full text-sm">
          <thead className="bg-bg-1 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-text-1 border-b border-border"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? 'cursor-pointer select-none flex items-center gap-2'
                            : ''
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: ' ↑',
                          desc: ' ↓',
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  className={`
                    border-b border-border hover:bg-bg-1 transition-colors
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `}
                  onClick={() => onRowClick?.(row.original)}
                  data-index={virtualRow.index}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="mt-2 text-xs text-text-2">
        Showing {rows.length} of {traces.length} traces
      </div>
    </div>
  );
}
