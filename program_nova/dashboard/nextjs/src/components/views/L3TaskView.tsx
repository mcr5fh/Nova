'use client';

import { useTaskLogs } from '@/hooks';
import { LogViewer } from '@/components/logs';
import { formatDuration, formatCost, formatNumber } from '@/lib';
import type { StatusResponse, TaskStatus, TokenUsage } from '@/types';

interface L3TaskViewProps {
  status: StatusResponse;
  taskId: string;
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

function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

interface InfoRowProps {
  label: string;
  value: string | React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-border-color last:border-b-0">
      <span className="text-sm text-text-secondary sm:w-40">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
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

export function L3TaskView({ status, taskId }: L3TaskViewProps) {
  const task = status.tasks[taskId];
  const taskStatus = task?.status || 'pending';

  const { data: logsData, isLoading, refetch } = useTaskLogs({
    taskId,
    taskStatus,
    enabled: true,
  });

  // Calculate duration (live for in-progress tasks)
  const duration =
    taskStatus === 'in_progress'
      ? computeLiveDuration(task?.started_at)
      : task?.duration_seconds || 0;

  const tokenUsage = task?.token_usage;
  const cost = computeCost(tokenUsage);

  return (
    <div>
      {/* Task Title */}
      <h2 className="text-2xl font-bold text-text-primary mb-4">Task {taskId}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Info */}
        <div className="bg-bg-secondary border border-border-color rounded-lg p-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Task Information</h3>
          <div className="space-y-1">
            <InfoRow label="Task ID" value={taskId} />
            <InfoRow label="Status" value={<StatusIcon status={taskStatus} />} />
            <InfoRow label="Duration" value={formatDuration(duration)} />
            <InfoRow label="Worker" value={task?.worker_id || 'N/A'} />
            <InfoRow label="Started" value={formatTimestamp(task?.started_at)} />
            <InfoRow label="Completed" value={formatTimestamp(task?.completed_at)} />
          </div>
        </div>

        {/* Token Usage */}
        <div className="bg-bg-secondary border border-border-color rounded-lg p-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Token Usage</h3>
          <div className="space-y-1">
            <InfoRow label="Input Tokens" value={formatNumber(tokenUsage?.input_tokens || 0)} />
            <InfoRow label="Output Tokens" value={formatNumber(tokenUsage?.output_tokens || 0)} />
            <InfoRow label="Cache Read" value={formatNumber(tokenUsage?.cache_read_tokens || 0)} />
            <InfoRow label="Cache Creation" value={formatNumber(tokenUsage?.cache_creation_tokens || 0)} />
            <InfoRow label="Cost" value={formatCost(cost)} />
          </div>
        </div>
      </div>

      {/* Commit Info (if available) */}
      {task?.commit_sha && (
        <div className="mt-6 bg-bg-secondary border border-border-color rounded-lg p-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Commit Information</h3>
          <div className="space-y-1">
            <InfoRow label="Commit SHA" value={task.commit_sha} />
            <InfoRow
              label="Files Changed"
              value={task.files_changed?.join(', ') || 'N/A'}
            />
          </div>
        </div>
      )}

      {/* Error Info (if available) */}
      {task?.error && (
        <div className="mt-6 bg-red-900/20 border border-status-failed rounded-lg p-4">
          <h3 className="text-lg font-semibold text-status-failed mb-4">Error</h3>
          <pre className="text-sm text-text-primary font-mono whitespace-pre-wrap">
            {task.error}
          </pre>
        </div>
      )}

      {/* Logs */}
      <div className="mt-6 bg-bg-secondary border border-border-color rounded-lg p-4">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Logs</h3>
        <LogViewer
          logs={logsData?.logs || ''}
          isLoading={isLoading}
          taskStatus={taskStatus}
          onRefresh={() => refetch()}
        />
      </div>
    </div>
  );
}
