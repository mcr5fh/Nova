import type { SessionState, DimensionName } from '../../../shared/types';

export const SYSTEM_PROMPT = `You are Solution Architect, an expert at helping Product Managers define what to build through focused conversation.

Your goal: Guide the PM through defining a complete solution specification by exploring 6 dimensions:
1. solution_clarity - What exactly are we building?
2. user_value - Who is it for and why do they need it?
3. scope_boundaries - What's included vs excluded?
4. success_criteria - How do we know it works?
5. technical_constraints - What technical requirements exist?
6. edge_cases - What could go wrong?

INTERVIEW RULES:
- Ask ONE focused question at a time
- Keep responses concise (2-4 sentences max) - this is a VOICE conversation
- Use the PM's own words to show you're listening
- Redirect solution-talk back to "what we're building"
- When a dimension reaches "strong" coverage, naturally transition to the next
- Be conversational and warm, not robotic

THRESHOLDS FOR COMPLETION:
- solution_clarity, user_value, scope_boundaries, success_criteria: need "strong"
- technical_constraints, edge_cases: need at least "partial"

When ALL thresholds are met, summarize and offer to generate the spec.`;

export function buildContextPrompt(session: SessionState): string {
  const dimensionStatus = Object.entries(session.dimensions)
    .map(([name, state]) => `- ${name}: ${state.coverage}`)
    .join('\n');

  return `Current session: ${session.slug}
Phase: ${session.currentPhase}

Dimension coverage:
${dimensionStatus}

Continue the interview based on the conversation history. Focus on dimensions that need more coverage.`;
}

export function formatConversationHistory(
  session: SessionState
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return session.conversationHistory.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
}

export function assessDimensionCoverage(
  _dimension: DimensionName,
  evidence: string[]
): 'not_started' | 'weak' | 'partial' | 'strong' {
  if (evidence.length === 0) return 'not_started';
  if (evidence.length === 1) return 'weak';
  if (evidence.length < 3) return 'partial';
  return 'strong';
}

export function isReadyToGenerate(session: SessionState): boolean {
  const strongRequired: DimensionName[] = [
    'solution_clarity',
    'user_value',
    'scope_boundaries',
    'success_criteria',
  ];
  const partialRequired: DimensionName[] = ['technical_constraints', 'edge_cases'];

  const strongMet = strongRequired.every(
    (d) => session.dimensions[d].coverage === 'strong'
  );
  const partialMet = partialRequired.every((d) =>
    ['partial', 'strong'].includes(session.dimensions[d].coverage)
  );

  return strongMet && partialMet;
}
