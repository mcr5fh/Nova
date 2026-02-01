import type { TaskNode, TaskStatus } from "@/types/task";

/**
 * Get the color for a task status (for visualization)
 */
export function getStatusColor(status: TaskStatus): string {
  const colorMap: Record<TaskStatus, string> = {
    queued: "bg-gray-400",
    running: "bg-blue-500",
    blocked: "bg-yellow-500",
    escalated: "bg-orange-500",
    needs_human: "bg-purple-500",
    failed: "bg-red-500",
    done: "bg-green-500",
  };
  return colorMap[status];
}

/**
 * Get the label for a task status
 */
export function getStatusLabel(status: TaskStatus): string {
  const labelMap: Record<TaskStatus, string> = {
    queued: "Queued",
    running: "Running",
    blocked: "Blocked",
    escalated: "Escalated",
    needs_human: "Needs Human",
    failed: "Failed",
    done: "Done",
  };
  return labelMap[status];
}

/**
 * Get the glow effect for a task status
 */
export function getStatusGlow(status: TaskStatus): string {
  const glowMap: Record<TaskStatus, string> = {
    queued: "",
    running: "glow-primary",
    blocked: "glow-warning",
    escalated: "glow-warning",
    needs_human: "glow-accent",
    failed: "glow-error",
    done: "glow-success",
  };
  return glowMap[status];
}

/**
 * Calculate task progress as a percentage
 */
export function calculateProgress(task: TaskNode): number {
  if (task.status === "done") return 100;
  if (task.status === "failed") return 0;
  if (task.attempts === 0) return 0;

  return Math.min((task.attempts / task.maxAttempts) * 100, 99);
}

/**
 * Check if a task is in a terminal state
 */
export function isTerminal(status: TaskStatus): boolean {
  return status === "done" || status === "failed";
}

/**
 * Check if a task needs attention
 */
export function needsAttention(status: TaskStatus): boolean {
  return status === "blocked" || status === "escalated" || status === "needs_human";
}

/**
 * Build a task hierarchy from flat list
 */
export function buildTaskHierarchy(tasks: TaskNode[]): TaskNode[] {
  const taskMap = new Map<string, TaskNode>();
  const rootTasks: TaskNode[] = [];

  // First pass: create map
  tasks.forEach((task) => {
    taskMap.set(task.id, task);
  });

  // Second pass: build hierarchy
  tasks.forEach((task) => {
    if (!task.parentId) {
      rootTasks.push(task);
    }
  });

  return rootTasks;
}

/**
 * Get all descendants of a task
 */
export function getDescendants(taskId: string, tasks: TaskNode[]): TaskNode[] {
  const taskMap = new Map<string, TaskNode>();
  tasks.forEach((task) => taskMap.set(task.id, task));

  const descendants: TaskNode[] = [];
  const queue = [taskId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = taskMap.get(currentId);

    if (current) {
      current.children.forEach((childId) => {
        const child = taskMap.get(childId);
        if (child) {
          descendants.push(child);
          queue.push(childId);
        }
      });
    }
  }

  return descendants;
}
