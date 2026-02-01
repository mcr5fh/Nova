import { useState } from 'react';
import { TaskTreeProps } from './types';
import { MermaidView } from './MermaidView';
import { FlowView } from './FlowView';

export function TaskTree({
  tasks,
  initialView = 'flow',
  onTaskClick,
  onTaskHover,
}: TaskTreeProps) {
  const [view, setView] = useState<'mermaid' | 'flow'>(initialView);

  return (
    <div className="task-tree w-full">
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4 px-4">
        <h2 className="text-xl font-semibold text-white">Task Tree</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView('mermaid')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'mermaid'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Static Diagram
          </button>
          <button
            onClick={() => setView('flow')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'flow'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Interactive Graph
          </button>
        </div>
      </div>

      {/* Task Count */}
      <div className="px-4 mb-4 text-sm text-slate-400">
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </div>

      {/* View Content */}
      <div className="px-4">
        {view === 'mermaid' ? (
          <MermaidView tasks={tasks} onTaskClick={onTaskClick} />
        ) : (
          <FlowView
            tasks={tasks}
            onTaskClick={onTaskClick}
            onTaskHover={onTaskHover}
          />
        )}
      </div>
    </div>
  );
}
