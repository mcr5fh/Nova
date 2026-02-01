// ============================================================================
// Solution Architect v2 Types
// Extends v1 with codebase-aware validation capabilities
// ============================================================================

import type { LoadedProblem } from '../../solution/core/types.js';

// Re-export LoadedProblem for convenience
export type { LoadedProblem };

// ============================================================================
// Codebase Context Types (discovered by CC/Claude Code)
// ============================================================================

/** Relevance level for discovered files */
export type FileRelevance = 'high' | 'medium' | 'low';

/** Information about a discovered file in the codebase */
export interface FileInfo {
  /** Relative path from project root */
  path: string;
  /** Type/category of the file (e.g., 'component', 'service', 'config') */
  type: string;
  /** Brief description of what the file does */
  description: string;
  /** How relevant this file is to the solution */
  relevance: FileRelevance;
}

/** A pattern or convention discovered in the codebase */
export interface PatternInfo {
  /** Name of the pattern (e.g., 'Repository Pattern', 'Factory Pattern') */
  name: string;
  /** Where this pattern is implemented */
  location: string;
  /** Description of how the pattern is used */
  description: string;
  /** Example files that demonstrate this pattern */
  examples: string[];
}

/** Dependency type classification */
export type DependencyType = 'production' | 'development' | 'peer' | 'optional';

/** Information about a project dependency */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Version or version range */
  version: string;
  /** Type of dependency */
  type: DependencyType;
  /** How this dependency is used */
  usage: string;
}

/** Complete codebase context discovered during analysis */
export interface CodebaseContext {
  /** Relevant files discovered */
  files: FileInfo[];
  /** Patterns/conventions identified */
  patterns: PatternInfo[];
  /** Dependencies analyzed */
  dependencies: DependencyInfo[];
  /** Tech stack summary (e.g., ['TypeScript', 'React', 'Node.js']) */
  techStack: string[];
  /** High-level architecture description */
  architecture: string;
  /** When this context was discovered */
  discoveredAt: number;
}

// ============================================================================
// Edge Case Types
// ============================================================================

/** Severity level for edge cases */
export type EdgeCaseSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Source of edge case discovery */
export type EdgeCaseSource = 'codebase_analysis' | 'user_input' | 'llm_inference';

/** An edge case identified during solution design */
export interface EdgeCase {
  /** Unique identifier for this edge case */
  id: string;
  /** Description of the edge case scenario */
  description: string;
  /** How this edge case was discovered */
  source: EdgeCaseSource;
  /** Severity/importance of handling this case */
  severity: EdgeCaseSeverity;
  /** Recommended approach to handle this case */
  recommendation: string;
  /** Files that might need modification to handle this case */
  affectedFiles?: string[];
  /** When this edge case was discovered */
  discoveredAt: number;
}

// ============================================================================
// T-Shirt Size Estimation Types
// ============================================================================

/** T-shirt size values for effort estimation */
export type TShirtSizeValue = 'XS' | 'S' | 'M' | 'L' | 'XL';

/** Confidence level for estimations */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/** T-shirt size effort estimation with reasoning */
export interface TShirtSize {
  /** The size estimate */
  size: TShirtSizeValue;
  /** Explanation of why this size was chosen */
  reasoning: string;
  /** Confidence in this estimate */
  confidence: ConfidenceLevel;
  /** Factors that influenced the estimate */
  factors: string[];
}

// ============================================================================
// Implementation Diagram Types
// ============================================================================

/** Types of mermaid diagrams supported */
export type DiagramType = 'flowchart' | 'sequence' | 'class' | 'state';

/** Mermaid diagram output structure */
export interface ImplementationDiagram {
  /** Type of diagram */
  type: DiagramType;
  /** Raw mermaid diagram syntax */
  mermaid: string;
  /** Human-readable description of what the diagram shows */
  description: string;
  /** When this diagram was generated */
  generatedAt: number;
}

// ============================================================================
// Dimension Types (v2 extends v1)
// ============================================================================

/** Coverage levels for each dimension (same as v1) */
export type CoverageLevelV2 = 'not_started' | 'weak' | 'partial' | 'strong';

/** The 6 solution dimensions we track (v1 + 2 new) */
export type DimensionIdV2 =
  // v1 dimensions
  | 'solution_clarity'
  | 'user_value'
  | 'scope_boundaries'
  | 'success_criteria'
  // v2 additions
  | 'technical_constraints'
  | 'edge_cases';

/** State of a single dimension (v2) */
export interface DimensionStateV2 {
  id: DimensionIdV2;
  coverage: CoverageLevelV2;
  evidence: string[];
  lastUpdated: number;
}

// ============================================================================
// Session State Types (v2)
// ============================================================================

/** Session phases for v2 workflow */
export type SessionPhase = 'gathering' | 'edge_case_discovery' | 'validation' | 'complete';

/** Message metadata for v2 */
export interface MessageMetadata {
  /** Whether codebase context was used in generating this message */
  codebaseContextUsed?: boolean;
  /** Files referenced in this message */
  referencedFiles?: string[];
}

/** Message in conversation (v2 with metadata) */
export interface MessageV2 {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

/** Full conversation state (v2) */
export interface SessionStateV2 {
  id: string;
  dimensions: Record<DimensionIdV2, DimensionStateV2>;
  conversationHistory: MessageV2[];
  currentFocus: DimensionIdV2 | null;
  startedAt: number;
  lastActivityAt: number;
  loadedProblem: LoadedProblem | null;

  // v2 additions
  /** Codebase context injected from CC analysis */
  codebaseContext: CodebaseContext | null;
  /** Edge cases discovered during the session */
  discoveredEdgeCases: EdgeCase[];
  /** Current phase of the v2 workflow */
  currentPhase: SessionPhase;
}

// ============================================================================
// Evaluation Types (v2)
// ============================================================================

/** Evaluation result from LLM (v2) */
export interface EvaluationResultV2 {
  dimensionId: DimensionIdV2;
  newCoverage: CoverageLevelV2;
  evidence: string[];
  reasoning: string;
}

// ============================================================================
// Solution Spec Output (v2)
// ============================================================================

/** Final output structure (v2 extends v1) */
export interface SolutionSpecV2 {
  // v1 fields
  solutionSummary: string;
  userValue: string;
  scope: {
    included: string[];
    excluded: string[];
    futureConsiderations: string[];
  };
  successCriteria: string[];
  userFlow: string;
  gaps: DimensionIdV2[];
  confidence: ConfidenceLevel;
  problemContext?: LoadedProblem;

  // v2 additions
  /** Codebase context that informed this solution */
  codebaseContext?: CodebaseContext;
  /** Edge cases identified during design */
  edgeCases: EdgeCase[];
  /** T-shirt size effort estimate */
  effortEstimate: TShirtSize;
  /** Implementation diagram(s) */
  implementationDiagram: ImplementationDiagram;
  /** Technical constraints identified */
  technicalConstraints: string[];
}

// ============================================================================
// Configuration Types (v2)
// ============================================================================

/** Configuration options for v2 architect */
export interface ArchitectConfigV2 {
  llmProvider: 'anthropic';
  modelId: string;
  apiKey: string;
  streamResponses?: boolean;
  maxTurns?: number;
  /** Enable codebase context injection */
  enableCodebaseContext?: boolean;
  /** Path to codebase for analysis */
  codebasePath?: string;
}

// ============================================================================
// Export Types (v2)
// ============================================================================

/** Export formats for project files (v2) */
export type ExportFormatV2 = 'json' | 'markdown';

/** Structured export data (v2) */
export interface ExportedSolutionSpecV2 {
  solutionSummary: string;
  userValue: string;
  scope: {
    included: string[];
    excluded: string[];
    futureConsiderations: string[];
  };
  successCriteria: string[];
  userFlow: string;
  confidence: ConfidenceLevel;
  gaps: DimensionIdV2[];
  problemContext?: LoadedProblem;

  // v2 additions
  codebaseContext?: CodebaseContext;
  edgeCases: EdgeCase[];
  effortEstimate: TShirtSize;
  implementationDiagram: ImplementationDiagram;
  technicalConstraints: string[];

  metadata: {
    sessionId: string;
    exportedAt: string;
    version: string;
  };
  dimensions: Record<DimensionIdV2, {
    coverage: CoverageLevelV2;
    evidence: string[];
  }>;
}
