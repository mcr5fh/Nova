import type { SessionMode } from '../types';

interface ModeSelectorProps {
  mode: SessionMode | null;
  onModeChange: (mode: SessionMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <button
        className={`mode-selector__button ${mode === 'problem' ? 'mode-selector__button--active' : ''}`}
        onClick={() => onModeChange('problem')}
        disabled={disabled}
      >
        Problem Discovery
      </button>
      <button
        className={`mode-selector__button ${mode === 'solution' ? 'mode-selector__button--active' : ''}`}
        onClick={() => onModeChange('solution')}
        disabled={disabled}
      >
        Solution Design
      </button>
    </div>
  );
}
