export { ProblemAdvisor } from './advisor.js';
export type { SaveProjectResult } from './advisor.js';
export type {
  AdvisorConfig,
  SessionState,
  ProblemStatement,
  DimensionId,
  CoverageLevel,
  Message,
  ExportFormat,
  ExportedProblemStatement
} from '../core/types.js';
export { DIMENSIONS, canSignOff } from '../core/dimensions.js';
export { formatOutput, formatProgress, generateProblemStatement } from '../core/output-formatter.js';
export {
  exportToJson,
  exportToMarkdown,
  exportSession,
  createExportData,
  exportToProjectMarkdown,
  writeProjectFile,
  detectSaveIntent,
} from '../core/file-exporter.js';
export type { SaveIntentResult } from '../core/file-exporter.js';
