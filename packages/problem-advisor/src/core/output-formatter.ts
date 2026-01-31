import { SessionState, ProblemStatement, DimensionId } from './types';
import { DIMENSIONS, canSignOff } from './dimensions';

export function generateProblemStatement(state: SessionState): ProblemStatement {
  const { ready, gaps } = canSignOff(state.dimensions);

  // Extract best evidence for each section
  const problemEvidence = state.dimensions.problem_clarity.evidence;
  const whoEvidence = state.dimensions.customer_context.evidence;
  const severityEvidence = state.dimensions.severity_frequency.evidence;
  const impactEvidence = state.dimensions.business_impact.evidence;
  const validationEvidence = state.dimensions.validation.evidence;

  return {
    problem: problemEvidence[problemEvidence.length - 1] || 'Not yet defined',
    who: whoEvidence[whoEvidence.length - 1] || 'Not yet defined',
    frequencySeverity: severityEvidence[severityEvidence.length - 1] || 'Not yet defined',
    businessImpact: impactEvidence[impactEvidence.length - 1] || 'Not yet defined',
    validation: validationEvidence[validationEvidence.length - 1] || 'Not yet defined',
    gaps,
    confidence: ready ? 'high' : gaps.length <= 2 ? 'medium' : 'low',
  };
}

export function formatOutput(statement: ProblemStatement): string {
  const lines = [
    '═══════════════════════════════════════════════════════',
    '                   PROBLEM STATEMENT                    ',
    '═══════════════════════════════════════════════════════',
    '',
    `PROBLEM: ${statement.problem}`,
    '',
    `WHO: ${statement.who}`,
    '',
    `FREQUENCY/SEVERITY: ${statement.frequencySeverity}`,
    '',
    `BUSINESS IMPACT: ${statement.businessImpact}`,
    '',
    `VALIDATION: ${statement.validation}`,
    '',
    '───────────────────────────────────────────────────────',
    `Confidence: ${statement.confidence.toUpperCase()}`,
  ];

  if (statement.gaps.length > 0) {
    lines.push('');
    lines.push('⚠️  Gaps remaining:');
    for (const gap of statement.gaps) {
      lines.push(`   • ${DIMENSIONS[gap].name}: needs more detail`);
    }
  }

  lines.push('═══════════════════════════════════════════════════════');

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
    const needed = dim.coverage === threshold ||
      ['partial', 'strong'].includes(dim.coverage) && threshold === 'partial' ||
      dim.coverage === 'strong' && threshold === 'strong';

    lines.push(`${emoji} ${def.name}: ${dim.coverage}${needed ? ' ✓' : ` (need: ${threshold})`}`);
  }

  const { ready } = canSignOff(state.dimensions);
  lines.push('');
  lines.push(ready ? '✅ Ready for sign-off!' : '⏳ Keep going...');

  return lines.join('\n');
}
