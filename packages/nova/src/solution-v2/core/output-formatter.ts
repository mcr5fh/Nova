import type { SolutionSpecV2, EdgeCase, TShirtSize, ImplementationDiagram, DimensionIdV2 } from './types.js';
import { DIMENSIONS_V2 } from './dimensions.js';

/**
 * Format the complete v2 solution spec as markdown.
 * Combines UX flow, Mermaid diagram, edge cases, and sizing into
 * a format suitable for implementation handoff.
 */
export function formatV2Output(spec: SolutionSpecV2): string {
  const sections: string[] = [];

  // Header
  sections.push('# Solution Specification\n');

  // Problem context (if present)
  if (spec.problemContext) {
    sections.push(formatProblemContext(spec.problemContext));
  }

  // Summary
  sections.push('## Summary\n');
  sections.push(spec.solutionSummary + '\n');

  // User Value
  sections.push('## User Value\n');
  sections.push(spec.userValue + '\n');

  // Scope
  sections.push(formatScopeSection(spec.scope));

  // Success Criteria
  sections.push(formatSuccessCriteria(spec.successCriteria));

  // User Flow
  sections.push('## User Flow\n');
  sections.push(formatUXFlow(spec.userFlow) + '\n');

  // Technical Constraints
  if (spec.technicalConstraints.length > 0) {
    sections.push(formatTechnicalConstraints(spec.technicalConstraints));
  }

  // Edge Cases
  sections.push('## Edge Cases\n');
  sections.push(formatEdgeCasesSection(spec.edgeCases) + '\n');

  // Effort Estimate
  sections.push('## Effort Estimate\n');
  sections.push(formatComplexitySection(spec.effortEstimate) + '\n');

  // Implementation Diagram
  sections.push('## Implementation Diagram\n');
  sections.push(formatMermaidSection(spec.implementationDiagram) + '\n');

  // Confidence and Gaps
  sections.push(formatConfidenceSection(spec.confidence, spec.gaps));

  return sections.join('\n');
}

/**
 * Format problem context section
 */
function formatProblemContext(context: { problem: string; who: string }): string {
  const lines = [
    '## Problem Context\n',
    `**Problem:** ${context.problem}`,
    `**Who:** ${context.who}`,
    '',
  ];
  return lines.join('\n');
}

/**
 * Format scope section with included/excluded/future
 */
function formatScopeSection(scope: SolutionSpecV2['scope']): string {
  const lines = ['## Scope\n', '### Included'];
  for (const item of scope.included) {
    lines.push(`- ${item}`);
  }

  lines.push('', '### Excluded');
  for (const item of scope.excluded) {
    lines.push(`- ${item}`);
  }

  if (scope.futureConsiderations.length > 0) {
    lines.push('', '### Future Considerations');
    for (const item of scope.futureConsiderations) {
      lines.push(`- ${item}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format success criteria as a checklist
 */
function formatSuccessCriteria(criteria: string[]): string {
  const lines = ['## Success Criteria\n'];
  for (const criterion of criteria) {
    lines.push(`- [ ] ${criterion}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Format UX flow description
 */
export function formatUXFlow(flow: string): string {
  if (!flow || flow.trim() === '') {
    return '_Not yet defined_';
  }
  return flow;
}

/**
 * Format technical constraints section
 */
function formatTechnicalConstraints(constraints: string[]): string {
  const lines = ['## Technical Constraints\n'];
  for (const constraint of constraints) {
    lines.push(`- ${constraint}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Format edge cases section with severity badges
 */
export function formatEdgeCasesSection(edgeCases: EdgeCase[]): string {
  if (edgeCases.length === 0) {
    return '_No edge cases identified yet._';
  }

  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };

  const lines: string[] = [];

  for (const ec of edgeCases) {
    const emoji = severityEmoji[ec.severity] || '⚪';
    lines.push(`### ${emoji} ${ec.description}`);
    lines.push(`**Severity:** ${ec.severity}`);
    lines.push(`**Recommendation:** ${ec.recommendation}`);

    if (ec.affectedFiles && ec.affectedFiles.length > 0) {
      lines.push(`**Affected files:** ${ec.affectedFiles.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format complexity/effort estimate section
 */
export function formatComplexitySection(estimate: TShirtSize): string {
  const lines: string[] = [];

  lines.push(`**Size:** ${estimate.size}`);
  lines.push(`**Confidence:** ${estimate.confidence}`);
  lines.push('');
  lines.push(`**Reasoning:** ${estimate.reasoning}`);

  if (estimate.factors.length > 0) {
    lines.push('');
    lines.push('**Factors:**');
    for (const factor of estimate.factors) {
      lines.push(`- ${factor}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format mermaid diagram section
 */
export function formatMermaidSection(diagram: ImplementationDiagram): string {
  if (!diagram.mermaid || diagram.mermaid.trim() === '') {
    return '_Diagram not available_';
  }

  const lines: string[] = [];

  if (diagram.description) {
    lines.push(`_${diagram.description}_`);
    lines.push('');
  }

  lines.push('```mermaid');
  lines.push(diagram.mermaid);
  lines.push('```');

  return lines.join('\n');
}

/**
 * Format confidence and gaps section
 */
function formatConfidenceSection(confidence: string, gaps: DimensionIdV2[]): string {
  const lines: string[] = [];

  lines.push('---\n');
  lines.push(`**Confidence:** ${confidence.toUpperCase()}`);

  if (gaps.length > 0) {
    lines.push('');
    lines.push('## Gaps\n');
    lines.push('The following dimensions need more detail:\n');
    for (const gap of gaps) {
      const dim = DIMENSIONS_V2[gap];
      lines.push(`- **${dim.name}** (${gap}): ${dim.description}`);
    }
  }

  return lines.join('\n');
}
