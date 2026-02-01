'use client';

import { useState, ReactNode } from 'react';
import type { TaskStatus } from '@/types';
import { formatDuration, formatCost } from '@/lib';

export interface TreeNodeMeta {
  duration?: number;
  cost?: number;
}

export interface TreeNodeProps {
  label: string;
  level: 0 | 1 | 2;
  status: TaskStatus;
  meta?: TreeNodeMeta;
  onClick?: () => void;
  isLeaf?: boolean;
  children?: ReactNode;
  defaultExpanded?: boolean;
}

const statusColors: Record<TaskStatus, string> = {
  completed: 'bg-status-completed',
  in_progress: 'bg-status-in-progress',
  failed: 'bg-status-failed',
  pending: 'bg-status-pending',
};

const levelStyles: Record<0 | 1 | 2, { header: string; label: string }> = {
  0: {
    header: 'text-lg font-semibold p-3',
    label: 'font-semibold',
  },
  1: {
    header: 'text-base font-medium p-2',
    label: 'font-medium',
  },
  2: {
    header: 'text-sm p-2',
    label: '',
  },
};

export function TreeNode({
  label,
  level,
  status,
  meta,
  onClick,
  isLeaf = false,
  children,
  defaultExpanded = true,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const styles = levelStyles[level];

  return (
    <div className="mb-1">
      {/* Node Header */}
      <div
        className={`flex items-center gap-2 rounded-md cursor-pointer transition-colors hover:bg-bg-tertiary ${styles.header} ${
          level === 2 ? 'hover:border hover:border-accent' : ''
        }`}
        onClick={handleClick}
      >
        {/* Toggle Arrow */}
        {!isLeaf ? (
          <button
            type="button"
            className={`w-4 h-4 flex items-center justify-center text-text-secondary transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            onClick={handleToggle}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            ▶
          </button>
        ) : (
          <span className="w-4 h-4" /> /* Spacer for leaf nodes */
        )}

        {/* Status Indicator */}
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColors[status]}`}
          title={status}
        />

        {/* Label */}
        <span className={`flex-1 text-text-primary ${styles.label}`}>
          {label}
        </span>

        {/* Metadata */}
        {meta && (
          <div className="flex gap-4 text-sm text-text-secondary">
            {meta.duration !== undefined && meta.duration !== null && (
              <span className="flex items-center gap-1">
                <span>⏱</span>
                <span>{formatDuration(meta.duration)}</span>
              </span>
            )}
            {meta.cost !== undefined && meta.cost !== null && (
              <span className="flex items-center gap-1">
                <span>💰</span>
                <span>{formatCost(meta.cost)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Children Container */}
      {!isLeaf && children && (
        <div
          className={`ml-6 mt-1 border-l-2 border-border-color pl-3 ${
            isExpanded ? '' : 'hidden'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
