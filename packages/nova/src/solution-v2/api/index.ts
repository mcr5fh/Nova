export { SolutionArchitectV2 } from './architect.js';

// Re-export all types from core
export type {
  ArchitectConfigV2,
  SessionStateV2,
  SolutionSpecV2,
  DimensionIdV2,
  CoverageLevelV2,
  MessageV2,
  ExportFormatV2,
  ExportedSolutionSpecV2,
  LoadedProblem,
  CodebaseContext,
  FileInfo,
  FileRelevance,
  PatternInfo,
  DependencyInfo,
  DependencyType,
  EdgeCase,
  EdgeCaseSeverity,
  EdgeCaseSource,
  TShirtSize,
  TShirtSizeValue,
  ConfidenceLevel,
  ImplementationDiagram,
  DiagramType,
  SessionPhase,
  MessageMetadata,
  EvaluationResultV2,
} from '../core/types.js';

// Re-export dimension utilities
export { DIMENSIONS_V2, canSignOffV2 } from '../core/dimensions.js';
export type { DimensionDefinitionV2 } from '../core/dimensions.js';

// Re-export output utilities
export { formatV2Output, formatEdgeCasesSection, formatComplexitySection, formatMermaidSection, formatUXFlow } from '../core/output-formatter.js';

// Re-export generator utilities
export { generateImplementationDiagram, createMermaidFlowchart, generateFallbackDiagram } from '../core/mermaid-generator.js';
export type { FlowchartNode, FlowchartEdge } from '../core/mermaid-generator.js';

export { analyzeEdgeCases, parseEdgeCasesFromResponse, categorizeEdgeCase } from '../core/edge-case-analyzer.js';
export type { EdgeCaseCategory, ParsedEdgeCase } from '../core/edge-case-analyzer.js';

export { estimateComplexity, calculateBaseComplexity, adjustForIntegrations } from '../core/complexity-estimator.js';

// Re-export prompt utilities
export { buildSystemPromptV2, buildEvaluationPromptV2, buildCodebaseContextSection, buildEdgeCaseSection } from '../core/prompt-builder.js';

// Re-export state machine utilities
export {
  createSessionV2,
  addMessageV2,
  applyEvaluationV2,
  selectNextFocusV2,
  setCodebaseContext,
  addEdgeCase,
  setSessionPhase,
  setLoadedProblemV2,
  serializeStateV2,
  deserializeStateV2,
} from '../core/state-machine.js';
