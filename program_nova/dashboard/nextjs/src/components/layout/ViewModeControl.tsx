'use client';

/**
 * ViewModeControl - iOS-style segmented control for switching between Plan Mode and Beads view
 */

interface ViewModeControlProps {
  isPlanMode: boolean;
  onToggle: () => void;
}

export function ViewModeControl({ isPlanMode, onToggle }: ViewModeControlProps) {
  return (
    <div className="relative inline-flex items-center bg-bg-tertiary rounded-lg p-0.5">
      {/* Sliding background indicator */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-md bg-accent transition-all duration-300 ease-in-out"
        style={{
          left: isPlanMode ? '2px' : 'calc(50%)',
          width: 'calc(50% - 2px)',
        }}
      />

      {/* Plan Mode button */}
      <button
        onClick={() => !isPlanMode && onToggle()}
        className={`relative z-10 px-4 py-1.5 rounded-md font-medium text-sm transition-colors duration-200 ${
          isPlanMode
            ? 'text-white'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        aria-label="Plan Mode"
        aria-pressed={isPlanMode}
      >
        Plan Mode
      </button>

      {/* Beads button */}
      <button
        onClick={() => isPlanMode && onToggle()}
        className={`relative z-10 px-4 py-1.5 rounded-md font-medium text-sm transition-colors duration-200 ${
          !isPlanMode
            ? 'text-white'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        aria-label="Beads View"
        aria-pressed={!isPlanMode}
      >
        Beads
      </button>
    </div>
  );
}
