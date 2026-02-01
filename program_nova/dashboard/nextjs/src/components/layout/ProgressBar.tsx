'use client';

interface ProgressBarProps {
  completed: number;
  total: number;
}

export function ProgressBar({ completed, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="w-full h-8 bg-bg-secondary rounded-md overflow-hidden mb-2">
        <div
          className="
            h-full
            bg-gradient-to-r from-accent to-blue-400
            transition-[width] duration-500 ease-out
            flex items-center justify-end
            pr-3 text-sm font-semibold
          "
          style={{ width: `${percentage}%` }}
        >
          {percentage > 10 && <span className="text-white">{percentage}%</span>}
        </div>
      </div>
      <span className="text-sm text-text-secondary">
        {completed} / {total} tasks ({percentage}%)
      </span>
    </div>
  );
}
