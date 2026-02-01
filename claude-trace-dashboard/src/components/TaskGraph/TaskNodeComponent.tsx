import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TaskNode } from "@/types/task";
import { getStatusColor, getStatusLabel, getStatusGlow } from "@/utils/task-utils";
import { Badge } from "@/components/ui/badge";

export const TaskNodeComponent = memo(({ data }: NodeProps) => {
  const task = data as TaskNode;
  const statusColor = getStatusColor(task.status);
  const statusLabel = getStatusLabel(task.status);
  const statusGlow = getStatusGlow(task.status);

  return (
    <div
      className={`
        relative glass rounded-lg shadow-lg min-w-[200px] max-w-[300px]
        animate-scale-in hover:scale-105 transition-all duration-300
        ${statusGlow}
      `}
    >
      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !w-3 !h-3 transition-transform hover:scale-125"
      />

      {/* Header with status badge */}
      <div className="flex items-center justify-between p-3 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse-glow`} />
          <span className="text-xs font-medium">{task.id}</span>
        </div>
        <Badge variant="outline" className="text-xs glass-strong">
          {task.size}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium line-clamp-2">{task.spec}</p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Status: {statusLabel}</span>
          <span className="font-mono">
            {task.attempts}/{task.maxAttempts}
          </span>
        </div>

        {task.workerModel && (
          <div className="text-xs text-muted-foreground font-mono">
            Model: {task.workerModel}
          </div>
        )}

        {task.telemetry && (
          <div className="flex gap-3 text-xs text-muted-foreground font-mono">
            <span>{task.telemetry.tokens.toLocaleString()} tokens</span>
            <span>${task.telemetry.cost.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !w-3 !h-3 transition-transform hover:scale-125"
      />
    </div>
  );
});

TaskNodeComponent.displayName = "TaskNodeComponent";
