'use client';

import { formatDuration, formatCost } from '@/lib';
import { EpicSelector } from '@/components/mode';
import { ViewModeControl } from './ViewModeControl';
import type { StatusResponse } from '@/types';

interface HeaderProps {
  status?: StatusResponse;
  isPlanMode?: boolean;
  onTogglePlanMode?: () => void;
}

export function Header({ status, isPlanMode = false, onTogglePlanMode }: HeaderProps) {
  const projectName = status?.project?.name ?? 'Program Nova';
  const l0Rollup = status?.rollups?.l0_rollup;

  // Calculate progress
  const tasks = status?.tasks ?? {};
  const totalTasks = Object.keys(tasks).length;
  const completedTasks = Object.values(tasks).filter(t => t.status === 'completed').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <header className="flex flex-col gap-4 mb-6 pb-4 border-b-2 border-border-color">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-text-primary">{projectName} Dashboard</h1>

        {onTogglePlanMode && (
          <ViewModeControl
            isPlanMode={isPlanMode}
            onToggle={onTogglePlanMode}
          />
        )}

        {/* Project Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Progress:</span>
            <span className="text-sm font-semibold text-text-primary">
              {completedTasks}/{totalTasks} ({progressPercent}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Duration:</span>
            <span className="text-sm font-semibold text-text-primary">
              {l0Rollup ? formatDuration(l0Rollup.duration_seconds) : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Cost:</span>
            <span className="text-sm font-semibold text-text-primary">
              {l0Rollup ? formatCost(l0Rollup.cost_usd) : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Epic Selector - shown only in bead mode */}
      <EpicSelector />
    </header>
  );
}
