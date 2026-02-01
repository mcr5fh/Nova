'use client';

import { useNavigation } from '@/context';
import type { DashboardMode } from '@/types';

interface ModeSelectorProps {
  className?: string;
}

export function ModeSelector({ className = '' }: ModeSelectorProps) {
  const { mode, setMode } = useNavigation();

  const handleModeChange = (newMode: DashboardMode) => {
    setMode(newMode);
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-text-secondary mr-1">Mode:</span>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="radio"
          name="dashboard-mode"
          value="cascade"
          checked={mode === 'cascade'}
          onChange={() => handleModeChange('cascade')}
          className="accent-accent w-4 h-4"
        />
        <span className={`${mode === 'cascade' ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
          Cascade
        </span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="radio"
          name="dashboard-mode"
          value="bead"
          checked={mode === 'bead'}
          onChange={() => handleModeChange('bead')}
          className="accent-accent w-4 h-4"
        />
        <span className={`${mode === 'bead' ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
          Bead
        </span>
      </label>
    </div>
  );
}
