/**
 * Task node types for the task tree visualization
 */

export type TaskStatus =
  | "queued"
  | "running"
  | "blocked"
  | "escalated"
  | "needs_human"
  | "failed"
  | "done";

export type TaskSize = "XS" | "S" | "M" | "L" | "XL";

export interface TaskNode extends Record<string, unknown> {
  id: string;
  parentId?: string;
  children: string[];
  spec: string;
  size: TaskSize;
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  assignedWorker?: string;
  workerModel?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  artifacts?: string[];
  validation?: {
    passed: boolean;
    reason?: string;
  };
  telemetry?: {
    tokens: number;
    cost: number;
    toolCalls: number;
  };
}

export interface TaskEdge {
  id: string;
  source: string;
  target: string;
  type?: "default" | "dependency";
}

export interface TaskGraph {
  nodes: TaskNode[];
  edges: TaskEdge[];
}
