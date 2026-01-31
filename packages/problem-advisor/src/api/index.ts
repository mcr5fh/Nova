export { ProblemAdvisor } from './advisor.js';
export type {
  AdvisorConfig,
  SessionState,
  ProblemStatement,
  DimensionId,
  CoverageLevel,
  Message
} from '../core/types.js';
export { DIMENSIONS, canSignOff } from '../core/dimensions.js';
export { formatOutput, formatProgress, generateProblemStatement } from '../core/output-formatter.js';
