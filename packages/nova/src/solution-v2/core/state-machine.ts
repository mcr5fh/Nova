import type {
  SessionStateV2,
  DimensionIdV2,
  DimensionStateV2,
  CoverageLevelV2,
  EvaluationResultV2,
  CodebaseContext,
  EdgeCase,
  SessionPhase,
  MessageMetadata,
  LoadedProblem,
} from './types.js';
import { DIMENSIONS_V2 } from './dimensions.js';

/**
 * Create a new v2 session with all dimensions initialized
 */
export function createSessionV2(id: string): SessionStateV2 {
  const now = Date.now();
  const dimensions = {} as Record<DimensionIdV2, DimensionStateV2>;

  for (const dimId of Object.keys(DIMENSIONS_V2) as DimensionIdV2[]) {
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
    currentFocus: 'solution_clarity', // Start with first dimension
    startedAt: now,
    lastActivityAt: now,
    loadedProblem: null,

    // v2 additions
    codebaseContext: null,
    discoveredEdgeCases: [],
    currentPhase: 'gathering',
  };
}

/**
 * Add a message to the conversation history
 */
export function addMessageV2(
  state: SessionStateV2,
  role: 'user' | 'assistant',
  content: string,
  metadata?: MessageMetadata
): SessionStateV2 {
  return {
    ...state,
    conversationHistory: [
      ...state.conversationHistory,
      { role, content, timestamp: Date.now(), metadata },
    ],
    lastActivityAt: Date.now(),
  };
}

/**
 * Apply an evaluation result, updating dimension coverage
 * Coverage can only go up, never down
 */
export function applyEvaluationV2(
  state: SessionStateV2,
  evaluation: EvaluationResultV2
): SessionStateV2 {
  const { dimensionId, newCoverage, evidence } = evaluation;
  const existing = state.dimensions[dimensionId];

  // Only upgrade coverage, never downgrade
  const levelOrder: CoverageLevelV2[] = ['not_started', 'weak', 'partial', 'strong'];
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

/**
 * Select the next dimension to focus on based on priority and coverage
 * Returns null if all dimensions meet their thresholds
 */
export function selectNextFocusV2(state: SessionStateV2): DimensionIdV2 | null {
  // Priority order for focusing
  // v1 dimensions first (require strong), then v2 dimensions (require partial)
  const priorityOrder: DimensionIdV2[] = [
    'solution_clarity',
    'user_value',
    'scope_boundaries',
    'success_criteria',
    'technical_constraints',
    'edge_cases',
  ];

  const levelOrder: CoverageLevelV2[] = ['not_started', 'weak', 'partial', 'strong'];

  for (const dimId of priorityOrder) {
    const current = state.dimensions[dimId].coverage;
    const threshold = DIMENSIONS_V2[dimId].signOffThreshold;
    if (levelOrder.indexOf(current) < levelOrder.indexOf(threshold)) {
      return dimId;
    }
  }

  return null; // All dimensions meet threshold
}

/**
 * Inject codebase context discovered by CC/Claude Code
 */
export function setCodebaseContext(
  state: SessionStateV2,
  context: CodebaseContext
): SessionStateV2 {
  return {
    ...state,
    codebaseContext: context,
    lastActivityAt: Date.now(),
  };
}

/**
 * Add a discovered edge case to the session
 */
export function addEdgeCase(
  state: SessionStateV2,
  edgeCase: EdgeCase
): SessionStateV2 {
  return {
    ...state,
    discoveredEdgeCases: [...state.discoveredEdgeCases, edgeCase],
    lastActivityAt: Date.now(),
  };
}

/**
 * Update the current session phase
 */
export function setSessionPhase(
  state: SessionStateV2,
  phase: SessionPhase
): SessionStateV2 {
  return {
    ...state,
    currentPhase: phase,
    lastActivityAt: Date.now(),
  };
}

/**
 * Set the loaded problem context from problem-advisor
 */
export function setLoadedProblemV2(
  state: SessionStateV2,
  problem: LoadedProblem
): SessionStateV2 {
  return {
    ...state,
    loadedProblem: problem,
    lastActivityAt: Date.now(),
  };
}

/**
 * Serialize state for saving
 */
export function serializeStateV2(state: SessionStateV2): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Deserialize state for loading
 */
export function deserializeStateV2(json: string): SessionStateV2 {
  return JSON.parse(json) as SessionStateV2;
}
