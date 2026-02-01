import { TaskTree } from './TaskTree';
import { TaskNode } from './types';

// Sample task data for demonstration
const sampleTasks: TaskNode[] = [
  {
    id: 'Nova-4f4',
    title: '[Epic] Implement Claude Trace Frontend Dashboard',
    type: 'epic',
    status: 'in_progress',
    priority: 2,
    assignee: 'Ruiters',
    created: '2026-01-31',
    updated: '2026-01-31',
    description: 'Build a comprehensive frontend dashboard for visualizing Claude trace data',
    children: [
      {
        id: 'Nova-4f4.1',
        title: 'Setup React + Vite project scaffolding',
        type: 'task',
        status: 'closed',
        priority: 2,
        assignee: 'Ruiters',
        created: '2026-01-31',
        updated: '2026-01-31',
        description: 'Initialize React project with Vite, TypeScript, and Tailwind',
        parentId: 'Nova-4f4',
      },
      {
        id: 'Nova-4f4.5',
        title: 'Implement TaskTree visualization with Mermaid and React Flow',
        type: 'task',
        status: 'in_progress',
        priority: 2,
        assignee: 'Ruiters',
        created: '2026-01-31',
        updated: '2026-01-31',
        description: 'Create TaskTree component with both static and interactive views',
        parentId: 'Nova-4f4',
        dependsOn: ['Nova-4f4.1'],
        blocks: ['Nova-4f4.9'],
      },
      {
        id: 'Nova-4f4.9',
        title: 'QA: Verify frontend implementation',
        type: 'task',
        status: 'open',
        priority: 2,
        created: '2026-01-31',
        updated: '2026-01-31',
        description: 'Test all components and verify functionality',
        parentId: 'Nova-4f4',
      },
    ],
  },
];

export function TaskTreeDemo() {
  const handleTaskClick = (taskId: string) => {
    console.log('Task clicked:', taskId);
    alert(`Clicked task: ${taskId}`);
  };

  const handleTaskHover = (taskId: string | null) => {
    console.log('Task hover:', taskId);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          TaskTree Component Demo
        </h1>

        <div className="bg-slate-800 rounded-lg p-6">
          <TaskTree
            tasks={sampleTasks}
            initialView="flow"
            onTaskClick={handleTaskClick}
            onTaskHover={handleTaskHover}
          />
        </div>

        <div className="mt-8 bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Features</h2>
          <ul className="list-disc list-inside text-slate-300 space-y-2">
            <li>Toggle between Mermaid static diagram and React Flow interactive graph</li>
            <li>Click on nodes to interact with tasks</li>
            <li>Hover over nodes in interactive mode</li>
            <li>Color-coded status: Green (closed), Yellow (in progress), Red (blocked), Gray (open)</li>
            <li>Task type icons: 📦 Epic, ✨ Feature, 🐛 Bug, 📋 Task</li>
            <li>Automatic layout with ELK algorithm</li>
            <li>Dependency visualization with dashed lines</li>
            <li>Minimap and zoom controls in interactive mode</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
