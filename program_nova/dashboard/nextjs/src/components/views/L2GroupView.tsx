'use client';

import { useNavigation } from '@/context';
import { formatDuration, formatCost, formatNumber } from '@/lib';
import type { StatusResponse, TaskStatus, TokenUsage, Task } from '@/types';

interface L2GroupViewProps {
  status: StatusResponse;
  branchName: string;
  groupName: string;
}

function getTotalTokens(tokenUsage: TokenUsage | undefined): number {
  if (!tokenUsage) return 0;
  return (
    (tokenUsage.input_tokens || 0) +
    (tokenUsage.output_tokens || 0) +
    (tokenUsage.cache_read_tokens || 0) +
    (tokenUsage.cache_creation_tokens || 0)
  );
}

function computeCost(tokenUsage: TokenUsage | undefined): number {
  if (!tokenUsage) return 0;

  const PRICE_INPUT = 3.0 / 1_000_000;
  const PRICE_OUTPUT = 15.0 / 1_000_000;
  const PRICE_CACHE_READ = 0.3 / 1_000_000;
  const PRICE_CACHE_CREATION = 3.75 / 1_000_000;

  return (
    (tokenUsage.input_tokens || 0) * PRICE_INPUT +
    (tokenUsage.output_tokens || 0) * PRICE_OUTPUT +
    (tokenUsage.cache_read_tokens || 0) * PRICE_CACHE_READ +
    (tokenUsage.cache_creation_tokens || 0) * PRICE_CACHE_CREATION
  );
}

function computeLiveDuration(startedAt: string | undefined): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / 1000);
}

function formatStatus(status: TaskStatus): string {
  const statusMap: Record<TaskStatus, string> = {
    completed: 'Completed',
    in_progress: 'In Progress',
    failed: 'Failed',
    pending: 'Pending',
  };
  return statusMap[status] || status;
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-lg font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: TaskStatus }) {
  const colorMap: Record<TaskStatus, string> = {
    completed: 'text-status-completed',
    in_progress: 'text-status-in-progress',
    failed: 'text-status-failed',
    pending: 'text-status-pending',
  };

  return (
    <span className={`text-sm font-medium ${colorMap[status]}`}>
      {formatStatus(status)}
    </span>
  );
}

interface TaskRowProps {
  taskId: string;
  task: Task | undefined;
  onClick: () => void;
}

function TaskRow({ taskId, task, onClick }: TaskRowProps) {
  const status = task?.status || 'pending';
  const duration =
    status === 'in_progress'
      ? computeLiveDuration(task?.started_at)
      : task?.duration_seconds || 0;
  const totalTokens = getTotalTokens(task?.token_usage);
  const cost = computeCost(task?.token_usage);

  return (
    <tr
      className="hover:bg-bg-tertiary cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-accent font-medium">{taskId}</td>
      <td className="px-4 py-3 text-text-primary">{task?.name || taskId}</td>
      <td className="px-4 py-3">
        <StatusIcon status={status} />
      </td>
      <td className="px-4 py-3 text-text-primary">{formatDuration(duration)}</td>
      <td className="px-4 py-3 text-text-primary">{formatNumber(totalTokens)}</td>
      <td className="px-4 py-3 text-text-primary">{formatCost(cost)}</td>
    </tr>
  );
}

export function L2GroupView({ status, branchName, groupName }: L2GroupViewProps) {
  const { showView } = useNavigation();

  const { rollups, hierarchy, tasks } = status;

  // Get L2 rollup data
  const l2Rollup = rollups.l2_rollups[branchName]?.[groupName];
  if (!l2Rollup) {
    return (
      <div className="text-text-secondary">
        Group not found: {branchName}/{groupName}
      </div>
    );
  }

  // Get task IDs for this group
  const taskIds = hierarchy[branchName]?.[groupName];
  if (!taskIds) {
    return (
      <div className="text-text-secondary">
        No tasks found for group: {branchName}/{groupName}
      </div>
    );
  }

  return (
    <div>
      {/* Group Title */}
      <h2 className="text-2xl font-bold text-text-primary mb-4">{groupName}</h2>

      {/* Group Stats */}
      <div className="bg-bg-secondary border border-border-color rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Status" value={formatStatus(l2Rollup.status)} />
          <Metric label="Duration" value={formatDuration(l2Rollup.duration_seconds)} />
          <Metric label="Tokens" value={formatNumber(getTotalTokens(l2Rollup.token_usage))} />
          <Metric label="Cost" value={formatCost(l2Rollup.cost_usd)} />
        </div>
      </div>

      {/* Tasks Table */}
      <h3 className="text-xl font-semibold text-text-primary mb-4">Tasks</h3>
      <div className="bg-bg-secondary border border-border-color rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-bg-tertiary border-b border-border-color">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">ID</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Duration</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Tokens</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">
            {taskIds.map((taskId) => (
              <TaskRow
                key={taskId}
                taskId={taskId}
                task={tasks[taskId]}
                onClick={() => showView('l3', branchName, groupName, taskId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
