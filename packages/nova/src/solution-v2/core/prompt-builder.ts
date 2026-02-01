import type {
  SessionStateV2,
  DimensionIdV2,
  CodebaseContext,
  EdgeCase,
  LoadedProblem,
} from './types.js';
import { DIMENSIONS_V2, canSignOffV2 } from './dimensions.js';

/**
 * Build the system prompt for v2 conversation.
 * Incorporates codebase context and edge case discovery guidance.
 */
export function buildSystemPromptV2(state: SessionStateV2): string {
  const { ready, gaps } = canSignOffV2(state.dimensions);
  const focus = state.currentFocus;

  let progressSummary = Object.entries(state.dimensions)
    .map(([id, dim]) => `- ${DIMENSIONS_V2[id as DimensionIdV2].name}: ${dim.coverage}`)
    .join('\n');

  let problemContext = '';
  if (state.loadedProblem) {
    const p = state.loadedProblem;
    problemContext = `
## Loaded Problem Context
The user has loaded a problem statement from ${p.sourceFile}:

**Problem:** ${p.problem}
**Who:** ${p.who}
${p.frequencySeverity ? `**Frequency/Severity:** ${p.frequencySeverity}` : ''}
${p.businessImpact ? `**Business Impact:** ${p.businessImpact}` : ''}
${p.validation ? `**Validation:** ${p.validation}` : ''}
${p.confidence ? `**Confidence:** ${p.confidence}` : ''}

Use this context when discussing the solution. The problem has already been validated - now help design WHAT to build.
`;
  }

  let codebaseContextSection = '';
  if (state.codebaseContext) {
    codebaseContextSection = `
## Codebase Context
The following context was discovered from the codebase:

${buildCodebaseContextSection(state.codebaseContext)}

Use this context to:
- Suggest solutions that fit existing patterns
- Identify files that may need modification
- Consider integration points with existing code
`;
  }

  let edgeCasesSection = '';
  if (state.discoveredEdgeCases.length > 0) {
    edgeCasesSection = `
## Edge Cases Discovered
${buildEdgeCaseSection(state.discoveredEdgeCases)}

Reference these edge cases when discussing scope and implementation considerations.
`;
  }

  let focusGuidance = '';
  if (focus) {
    const def = DIMENSIONS_V2[focus];
    focusGuidance = `
## Current Focus: ${def.name}

Goal: ${def.goal}

Good example: "${def.exampleGood}"
Bad example: "${def.exampleBad}"

Probe questions to consider:
${def.probeQuestions.map(q => `- ${q}`).join('\n')}
`;
  }

  let phaseGuidance = buildPhaseGuidance(state.currentPhase);

  let signOffGuidance = ready
    ? `
## Ready for Sign-Off
All dimensions meet their thresholds. You may now offer to generate the final solution spec with implementation diagram.
Say something like: "I think we have a clear picture of what to build. Shall I generate the solution spec with an implementation diagram and effort estimate?"
`
    : `
## Not Yet Ready
These dimensions need more work: ${gaps.map(g => DIMENSIONS_V2[g].name).join(', ')}
`;

  return `You are a Solution Architect v2—a codebase-aware designer who helps people identify WHAT to build to solve a problem.

## Your Role
You sit between problem definition and implementation planning:
- **Upstream:** The problem has been defined (ideally by problem-advisor)
- **Your Job:** Figure out WHAT to build—the solution concept, user value, scope, success criteria, technical constraints, and edge cases
- **Downstream:** Implementation planning will figure out HOW to build it

## v2 Enhancements
You have access to codebase context that can inform your solution design:
- Consider existing patterns and conventions
- Identify files that may need modification
- Suggest solutions that fit the current architecture
- Proactively identify edge cases based on code patterns

## Your Personality
- Curious and exploratory, helping users discover the right solution
- Ask clarifying questions to understand the solution space
- Push for specificity: "What does that look like in practice?"
- Help users think through trade-offs without making decisions for them
- Stay focused on WHAT, not HOW (that's for later)
- Proactively surface edge cases and technical constraints

${problemContext}
${codebaseContextSection}
${edgeCasesSection}

## Current Progress
${progressSummary}

${focusGuidance}
${phaseGuidance}
${signOffGuidance}

## Frontend/UI Solutions
If the user describes a solution involving UI or frontend:
- Offer to sketch ASCII mockups showing layout options
- Present 2 alternatives with trade-offs
- Ask which direction feels right before refining
- Iterate on the design based on feedback

## Rules
1. Ask ONE focused question at a time
2. When the user gives a good answer, explicitly acknowledge what was good about it
3. If the user jumps to implementation details, redirect: "Let's nail down what we're building first, then we can figure out how."
4. Keep responses concise (2-4 sentences typical)
5. Use the user's own words when possible to show you're listening
6. When ready to sign off, explicitly say so and offer to generate the solution spec
7. Surface potential edge cases when discussing technical constraints

## Commands the User May Use
- /progress - You should summarize the current dimension states
- /eject - Generate best-effort output with warnings about gaps
- /export [format] - Export as JSON or Markdown
- /save [name] - Save to specs/solutions/<name>.md
- /load <path> - Load problem statement from file
- /context - Show current codebase context
- /help - List available commands

Begin by understanding what solution they have in mind for the problem.`;
}

/**
 * Build phase-specific guidance for the conversation.
 */
function buildPhaseGuidance(phase: string): string {
  switch (phase) {
    case 'gathering':
      return `
## Current Phase: Information Gathering
Focus on understanding the solution concept, user value, and scope.
`;
    case 'edge_case_discovery':
      return `
## Current Phase: Edge Case Discovery
Now focus on identifying edge cases, failure modes, and boundary conditions.
Ask about:
- What could go wrong?
- How should errors be handled?
- What are the limits or constraints?
`;
    case 'validation':
      return `
## Current Phase: Validation
Review the solution with the user to confirm all details are correct.
`;
    case 'complete':
      return `
## Current Phase: Complete
The solution spec is ready for export.
`;
    default:
      return '';
  }
}

/**
 * Build the evaluation prompt for assessing dimension coverage.
 */
export function buildEvaluationPromptV2(
  userMessage: string,
  conversationContext: string,
  dimensionId: DimensionIdV2,
  loadedProblem: LoadedProblem | null
): string {
  const def = DIMENSIONS_V2[dimensionId];

  let problemContext = '';
  if (loadedProblem) {
    problemContext = `
## Problem Being Solved
Problem: ${loadedProblem.problem}
Who: ${loadedProblem.who}
`;
  }

  return `You are evaluating how well a conversation addresses the "${def.name}" dimension of a solution specification.

## Dimension Definition
${def.description}

Goal: ${def.goal}
Good example: "${def.exampleGood}"
Bad example: "${def.exampleBad}"
${problemContext}
## Conversation So Far
${conversationContext}

## Latest User Message
${userMessage}

## Your Task
Evaluate the coverage level for this dimension based on ALL information gathered so far.

Coverage levels:
- not_started: No relevant information provided
- weak: Some mention but vague/unclear
- partial: Decent clarity but missing specifics or completeness
- strong: Clear, specific, and actionable

Respond in this exact JSON format:
{
  "coverage": "not_started" | "weak" | "partial" | "strong",
  "evidence": ["quote or fact 1", "quote or fact 2"],
  "reasoning": "Brief explanation of your assessment"
}`;
}

/**
 * Build the codebase context section for the system prompt.
 */
export function buildCodebaseContextSection(context: CodebaseContext): string {
  const lines: string[] = [];

  // Tech stack
  if (context.techStack.length > 0) {
    lines.push(`**Tech Stack:** ${context.techStack.join(', ')}`);
    lines.push('');
  }

  // Architecture
  if (context.architecture) {
    lines.push(`**Architecture:** ${context.architecture}`);
    lines.push('');
  }

  // Relevant files
  if (context.files.length > 0) {
    lines.push('**Relevant Files:**');
    for (const file of context.files) {
      lines.push(`- ${file.path} (${file.type}, ${file.relevance}): ${file.description}`);
    }
    lines.push('');
  }

  // Patterns
  if (context.patterns.length > 0) {
    lines.push('**Patterns Used:**');
    for (const pattern of context.patterns) {
      lines.push(`- ${pattern.name}: ${pattern.description}`);
      if (pattern.examples.length > 0) {
        lines.push(`  Examples: ${pattern.examples.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Dependencies
  if (context.dependencies.length > 0) {
    const prodDeps = context.dependencies.filter(d => d.type === 'production');
    if (prodDeps.length > 0) {
      lines.push('**Key Dependencies:**');
      for (const dep of prodDeps.slice(0, 10)) {
        lines.push(`- ${dep.name}@${dep.version}: ${dep.usage}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Build the edge cases section for the system prompt.
 */
export function buildEdgeCaseSection(edgeCases: EdgeCase[]): string {
  if (edgeCases.length === 0) {
    return 'No edge cases identified yet.';
  }

  const lines: string[] = [];

  for (const ec of edgeCases) {
    lines.push(`- [${ec.severity}] ${ec.description} (source: ${ec.source})`);
    lines.push(`  Recommendation: ${ec.recommendation}`);
  }

  return lines.join('\n');
}
