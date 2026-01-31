import {
  SessionState,
  DimensionId,
  DimensionState,
  CoverageLevel,
  Message,
  EvaluationResult
} from './types';
import { DIMENSIONS } from './dimensions';

export function createSession(id: string): SessionState {
  const now = Date.now();
  const dimensions = {} as Record<DimensionId, DimensionState>;

  for (const dimId of Object.keys(DIMENSIONS) as DimensionId[]) {
    dimensions[dimId] = {
      id: dimId,
      coverage: 'not_started',
      evidence: [],
      lastUpdated: now,
    };
  }

  return {
    id,
    dimensions,
    conversationHistory: [],
    currentFocus: 'problem_clarity', // Start here
    startedAt: now,
    lastActivityAt: now,
  };
}

export function addMessage(
  state: SessionState,
  role: 'user' | 'assistant',
  content: string
): SessionState {
  return {
    ...state,
    conversationHistory: [
      ...state.conversationHistory,
      { role, content, timestamp: Date.now() }
    ],
    lastActivityAt: Date.now(),
  };
}

export function applyEvaluation(
  state: SessionState,
  evaluation: EvaluationResult
): SessionState {
  const { dimensionId, newCoverage, evidence } = evaluation;
  const existing = state.dimensions[dimensionId];

  // Only upgrade coverage, never downgrade
  const levelOrder: CoverageLevel[] = ['not_started', 'weak', 'partial', 'strong'];
  const currentIdx = levelOrder.indexOf(existing.coverage);
  const newIdx = levelOrder.indexOf(newCoverage);

  const finalCoverage = newIdx > currentIdx ? newCoverage : existing.coverage;

  return {
    ...state,
    dimensions: {
      ...state.dimensions,
      [dimensionId]: {
        ...existing,
        coverage: finalCoverage,
        evidence: [...existing.evidence, ...evidence],
        lastUpdated: Date.now(),
      },
    },
  };
}

export function selectNextFocus(state: SessionState): DimensionId | null {
  // Priority order for focusing
  const priorityOrder: DimensionId[] = [
    'problem_clarity',      // Must be strong
    'customer_context',     // Must be strong
    'business_impact',      // Must be strong
    'severity_frequency',   // Must be partial
    'root_cause',           // Must be partial
    'validation',           // Must be partial
  ];

  const thresholds: Record<DimensionId, CoverageLevel> = {
    problem_clarity: 'strong',
    customer_context: 'strong',
    business_impact: 'strong',
    severity_frequency: 'partial',
    root_cause: 'partial',
    validation: 'partial',
  };

  const levelOrder: CoverageLevel[] = ['not_started', 'weak', 'partial', 'strong'];

  for (const dimId of priorityOrder) {
    const current = state.dimensions[dimId].coverage;
    const threshold = thresholds[dimId];
    if (levelOrder.indexOf(current) < levelOrder.indexOf(threshold)) {
      return dimId;
    }
  }

  return null; // All dimensions meet threshold
}

// Serialize for saving
export function serializeState(state: SessionState): string {
  return JSON.stringify(state, null, 2);
}

// Deserialize for loading
export function deserializeState(json: string): SessionState {
  return JSON.parse(json) as SessionState;
}
