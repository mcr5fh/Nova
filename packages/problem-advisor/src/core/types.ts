// Coverage levels for each dimension
export type CoverageLevel = 'not_started' | 'weak' | 'partial' | 'strong';

// The 6 dimensions we track
export type DimensionId =
  | 'problem_clarity'
  | 'customer_context'
  | 'severity_frequency'
  | 'root_cause'
  | 'business_impact'
  | 'validation';

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
}

// Message in conversation
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Final output structure
export interface ProblemStatement {
  problem: string;
  who: string;
  frequencySeverity: string;
  businessImpact: string;
  validation: string;
  gaps: DimensionId[];      // Dimensions that didn't reach threshold
  confidence: 'low' | 'medium' | 'high';
}

// Evaluation result from LLM
export interface EvaluationResult {
  dimensionId: DimensionId;
  newCoverage: CoverageLevel;
  evidence: string[];
  reasoning: string;
}

// Configuration options
export interface AdvisorConfig {
  llmProvider: 'anthropic';
  modelId: string;
  apiKey: string;
  streamResponses?: boolean;
  maxTurns?: number;        // Safety limit, default 50
}
