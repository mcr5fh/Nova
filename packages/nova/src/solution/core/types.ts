// Coverage levels for each dimension
export type CoverageLevel = 'not_started' | 'weak' | 'partial' | 'strong';

// The 4 solution dimensions we track
export type DimensionId =
  | 'solution_clarity'
  | 'user_value'
  | 'scope_boundaries'
  | 'success_criteria';

// State of a single dimension
export interface DimensionState {
  id: DimensionId;
  coverage: CoverageLevel;
  evidence: string[];      // Quotes/facts extracted from conversation
  lastUpdated: number;     // Timestamp
}

// Full conversation state
export interface SessionState {
  id: string;
  dimensions: Record<DimensionId, DimensionState>;
  conversationHistory: Message[];
  currentFocus: DimensionId | null;
  startedAt: number;
  lastActivityAt: number;
  loadedProblem: LoadedProblem | null;  // Problem context from problem-advisor
}

// Message in conversation
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Loaded problem statement from problem-advisor
export interface LoadedProblem {
  problem: string;
  who: string;
  frequencySeverity?: string;
  businessImpact?: string;
  validation?: string;
  confidence?: 'low' | 'medium' | 'high';
  sourceFile: string;
}

// Final output structure
export interface SolutionSpec {
  solutionSummary: string;
  userValue: string;
  scope: {
    included: string[];
    excluded: string[];
    futureConsiderations: string[];
  };
  successCriteria: string[];
  userFlow: string;       // ASCII flow diagram
  gaps: DimensionId[];    // Dimensions that didn't reach threshold
  confidence: 'low' | 'medium' | 'high';
  problemContext?: LoadedProblem;  // Original problem if loaded
}

// Evaluation result from LLM
export interface EvaluationResult {
  dimensionId: DimensionId;
  newCoverage: CoverageLevel;
  evidence: string[];
  reasoning: string;
}

// Configuration options
export interface ArchitectConfig {
  llmProvider: 'anthropic';
  modelId: string;
  apiKey: string;
  streamResponses?: boolean;
  maxTurns?: number;        // Safety limit, default 50
}

// Export formats for project files
export type ExportFormat = 'json' | 'markdown';

// Structured export data
export interface ExportedSolutionSpec {
  solutionSummary: string;
  userValue: string;
  scope: {
    included: string[];
    excluded: string[];
    futureConsiderations: string[];
  };
  successCriteria: string[];
  userFlow: string;
  confidence: 'low' | 'medium' | 'high';
  gaps: DimensionId[];
  problemContext?: LoadedProblem;
  metadata: {
    sessionId: string;
    exportedAt: string;
    version: string;
  };
  dimensions: Record<DimensionId, {
    coverage: CoverageLevel;
    evidence: string[];
  }>;
}
