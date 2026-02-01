export { SolutionArchitect } from './architect.js';
export type {
  ArchitectConfig,
  SessionState,
  SolutionSpec,
  DimensionId,
  CoverageLevel,
  Message,
  ExportFormat,
  ExportedSolutionSpec,
  LoadedProblem
} from '../core/types.js';
export { DIMENSIONS, canSignOff } from '../core/dimensions.js';
export { formatOutput, formatProgress, generateSolutionSpec } from '../core/output-formatter.js';
export {
  exportToJson,
  exportToMarkdown,
  exportSession,
  createExportData,
  exportToSolutionMarkdown,
  writeSolutionFile,
  detectSaveIntent,
  loadProblemStatement,
} from '../core/file-exporter.js';
export type { SaveIntentResult, SaveSolutionResult } from '../core/file-exporter.js';
export { generateFlowDiagram, createFlowFromSteps } from '../core/flow-diagram.js';
export {
  detectFrontendContext,
  generateDesignOptions,
  formatDesignOptions,
  refineDesign,
} from '../core/design-iteration.js';
export type { DesignOption, DesignIterationResult } from '../core/design-iteration.js';
