export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  name: string;
  status: TaskStatus;
  started_at?: string;
  completed_at?: string;
  duration_seconds: number;
  token_usage: TokenUsage;
  worker_id?: string;
  commit_sha?: string;
  files_changed?: string[];
  error?: string;
}

export interface TaskDefinition {
  name: string;
  branch: string;
  group: string;
  depends_on: string[];
}

export interface Rollup {
  status: TaskStatus;
  duration_seconds: number;
  token_usage: TokenUsage;
  cost_usd: number;
}

export interface Rollups {
  l0_rollup: Rollup;
  l1_rollups: Record<string, Rollup>;
  l2_rollups: Record<string, Record<string, Rollup>>;
}

export interface Hierarchy {
  [l1: string]: {
    [l2: string]: string[];
  };
}

export interface StatusResponse {
  project: { name: string };
  tasks: Record<string, Task>;
  rollups: Rollups;
  hierarchy: Hierarchy;
  milestones: Milestone[];
  all_tasks_completed: boolean;
  task_definitions: Record<string, TaskDefinition>;
}

export interface Milestone {
  name: string;
  message: string;
  timestamp?: string;
}

export interface Epic {
  id: string;
  title: string;
  type: string;
  status: string;
  priority?: string;
}

export interface TaskLogs {
  task_id: string;
  logs: string;
}
