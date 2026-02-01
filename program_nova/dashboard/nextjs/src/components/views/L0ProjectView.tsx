'use client';

import { useState } from 'react';
import { useNavigation } from '@/context';
import { ProgressBar } from '@/components/layout';
import { DependencyGraph } from '@/components/graph';
import { TreeView } from '@/components/tree';
import { formatDuration, formatCost, formatNumber } from '@/lib';
import type { StatusResponse, TaskStatus, TokenUsage } from '@/types';

interface L0ProjectViewProps {
  status: StatusResponse;
}

interface CardMetric {
  label: string;
  value: string;
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

interface BranchCardProps {
  title: string;
  status: TaskStatus;
  metrics: CardMetric[];
  onClick: () => void;
}

function BranchCard({ title, status, metrics, onClick }: BranchCardProps) {
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
        {metrics.map((metric) => (
          <div key={metric.label} className="flex flex-col">
            <span className="text-xs text-text-secondary">{metric.label}</span>
            <span className="text-sm font-medium text-text-primary">{metric.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewTabs({ activeView, onViewChange }: { activeView: 'tree' | 'dependencies'; onViewChange: (view: 'tree' | 'dependencies') => void }) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          activeView === 'tree'
            ? 'bg-accent text-white'
            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
        }`}
        onClick={() => onViewChange('tree')}
      >
        Tree View
      </button>
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          activeView === 'dependencies'
            ? 'bg-accent text-white'
            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
        }`}
        onClick={() => onViewChange('dependencies')}
      >
        Dependencies
      </button>
    </div>
  );
}

export function L0ProjectView({ status }: L0ProjectViewProps) {
  const { showView } = useNavigation();
  const [activeView, setActiveView] = useState<'tree' | 'dependencies'>('dependencies');

  const { rollups, hierarchy, tasks } = status;

  // Calculate total progress
  const allTaskIds = Object.values(hierarchy).flatMap((l1Groups) =>
    Object.values(l1Groups).flat()
  );
  const completedCount = allTaskIds.filter(
    (id) => tasks[id]?.status === 'completed'
  ).length;
  const totalCount = allTaskIds.length;

  // Get L1 branch names
  const l1Names = Object.keys(hierarchy);

  return (
    <div>
      {/* Progress Bar */}
      <ProgressBar completed={completedCount} total={totalCount} />

      {/* View Tabs */}
      <ViewTabs activeView={activeView} onViewChange={setActiveView} />

      {/* Tree/Dependency View Container */}
      <div className="mb-6">
        {activeView === 'dependencies' ? (
          <DependencyGraph status={status} />
        ) : (
          <TreeView status={status} />
        )}
      </div>

      {/* L1 Branches Grid */}
      <h2 className="text-xl font-semibold text-text-primary mb-4">Branches</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {l1Names.map((l1Name) => {
          const rollup = rollups.l1_rollups[l1Name];
          const l1Groups = hierarchy[l1Name];
          const l1TaskIds = Object.values(l1Groups).flat();
          const l1CompletedCount = l1TaskIds.filter(
            (id) => tasks[id]?.status === 'completed'
          ).length;

          return (
            <BranchCard
              key={l1Name}
              title={l1Name}
              status={rollup.status}
              metrics={[
                { label: 'Progress', value: `${l1CompletedCount} / ${l1TaskIds.length}` },
                { label: 'Duration', value: formatDuration(rollup.duration_seconds) },
                { label: 'Tokens', value: formatNumber(getTotalTokens(rollup.token_usage)) },
                { label: 'Cost', value: formatCost(rollup.cost_usd) },
              ]}
              onClick={() => showView('l1', l1Name)}
            />
          );
        })}
      </div>
    </div>
  );
}
