'use client';

import { useState, useEffect } from 'react';
import { useNavigation } from '@/context';
import type { DashboardMode } from '@/types';

interface ModeSelectorProps {
  className?: string;
}

export function ModeSelector({ className = '' }: ModeSelectorProps) {
  const { mode, setMode } = useNavigation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleModeChange = (newMode: DashboardMode) => {
    setMode(newMode);
  };

  // Use default 'cascade' mode during SSR and initial client render to prevent hydration mismatch
  const displayMode = mounted ? mode : 'cascade';

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-text-secondary mr-1">Mode:</span>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="radio"
          name="dashboard-mode"
          value="cascade"
          checked={displayMode === 'cascade'}
          onChange={() => handleModeChange('cascade')}
          className="accent-accent w-4 h-4"
        />
        <span className={`${displayMode === 'cascade' ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
          Cascade
        </span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="radio"
          name="dashboard-mode"
          value="bead"
          checked={displayMode === 'bead'}
          onChange={() => handleModeChange('bead')}
          className="accent-accent w-4 h-4"
        />
        <span className={`${displayMode === 'bead' ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
          Bead
        </span>
      </label>
    </div>
  );
}
