import {
  SessionState,
  DimensionId,
  DimensionState,
  CoverageLevel,
  Message,
  EvaluationResult,
  LoadedProblem
} from './types.js';
import { DIMENSIONS } from './dimensions.js';

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
    currentFocus: 'solution_clarity', // Start here
    startedAt: now,
    lastActivityAt: now,
    loadedProblem: null,
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
  // Priority order for focusing - all require strong
  const priorityOrder: DimensionId[] = [
    'solution_clarity',
    'user_value',
    'scope_boundaries',
    'success_criteria',
  ];

  const levelOrder: CoverageLevel[] = ['not_started', 'weak', 'partial', 'strong'];

  for (const dimId of priorityOrder) {
    const current = state.dimensions[dimId].coverage;
    const threshold = DIMENSIONS[dimId].signOffThreshold;
    if (levelOrder.indexOf(current) < levelOrder.indexOf(threshold)) {
      return dimId;
    }
  }

  return null; // All dimensions meet threshold
}

export function setLoadedProblem(
  state: SessionState,
  problem: LoadedProblem
): SessionState {
  return {
    ...state,
    loadedProblem: problem,
    lastActivityAt: Date.now(),
  };
}

// Serialize for saving
export function serializeState(state: SessionState): string {
  return JSON.stringify(state, null, 2);
}

// Deserialize for loading
export function deserializeState(json: string): SessionState {
  return JSON.parse(json) as SessionState;
}
