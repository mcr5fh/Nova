'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface LogViewerProps {
  logs: string;
  isLoading: boolean;
  taskStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  onRefresh: () => void;
}

export function LogViewer({ logs, isLoading, taskStatus, onRefresh }: LogViewerProps) {
  const logsRef = useRef<HTMLPreElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevLogsLengthRef = useRef(0);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (autoScroll && logsRef.current && logs.length > prevLogsLengthRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!logsRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    // Re-enable auto-scroll if user scrolls to bottom
    if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  }, [autoScroll]);

  const isPolling = taskStatus === 'in_progress';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-accent"
            />
            Auto-scroll
          </label>
          {isPolling && (
            <span className="text-xs text-status-in-progress animate-pulse">
              Live updating...
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-bg-tertiary hover:bg-border-color text-text-primary rounded transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      <pre
        ref={logsRef}
        onScroll={handleScroll}
        className="flex-1 bg-bg-primary border border-border-color rounded-lg p-4 overflow-auto text-sm text-text-primary font-mono whitespace-pre-wrap min-h-[300px] max-h-[500px]"
      >
        {logs || 'No logs available'}
      </pre>
    </div>
  );
}
