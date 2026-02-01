// Main export file for nova package

// Problem Advisor exports
export { ProblemAdvisor } from './problem/api/advisor.js';
export type { SaveProjectResult } from './problem/api/advisor.js';
export type {
  AdvisorConfig,
  SessionState as ProblemSessionState,
  ProblemStatement,
  DimensionId as ProblemDimensionId,
  CoverageLevel as ProblemCoverageLevel,
  Message as ProblemMessage,
  ExportFormat as ProblemExportFormat,
  ExportedProblemStatement
} from './problem/core/types.js';
export {
  DIMENSIONS as PROBLEM_DIMENSIONS,
  canSignOff as canProblemSignOff
} from './problem/core/dimensions.js';
export {
  formatOutput as formatProblemOutput,
  formatProgress as formatProblemProgress,
  generateProblemStatement
} from './problem/core/output-formatter.js';
export {
  exportToJson as exportProblemToJson,
  exportToMarkdown as exportProblemToMarkdown,
  exportSession as exportProblemSession,
  createExportData as createProblemExportData,
  exportToProjectMarkdown,
  writeProjectFile,
  detectSaveIntent as detectProblemSaveIntent,
} from './problem/core/file-exporter.js';
export type { SaveIntentResult as ProblemSaveIntentResult } from './problem/core/file-exporter.js';

// Solution Architect exports
export { SolutionArchitect } from './solution/api/architect.js';
export type {
  ArchitectConfig,
  SessionState as SolutionSessionState,
  SolutionSpec,
  DimensionId as SolutionDimensionId,
  CoverageLevel as SolutionCoverageLevel,
  Message as SolutionMessage,
  ExportFormat as SolutionExportFormat,
  ExportedSolutionSpec,
  LoadedProblem
} from './solution/core/types.js';
export {
  DIMENSIONS as SOLUTION_DIMENSIONS,
  canSignOff as canSolutionSignOff
} from './solution/core/dimensions.js';
export {
  formatOutput as formatSolutionOutput,
  formatProgress as formatSolutionProgress,
  generateSolutionSpec
} from './solution/core/output-formatter.js';
export {
  exportToJson as exportSolutionToJson,
  exportToMarkdown as exportSolutionToMarkdown,
  exportSession as exportSolutionSession,
  createExportData as createSolutionExportData,
  exportToSolutionMarkdown,
  writeSolutionFile,
  detectSaveIntent as detectSolutionSaveIntent,
  loadProblemStatement,
} from './solution/core/file-exporter.js';
export type {
  SaveIntentResult as SolutionSaveIntentResult,
  SaveSolutionResult
} from './solution/core/file-exporter.js';
export { generateFlowDiagram, createFlowFromSteps } from './solution/core/flow-diagram.js';
export {
  detectFrontendContext,
  generateDesignOptions,
  formatDesignOptions,
  refineDesign,
} from './solution/core/design-iteration.js';
export type { DesignOption, DesignIterationResult } from './solution/core/design-iteration.js';

// Shared LLM exports
export { AnthropicAdapter } from './shared/llm/anthropic.js';
export type { LLMAdapter, LLMMessage, LLMResponse, LLMStreamChunk } from './shared/llm/types.js';
