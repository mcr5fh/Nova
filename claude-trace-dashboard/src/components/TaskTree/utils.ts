import { TaskNode, TaskStatus } from './types';

/**
 * Get CSS class for task status
 */
export function getStatusClass(status: TaskStatus): string {
  switch (status) {
    case 'closed':
      return 'status-closed';
    case 'in_progress':
      return 'status-in-progress';
    case 'blocked':
      return 'status-blocked';
    case 'open':
    default:
      return 'status-open';
  }
}

/**
 * Get color for task status (for React Flow)
 */
export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'closed':
      return '#22c55e'; // green-500
    case 'in_progress':
      return '#eab308'; // yellow-500
    case 'blocked':
      return '#ef4444'; // red-500
    case 'open':
    default:
      return '#94a3b8'; // slate-400
  }
}

/**
 * Get emoji/icon for task type
 */
export function getTaskTypeIcon(type: string): string {
  switch (type) {
    case 'epic':
      return '📦';
    case 'feature':
      return '✨';
    case 'bug':
      return '🐛';
    case 'task':
    default:
      return '📋';
  }
}

/**
 * Build Mermaid diagram syntax from task tree
 */
export function buildMermaidDiagram(tasks: TaskNode[]): string {
  const lines: string[] = ['graph TD'];

  // Create a map for quick lookups
  const taskMap = new Map<string, TaskNode>();
  tasks.forEach(task => taskMap.set(task.id, task));

  // Add nodes
  tasks.forEach(task => {
    const icon = getTaskTypeIcon(task.type);
    const label = `${icon} ${task.id}: ${task.title}`;
    const statusClass = getStatusClass(task.status);
    lines.push(`  ${task.id}["${label}"]:::${statusClass}`);
  });

  // Add edges (parent-child relationships)
  tasks.forEach(task => {
    if (task.children && task.children.length > 0) {
      task.children.forEach(child => {
        lines.push(`  ${task.id} --> ${child.id}`);
      });
    }
  });

  // Add dependency edges (dashed lines)
  tasks.forEach(task => {
    if (task.dependsOn && task.dependsOn.length > 0) {
      task.dependsOn.forEach(depId => {
        lines.push(`  ${depId} -.->|depends| ${task.id}`);
      });
    }
  });

  // Add styles
  lines.push('  classDef status-closed fill:#22c55e,stroke:#16a34a,color:#fff');
  lines.push('  classDef status-in-progress fill:#eab308,stroke:#ca8a04,color:#000');
  lines.push('  classDef status-blocked fill:#ef4444,stroke:#dc2626,color:#fff');
  lines.push('  classDef status-open fill:#94a3b8,stroke:#64748b,color:#fff');

  return lines.join('\n');
}

/**
 * Flatten task tree into array (depth-first traversal)
 */
export function flattenTaskTree(tasks: TaskNode[]): TaskNode[] {
  const result: TaskNode[] = [];

  function traverse(task: TaskNode) {
    result.push(task);
    if (task.children) {
      task.children.forEach(traverse);
    }
  }

  tasks.forEach(traverse);
  return result;
}

/**
 * Find task by ID in task tree
 */
export function findTaskById(tasks: TaskNode[], id: string): TaskNode | null {
  for (const task of tasks) {
    if (task.id === id) return task;
    if (task.children) {
      const found = findTaskById(task.children, id);
      if (found) return found;
    }
  }
  return null;
}
