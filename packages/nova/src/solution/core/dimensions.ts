import type { DimensionId, CoverageLevel } from './types.js';

export interface DimensionDefinition {
  id: DimensionId;
  name: string;
  description: string;
  goal: string;
  exampleGood: string;
  exampleBad: string;
  probeQuestions: string[];
  signOffThreshold: CoverageLevel;  // Minimum for sign-off
}

export const DIMENSIONS: Record<DimensionId, DimensionDefinition> = {
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
};

// Utility to check if all sign-off thresholds are met
export function canSignOff(
  states: Record<DimensionId, { coverage: CoverageLevel }>
): { ready: boolean; gaps: DimensionId[] } {
  const gaps: DimensionId[] = [];
  const levelOrder: CoverageLevel[] = ['not_started', 'weak', 'partial', 'strong'];

  for (const [id, def] of Object.entries(DIMENSIONS)) {
    const current = states[id as DimensionId].coverage;
    const threshold = def.signOffThreshold;
    if (levelOrder.indexOf(current) < levelOrder.indexOf(threshold)) {
      gaps.push(id as DimensionId);
    }
  }

  return { ready: gaps.length === 0, gaps };
}
