'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@/context';
import { fetchEpics, startEpicExecution } from '@/lib/api';
import type { Epic } from '@/types';

interface EpicSelectorProps {
  className?: string;
}

export function EpicSelector({ className = '' }: EpicSelectorProps) {
  const { mode, epicId, setEpicId } = useNavigation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use default 'cascade' mode during SSR and initial client render to prevent hydration mismatch
  const displayMode = mounted ? mode : 'cascade';

  const { data: epics, isLoading, error } = useQuery({
    queryKey: ['epics'],
    queryFn: fetchEpics,
    enabled: displayMode === 'bead',
    staleTime: 30000,
  });

  const handleEpicSelect = async (selectedEpicId: string) => {
    setEpicId(selectedEpicId);
  };

  const handleStartExecution = async () => {
    if (!epicId) return;
    try {
      await startEpicExecution(epicId);
    } catch (err) {
      console.error('Failed to start epic execution:', err);
    }
  };

  // Only show in bead mode
  if (displayMode !== 'bead') {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="text-text-secondary">Loading epics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="text-status-failed">Failed to load epics</span>
      </div>
    );
  }

  const selectedEpic = epics?.find((e: Epic) => e.id === epicId);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <label htmlFor="epic-select" className="text-sm text-text-secondary">
          Epic:
        </label>
        <select
          id="epic-select"
          value={epicId || ''}
          onChange={(e) => handleEpicSelect(e.target.value)}
          className="bg-bg-tertiary border border-border-color rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Select an epic...</option>
          {epics?.map((epic: Epic) => (
            <option key={epic.id} value={epic.id}>
              {epic.id}: {epic.title} [{epic.status}]
            </option>
          ))}
        </select>
      </div>

      {selectedEpic && (
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(selectedEpic.status)}`}>
            {selectedEpic.issue_type}
          </span>
          {selectedEpic.priority !== undefined && (
            <span className="text-xs text-text-secondary">
              P{selectedEpic.priority}
            </span>
          )}
          {selectedEpic.status === 'open' && (
            <button
              onClick={handleStartExecution}
              className="px-3 py-1 text-xs bg-accent hover:bg-accent/80 text-white rounded transition-colors"
            >
              Start
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'closed':
      return 'bg-status-completed/20 text-status-completed';
    case 'in_progress':
    case 'running':
      return 'bg-status-in-progress/20 text-status-in-progress';
    case 'failed':
      return 'bg-status-failed/20 text-status-failed';
    default:
      return 'bg-status-pending/20 text-status-pending';
  }
}
