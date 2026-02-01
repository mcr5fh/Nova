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
  problem_clarity: {
    id: 'problem_clarity',
    name: 'Problem Clarity',
    description: 'A clear, single-sentence description of customer pain',
    goal: 'Single-sentence customer pain point',
    exampleGood: 'Enterprise customers lose 4+ hours/week manually reconciling data between systems',
    exampleBad: 'We need better API integration',
    probeQuestions: [
      "Can you describe what's actually happening to the customer when this problem occurs?",
      "If I watched a customer experience this, what would I see them struggling with?",
      "What task is the customer trying to accomplish when they hit this friction?",
      "You mentioned a solution—but what's the underlying pain that solution would address?",
    ],
    signOffThreshold: 'strong',
  },
  customer_context: {
    id: 'customer_context',
    name: 'Customer & Context',
    description: 'Who experiences this and in what situation',
    goal: 'Specific user segment + situational context',
    exampleGood: 'Finance teams at 50-500 employee companies, during month-end close',
    exampleBad: 'Our users',
    probeQuestions: [
      "Which specific type of user experiences this most acutely?",
      "What's different about the users who have this problem vs those who don't?",
      "When does this problem typically surface—what triggers it?",
      "Is this an everyday problem or tied to specific events/workflows?",
    ],
    signOffThreshold: 'strong',
  },
  severity_frequency: {
    id: 'severity_frequency',
    name: 'Severity & Frequency',
    description: 'How often this occurs and how painful it is',
    goal: 'Quantified frequency and impact level',
    exampleGood: 'Weekly during reconciliation, blocks team for 1-2 days',
    exampleBad: "It's really annoying",
    probeQuestions: [
      "How often does a typical affected user encounter this?",
      "When it happens, what's the consequence? Lost time? Failed task? Workaround?",
      "On a scale of 'minor annoyance' to 'complete blocker', where does this land?",
      "Do users have a workaround, and if so, how painful is it?",
    ],
    signOffThreshold: 'partial',
  },
  root_cause: {
    id: 'root_cause',
    name: 'Root Cause',
    description: 'The underlying issue, not surface symptoms',
    goal: 'Fundamental reason the problem exists',
    exampleGood: "Systems don't share a common data model, requiring manual translation",
    exampleBad: 'The UI is confusing',
    probeQuestions: [
      "Why does this problem exist in the first place?",
      "If we peeled back the symptom, what's the structural issue underneath?",
      "Has this always been a problem, or did something change to create it?",
      "What would need to be true about the world for this problem not to exist?",
    ],
    signOffThreshold: 'partial',
  },
  business_impact: {
    id: 'business_impact',
    name: 'Business Impact',
    description: 'Measurable business consequences if unsolved',
    goal: 'Quantified revenue/cost/strategic impact',
    exampleGood: 'Costs $200K/year in labor, primary driver of 15% enterprise churn',
    exampleBad: 'Customers would like it',
    probeQuestions: [
      "If we never solve this, what happens to the business?",
      "Can you connect this to revenue, retention, or cost?",
      "How does this compare in priority to other problems you could solve?",
      "What's the opportunity cost of NOT solving this?",
    ],
    signOffThreshold: 'strong',
  },
  validation: {
    id: 'validation',
    name: 'Validation',
    description: 'How to test that this problem is real and worth solving',
    goal: 'Concrete validation approach',
    exampleGood: "Interview 10 finance managers, ask if they'd pay $X to solve this",
    exampleBad: "We'll see if people use the feature",
    probeQuestions: [
      "How would you prove this problem exists before building anything?",
      "What would convince you this is NOT worth solving?",
      "Who could you talk to this week to validate this?",
      "What's the cheapest experiment to test your assumption?",
    ],
    signOffThreshold: 'partial',
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
