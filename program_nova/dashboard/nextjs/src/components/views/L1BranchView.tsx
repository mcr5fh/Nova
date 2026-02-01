'use client';

import { useNavigation } from '@/context';
import { formatDuration, formatCost, formatNumber } from '@/lib';
import type { StatusResponse, TaskStatus, TokenUsage } from '@/types';

interface L1BranchViewProps {
  status: StatusResponse;
  branchName: string;
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

function formatStatus(status: TaskStatus): string {
  const statusMap: Record<TaskStatus, string> = {
    completed: 'Completed',
    in_progress: 'In Progress',
    failed: 'Failed',
    pending: 'Pending',
  };
  return statusMap[status] || status;
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const colorMap: Record<TaskStatus, string> = {
    completed: 'bg-status-completed',
    in_progress: 'bg-status-in-progress',
    failed: 'bg-status-failed',
    pending: 'bg-status-pending',
  };

  return (
    <div className={`w-3 h-3 rounded-full ${colorMap[status]}`} />
  );
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

interface GroupCardProps {
  title: string;
  status: TaskStatus;
  progress: string;
  duration: string;
  tokens: string;
  cost: string;
  onClick: () => void;
}

function GroupCard({ title, status, progress, duration, tokens, cost, onClick }: GroupCardProps) {
  return (
    <div
      className="bg-bg-secondary border border-border-color rounded-lg p-4 cursor-pointer transition-all hover:bg-bg-tertiary hover:border-accent"
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        <StatusBadge status={status} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-text-secondary">Progress</span>
          <span className="text-sm font-medium text-text-primary">{progress}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-text-secondary">Duration</span>
          <span className="text-sm font-medium text-text-primary">{duration}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-text-secondary">Tokens</span>
          <span className="text-sm font-medium text-text-primary">{tokens}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-text-secondary">Cost</span>
          <span className="text-sm font-medium text-text-primary">{cost}</span>
        </div>
      </div>
    </div>
  );
}

export function L1BranchView({ status, branchName }: L1BranchViewProps) {
  const { showView } = useNavigation();

  const { rollups, hierarchy, tasks } = status;

  // Get L1 rollup data
  const l1Rollup = rollups.l1_rollups[branchName];
  if (!l1Rollup) {
    return (
      <div className="text-text-secondary">
        Branch not found: {branchName}
      </div>
    );
  }

  // Get L2 groups for this branch
  const l2Groups = hierarchy[branchName];
  if (!l2Groups) {
    return (
      <div className="text-text-secondary">
        No groups found for branch: {branchName}
      </div>
    );
  }

  const l2Names = Object.keys(l2Groups);

  return (
    <div>
      {/* Branch Title */}
      <h2 className="text-2xl font-bold text-text-primary mb-4">{branchName}</h2>

      {/* Branch Stats */}
      <div className="bg-bg-secondary border border-border-color rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Status" value={formatStatus(l1Rollup.status)} />
          <Metric label="Duration" value={formatDuration(l1Rollup.duration_seconds)} />
          <Metric label="Tokens" value={formatNumber(getTotalTokens(l1Rollup.token_usage))} />
          <Metric label="Cost" value={formatCost(l1Rollup.cost_usd)} />
        </div>
      </div>

      {/* L2 Groups Grid */}
      <h3 className="text-xl font-semibold text-text-primary mb-4">Groups</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {l2Names.map((l2Name) => {
          const l2Rollup = rollups.l2_rollups[branchName]?.[l2Name];
          if (!l2Rollup) return null;

          const taskIds = l2Groups[l2Name];
          const completedCount = taskIds.filter(
            (id) => tasks[id]?.status === 'completed'
          ).length;

          return (
            <GroupCard
              key={l2Name}
              title={l2Name}
              status={l2Rollup.status}
              progress={`${completedCount} / ${taskIds.length}`}
              duration={formatDuration(l2Rollup.duration_seconds)}
              tokens={formatNumber(getTotalTokens(l2Rollup.token_usage))}
              cost={formatCost(l2Rollup.cost_usd)}
              onClick={() => showView('l2', branchName, l2Name)}
            />
          );
        })}
      </div>
    </div>
  );
}
