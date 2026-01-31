import { SessionState, SolutionSpec, DimensionId } from './types.js';
import { DIMENSIONS, canSignOff } from './dimensions.js';

export function generateSolutionSpec(state: SessionState): SolutionSpec {
  const { ready, gaps } = canSignOff(state.dimensions);

  // Extract best evidence for each section
  const clarityEvidence = state.dimensions.solution_clarity.evidence;
  const valueEvidence = state.dimensions.user_value.evidence;
  const scopeEvidence = state.dimensions.scope_boundaries.evidence;
  const successEvidence = state.dimensions.success_criteria.evidence;

  // Parse scope evidence into structured format
  const scopeIncluded: string[] = [];
  const scopeExcluded: string[] = [];
  const scopeFuture: string[] = [];

  for (const ev of scopeEvidence) {
    const lower = ev.toLowerCase();
    if (lower.includes('not ') || lower.includes('won\'t') || lower.includes('doesn\'t') || lower.includes('exclude')) {
      scopeExcluded.push(ev);
    } else if (lower.includes('later') || lower.includes('future') || lower.includes('v2') || lower.includes('eventually')) {
      scopeFuture.push(ev);
    } else {
      scopeIncluded.push(ev);
    }
  }

  return {
    solutionSummary: clarityEvidence[clarityEvidence.length - 1] || 'Not yet defined',
    userValue: valueEvidence[valueEvidence.length - 1] || 'Not yet defined',
    scope: {
      included: scopeIncluded.length > 0 ? scopeIncluded : ['Not yet defined'],
      excluded: scopeExcluded.length > 0 ? scopeExcluded : ['Not yet defined'],
      futureConsiderations: scopeFuture.length > 0 ? scopeFuture : [],
    },
    successCriteria: successEvidence.length > 0 ? successEvidence : ['Not yet defined'],
    userFlow: '', // Will be generated separately
    gaps,
    confidence: ready ? 'high' : gaps.length <= 1 ? 'medium' : 'low',
    problemContext: state.loadedProblem || undefined,
  };
}

export function formatOutput(spec: SolutionSpec, flowDiagram?: string): string {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '                      SOLUTION SPECIFICATION                    ',
    '═══════════════════════════════════════════════════════════════',
    '',
  ];

  if (spec.problemContext) {
    lines.push('PROBLEM CONTEXT:');
    lines.push(`  ${spec.problemContext.problem}`);
    lines.push(`  Who: ${spec.problemContext.who}`);
    lines.push('');
  }

  lines.push(`SOLUTION: ${spec.solutionSummary}`);
  lines.push('');
  lines.push(`USER VALUE: ${spec.userValue}`);
  lines.push('');
  lines.push('SCOPE:');
  lines.push('  Included:');
  for (const item of spec.scope.included) {
    lines.push(`    • ${item}`);
  }
  lines.push('  Excluded:');
  for (const item of spec.scope.excluded) {
    lines.push(`    • ${item}`);
  }
  if (spec.scope.futureConsiderations.length > 0) {
    lines.push('  Future Considerations:');
    for (const item of spec.scope.futureConsiderations) {
      lines.push(`    • ${item}`);
    }
  }
  lines.push('');
  lines.push('SUCCESS CRITERIA:');
  for (const criterion of spec.successCriteria) {
    lines.push(`  • ${criterion}`);
  }
  lines.push('');

  if (flowDiagram) {
    lines.push('USER FLOW:');
    lines.push('');
    lines.push(flowDiagram);
    lines.push('');
  }

  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`Confidence: ${spec.confidence.toUpperCase()}`);

  if (spec.gaps.length > 0) {
    lines.push('');
    lines.push('⚠️  Gaps remaining:');
    for (const gap of spec.gaps) {
      lines.push(`   • ${DIMENSIONS[gap].name}: needs more detail`);
    }
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

export function formatProgress(state: SessionState): string {
  const lines = ['📊 Dimension Progress:\n'];

  const statusEmoji: Record<string, string> = {
    not_started: '⬜',
    weak: '🟨',
    partial: '🟧',
    strong: '🟩',
  };

  for (const [id, dim] of Object.entries(state.dimensions)) {
    const def = DIMENSIONS[id as DimensionId];
    const emoji = statusEmoji[dim.coverage];
    const threshold = def.signOffThreshold;
    const meetsThreshold = dim.coverage === 'strong'; // All require strong

    lines.push(`${emoji} ${def.name}: ${dim.coverage}${meetsThreshold ? ' ✓' : ` (need: ${threshold})`}`);
  }

  const { ready } = canSignOff(state.dimensions);
  lines.push('');
  lines.push(ready ? '✅ Ready for sign-off!' : '⏳ Keep going...');

  return lines.join('\n');
}
