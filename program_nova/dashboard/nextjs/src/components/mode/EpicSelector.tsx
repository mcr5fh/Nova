'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Sort epics by created_at in descending order (most recent first)
  const sortedEpics = useMemo(() => {
    if (!epics) return [];
    return [...epics].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Most recent first
    });
  }, [epics]);

  // Filter epics based on search term
  const filteredEpics = useMemo(() => {
    if (!searchTerm) return sortedEpics;
    const term = searchTerm.toLowerCase();
    return sortedEpics.filter((epic) =>
      epic.id.toLowerCase().includes(term) ||
      epic.title.toLowerCase().includes(term) ||
      epic.status.toLowerCase().includes(term)
    );
  }, [sortedEpics, searchTerm]);

  // Set default to most recently created epic
  useEffect(() => {
    if (!epicId && sortedEpics.length > 0 && mounted) {
      setEpicId(sortedEpics[0].id);
    }
  }, [sortedEpics, epicId, setEpicId, mounted]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsSearching(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEpicSelect = async (selectedEpicId: string) => {
    setEpicId(selectedEpicId);
    setIsDropdownOpen(false);
    setIsSearching(false);
    setSearchTerm('');
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

  const selectedEpic = sortedEpics?.find((e: Epic) => e.id === epicId);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2 relative" ref={dropdownRef}>
        <label htmlFor="epic-search" className="text-sm text-text-secondary">
          Epic:
        </label>
        <div className="relative">
          <input
            id="epic-search"
            type="text"
            value={isSearching ? searchTerm : (selectedEpic ? `${selectedEpic.id}: ${selectedEpic.title} [${selectedEpic.status}]` : '')}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsSearching(true);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              setIsSearching(true);
              setIsDropdownOpen(true);
              setSearchTerm('');
            }}
            placeholder="Search epics..."
            className="bg-bg-tertiary border border-border-color rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent min-w-[400px]"
          />
          {isDropdownOpen && filteredEpics.length > 0 && (
            <div className="absolute z-50 mt-1 min-w-[600px] bg-bg-tertiary border border-border-color rounded shadow-lg max-h-[400px] overflow-y-auto">
              {filteredEpics.map((epic: Epic) => (
                <button
                  key={epic.id}
                  onClick={() => handleEpicSelect(epic.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary transition-colors ${
                    epic.id === epicId ? 'bg-accent/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-text-primary flex-1 break-words">
                      <span className="font-medium">{epic.id}:</span> {epic.title}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${getStatusColor(epic.status)}`}>
                      {epic.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
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
