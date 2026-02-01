/**
 * Task status types matching Beads task states
 */
export type TaskStatus = 'open' | 'in_progress' | 'closed' | 'blocked';

/**
 * Task type matching Beads task types
 */
export type TaskType = 'task' | 'bug' | 'feature' | 'epic';

/**
 * Priority level (0-4, where 0 is critical and 4 is backlog)
 */
export type Priority = 0 | 1 | 2 | 3 | 4;

/**
 * Represents a single task node in the task tree
 */
export interface TaskNode {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  assignee?: string;
  created: string;
  updated: string;
  description?: string;
  notes?: string;
  design?: string;
  parentId?: string;
  children?: TaskNode[];
  dependsOn?: string[];
  blocks?: string[];
}

/**
 * Props for the TaskTree component
 */
export interface TaskTreeProps {
  tasks: TaskNode[];
  initialView?: 'mermaid' | 'flow';
  onTaskClick?: (taskId: string) => void;
  onTaskHover?: (taskId: string | null) => void;
}

/**
 * Props for the MermaidView component
 */
export interface MermaidViewProps {
  tasks: TaskNode[];
  onTaskClick?: (taskId: string) => void;
}

/**
 * Props for the FlowView component
 */
export interface FlowViewProps {
  tasks: TaskNode[];
  onTaskClick?: (taskId: string) => void;
  onTaskHover?: (taskId: string | null) => void;
}
