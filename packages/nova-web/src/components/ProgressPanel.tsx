import type { DimensionState } from '../types';

interface ProgressPanelProps {
  dimensions: DimensionState[];
}

function getStatusClass(status: DimensionState['status']): string {
  switch (status) {
    case 'complete':
      return 'progress-panel__dimension--complete';
    case 'in_progress':
      return 'progress-panel__dimension--in-progress';
    default:
      return 'progress-panel__dimension--not-started';
  }
}

function getStatusIcon(status: DimensionState['status']): string {
  switch (status) {
    case 'complete':
      return '✓';
    case 'in_progress':
      return '●';
    default:
      return '○';
  }
}

export function ProgressPanel({ dimensions }: ProgressPanelProps) {
  if (dimensions.length === 0) {
    return (
      <div className="progress-panel progress-panel--empty">
        <div className="progress-panel__title">Progress</div>
        <div className="progress-panel__empty-message">
          Start a session to see progress
        </div>
      </div>
    );
  }

  const totalCoverage = dimensions.reduce((sum, d) => sum + d.coverage, 0) / dimensions.length;

  return (
    <div className="progress-panel">
      <div className="progress-panel__header">
        <div className="progress-panel__title">Progress</div>
        <div className="progress-panel__total">
          {Math.round(totalCoverage * 100)}%
        </div>
      </div>

      <div className="progress-panel__dimensions">
        {dimensions.map((dimension, index) => (
          <div
            key={dimension.name || index}
            className={`progress-panel__dimension ${getStatusClass(dimension.status)}`}
          >
            <div className="progress-panel__dimension-header">
              <span className="progress-panel__dimension-icon">
                {getStatusIcon(dimension.status)}
              </span>
              <span className="progress-panel__dimension-name">
                {dimension.name}
              </span>
              <span className="progress-panel__dimension-coverage">
                {Math.round(dimension.coverage * 100)}%
              </span>
            </div>

            <div className="progress-panel__dimension-bar">
              <div
                className="progress-panel__dimension-fill"
                style={{ width: `${dimension.coverage * 100}%` }}
              />
            </div>

            {dimension.currentQuestion && (
              <div className="progress-panel__dimension-question">
                {dimension.currentQuestion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
