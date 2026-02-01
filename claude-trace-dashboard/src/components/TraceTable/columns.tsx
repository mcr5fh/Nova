import { ColumnDef } from '@tanstack/react-table';
import { TraceEvent } from '@/types/api';

/**
 * Column definitions for TraceTable
 */
export const columns: ColumnDef<TraceEvent>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => {
      const timestamp = row.original.timestamp;
      const date = new Date(timestamp);
      return (
        <div className="font-mono text-xs text-text-1">
          {date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
          <span className="text-text-2 ml-1">
            .{date.getMilliseconds().toString().padStart(3, '0')}
          </span>
        </div>
      );
    },
    size: 120,
  },
  {
    accessorKey: 'event_type',
    header: 'Event Type',
    cell: ({ row }) => {
      const eventType = row.original.event_type;
      const colorMap: Record<string, string> = {
        pre_tool_use: 'text-status-amber bg-status-amber/10',
        post_tool_use: 'text-status-green bg-status-green/10',
        user_prompt: 'text-accent bg-accent/10',
      };
      const color = colorMap[eventType] || 'text-status-gray bg-status-gray/10';

      return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
          {eventType.replace(/_/g, ' ')}
        </span>
      );
    },
    size: 140,
  },
  {
    accessorKey: 'tool_name',
    header: 'Tool',
    cell: ({ row }) => {
      const toolName = row.original.tool_name;
      return (
        <div className="font-medium text-text-0">
          {toolName || <span className="text-text-2 italic">-</span>}
        </div>
      );
    },
    size: 120,
  },
  {
    accessorKey: 'task_id',
    header: 'Task ID',
    cell: ({ row }) => {
      const taskId = row.original.task_id;
      return (
        <div className="font-mono text-xs text-text-1">
          {taskId || <span className="text-text-2 italic">-</span>}
        </div>
      );
    },
    size: 120,
  },
  {
    accessorKey: 'task_status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.task_status;
      if (!status) {
        return <span className="text-text-2 italic text-xs">-</span>;
      }

      const colorMap: Record<string, string> = {
        pending: 'text-status-gray',
        in_progress: 'text-status-amber',
        completed: 'text-status-green',
        failed: 'text-status-red',
        blocked: 'text-status-red',
      };
      const color = colorMap[status] || 'text-status-gray';

      return (
        <span className={`text-xs font-medium ${color}`}>
          {status.replace(/_/g, ' ')}
        </span>
      );
    },
    size: 100,
  },
  {
    accessorKey: 'duration_ms',
    header: 'Duration',
    cell: ({ row }) => {
      const duration = row.original.duration_ms;
      if (!duration) {
        return <span className="text-text-2 italic text-xs">-</span>;
      }

      const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
        return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
      };

      return (
        <div className="font-mono text-xs text-text-1">
          {formatDuration(duration)}
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: 'metrics.estimated_cost',
    header: 'Cost',
    cell: ({ row }) => {
      const cost = row.original.metrics?.estimated_cost;
      if (cost === undefined || cost === null) {
        return <span className="text-text-2 italic text-xs">-</span>;
      }

      return (
        <div className="font-mono text-xs text-text-1">
          ${cost.toFixed(4)}
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: 'metrics.input_tokens',
    header: 'Tokens In',
    cell: ({ row }) => {
      const tokens = row.original.metrics?.input_tokens;
      if (!tokens) {
        return <span className="text-text-2 italic text-xs">-</span>;
      }

      return (
        <div className="font-mono text-xs text-text-1">
          {tokens.toLocaleString()}
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: 'metrics.output_tokens',
    header: 'Tokens Out',
    cell: ({ row }) => {
      const tokens = row.original.metrics?.output_tokens;
      if (!tokens) {
        return <span className="text-text-2 italic text-xs">-</span>;
      }

      return (
        <div className="font-mono text-xs text-text-1">
          {tokens.toLocaleString()}
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: 'span_id',
    header: 'Span ID',
    cell: ({ row }) => {
      const spanId = row.original.span_id;
      const shortId = spanId.substring(0, 8);

      return (
        <div className="font-mono text-xs text-text-2" title={spanId}>
          {shortId}...
        </div>
      );
    },
    size: 100,
  },
];
