import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { TaskNode } from './types';

interface TaskNodeData {
  task: TaskNode;
  icon: string;
  color: string;
}

export const TaskNodeComponent = memo(({ data }: NodeProps<TaskNodeData>) => {
  const { task, icon, color } = data;

  return (
    <div
      className="task-node px-4 py-3 rounded-lg border-2 shadow-md bg-slate-800 min-w-[200px] max-w-[250px]"
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-slate-400 mb-1">{task.id}</div>
          <div className="text-sm font-semibold text-white leading-tight line-clamp-2">
            {task.title}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className="px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: color, color: '#fff' }}
            >
              {task.status}
            </span>
            <span className="text-slate-400">P{task.priority}</span>
          </div>
          {task.assignee && (
            <div className="mt-1 text-xs text-slate-400 truncate">
              {task.assignee}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});

TaskNodeComponent.displayName = 'TaskNodeComponent';
