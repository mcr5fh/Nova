import type { DimensionIdV2, CoverageLevelV2 } from './types.js';

export interface DimensionDefinitionV2 {
  id: DimensionIdV2;
  name: string;
  description: string;
  goal: string;
  exampleGood: string;
  exampleBad: string;
  probeQuestions: string[];
  signOffThreshold: CoverageLevelV2;
}

export const DIMENSIONS_V2: Record<DimensionIdV2, DimensionDefinitionV2> = {
  // =========================================================================
  // v1 Dimensions (carried forward)
  // =========================================================================
  solution_clarity: {
    id: 'solution_clarity',
    name: 'Solution Clarity',
    description: 'A clear, concise description of what we\'re building',
    goal: 'Single-sentence description of the solution',
    exampleGood: 'A CLI tool that interviews users to nail down problem statements through guided questioning',
    exampleBad: 'A thing that helps with problems',
    probeQuestions: [
      'Can you describe in one sentence what this solution is?',
      'What metaphor or analogy captures what this does?',
      'If you had to explain this to a colleague in 30 seconds, what would you say?',
      'What\'s the core concept that makes this different from doing nothing?',
    ],
    signOffThreshold: 'strong',
  },

  user_value: {
    id: 'user_value',
    name: 'User Value',
    description: 'How users interact with it and what value it provides',
    goal: 'Clear user journey and value proposition',
    exampleGood: 'Product managers run it before writing specs - they get a validated problem statement in 15 mins',
    exampleBad: 'It\'s useful for anyone',
    probeQuestions: [
      'Who specifically will use this, and what triggers them to reach for it?',
      'Walk me through the user journey from start to finish.',
      'What value do they get that they couldn\'t get before?',
      'What does success look like for a typical user session?',
    ],
    signOffThreshold: 'strong',
  },

  scope_boundaries: {
    id: 'scope_boundaries',
    name: 'Scope Boundaries',
    description: 'What\'s explicitly in scope and out of scope',
    goal: 'Clear boundaries around what this does and doesn\'t do',
    exampleGood: 'Does NOT help with implementation - only what to build. v1 is CLI only, no web UI',
    exampleBad: 'It does everything the user needs',
    probeQuestions: [
      'What does this explicitly NOT do?',
      'What\'s the minimal viable version that still delivers value?',
      'What might be added later but isn\'t in v1?',
      'Where does this solution end and other tools/processes begin?',
    ],
    signOffThreshold: 'strong',
  },

  success_criteria: {
    id: 'success_criteria',
    name: 'Success Criteria',
    description: 'How we\'ll know the solution works',
    goal: 'Measurable or observable indicators of success',
    exampleGood: 'Users can take the output directly to implementation without backtracking',
    exampleBad: 'It\'s successful if people like it',
    probeQuestions: [
      'How will you know if this solution works?',
      'What behavior change indicates success?',
      'What could you measure or observe to validate it\'s working?',
      'What would convince you to keep using this vs abandoning it?',
    ],
    signOffThreshold: 'strong',
  },

  // =========================================================================
  // v2 Additions
  // =========================================================================
  technical_constraints: {
    id: 'technical_constraints',
    name: 'Technical Constraints',
    description: 'Existing technology, systems, and constraints that the solution must work within',
    goal: 'Clear understanding of technical boundaries and integration points',
    exampleGood: 'Must integrate with existing PostgreSQL database, use React for frontend to match current stack, respect rate limits on third-party API',
    exampleBad: 'We\'ll figure out the tech later',
    probeQuestions: [
      'What existing systems or technology must this integrate with?',
      'Are there specific languages, frameworks, or tools that must be used?',
      'What technical limitations or constraints exist (performance, security, compliance)?',
      'Are there any APIs, databases, or services this must connect to?',
      'What deployment environment will this run in?',
    ],
    signOffThreshold: 'partial',
  },

  edge_cases: {
    id: 'edge_cases',
    name: 'Edge Cases',
    description: 'Unusual scenarios, failure modes, and boundary conditions the solution must handle',
    goal: 'Identified edge cases with clear handling strategies',
    exampleGood: 'Handle network timeout by caching last response; gracefully degrade when API is unavailable; validate input to prevent injection',
    exampleBad: 'We\'ll handle errors',
    probeQuestions: [
      'What could go wrong during normal usage?',
      'What happens when external dependencies fail?',
      'What unusual or extreme inputs might users provide?',
      'How should the system behave under heavy load or resource constraints?',
      'What edge cases have you seen in similar systems?',
    ],
    signOffThreshold: 'partial',
  },
};

/**
 * Check if all sign-off thresholds are met for v2 dimensions
 */
export function canSignOffV2(
  states: Record<DimensionIdV2, { coverage: CoverageLevelV2 }>
): { ready: boolean; gaps: DimensionIdV2[] } {
  const gaps: DimensionIdV2[] = [];
  const levelOrder: CoverageLevelV2[] = ['not_started', 'weak', 'partial', 'strong'];

  for (const [id, def] of Object.entries(DIMENSIONS_V2)) {
    const dimId = id as DimensionIdV2;
    const current = states[dimId].coverage;
    const threshold = def.signOffThreshold;
    if (levelOrder.indexOf(current) < levelOrder.indexOf(threshold)) {
      gaps.push(dimId);
    }
  }

  return { ready: gaps.length === 0, gaps };
}
