'use client';

import { useState, useEffect } from 'react';

interface StatusIndicatorProps {
  isConnected: boolean;
  isCompleted: boolean;
  isError: boolean;
}

export function StatusIndicator({ isConnected, isCompleted, isError }: StatusIndicatorProps) {
  // Track mounted state to prevent hydration mismatch
  // Server and client will both render the same initial state until useEffect runs
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Default state shown during SSR and initial client render (before hydration completes)
  let statusText = 'Connecting...';
  let dotClassName = 'bg-status-pending animate-pulse';

  // Only compute dynamic state after component has mounted on client
  if (mounted) {
    if (isError) {
      statusText = 'Connection Error';
      dotClassName = 'bg-status-failed';
    } else if (isCompleted) {
      statusText = 'All Tasks Completed';
      dotClassName = 'bg-status-completed';
    } else if (isConnected) {
      statusText = 'Connected';
      dotClassName = 'bg-status-completed';
    }
  }

  return (
    <div
      className="
        fixed bottom-4 right-4
        bg-bg-secondary border border-border-color
        rounded-full px-4 py-2
        flex items-center gap-2
        text-sm text-text-secondary
        shadow-lg
        z-50
      "
    >
      <span className={`w-2 h-2 rounded-full ${dotClassName}`} />
      <span>{statusText}</span>
    </div>
  );
}
