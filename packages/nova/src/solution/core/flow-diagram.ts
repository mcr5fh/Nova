import type { SessionState, SolutionSpec } from './types.js';
import type { LLMAdapter } from '../../shared/llm/types.js';

/**
 * Generate an ASCII UX flow diagram based on the solution spec
 */
export async function generateFlowDiagram(
  state: SessionState,
  spec: SolutionSpec,
  llm: LLMAdapter
): Promise<string> {
  const conversationSummary = state.conversationHistory
    .slice(-20)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  const prompt = `Based on the solution discussion below, generate an ASCII flow diagram showing the user journey.

## Solution Summary
${spec.solutionSummary}

## User Value
${spec.userValue}

## Scope
Included: ${spec.scope.included.join(', ')}
Excluded: ${spec.scope.excluded.join(', ')}

## Success Criteria
${spec.successCriteria.join('\n')}

## Conversation Context
${conversationSummary}

## Instructions
Create a clear ASCII flow diagram showing the main user journey. Use this style:

┌─────────────────┐
│  Step Title     │
│  Brief detail   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Next Step      │
└─────────────────┘

Guidelines:
- Show 4-8 key steps in the user journey
- Keep box widths consistent (around 17-20 chars)
- Use │ for vertical lines, ▼ for arrows
- Include brief details in each box
- Show decision points with diamond shapes if needed: ◇
- End with the outcome/value delivered

Return ONLY the ASCII diagram, no explanation.`;

  try {
    const response = await llm.chat(
      [{ role: 'user', content: prompt }],
      'You are a UX designer who creates clear ASCII diagrams. Return only the diagram.'
    );

    return response.content.trim();
  } catch {
    // Fallback to a simple template
    return generateFallbackDiagram(spec);
  }
}

/**
 * Generate a simple fallback diagram if LLM fails
 */
function generateFallbackDiagram(spec: SolutionSpec): string {
  const lines = [
    '┌─────────────────────┐',
    '│    User starts      │',
    '└──────────┬──────────┘',
    '           │',
    '           ▼',
    '┌─────────────────────┐',
    '│  Engages with       │',
    '│  solution           │',
    '└──────────┬──────────┘',
    '           │',
    '           ▼',
    '┌─────────────────────┐',
    '│  Achieves goal      │',
    '└─────────────────────┘',
  ];

  return lines.join('\n');
}

/**
 * Generate a simple flow diagram from steps
 */
export function createFlowFromSteps(steps: string[]): string {
  if (steps.length === 0) {
    return '';
  }

  const lines: string[] = [];
  const boxWidth = 21;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const paddedStep = step.length > boxWidth - 4
      ? step.substring(0, boxWidth - 7) + '...'
      : step;

    const padding = Math.floor((boxWidth - 2 - paddedStep.length) / 2);
    const leftPad = ' '.repeat(padding);
    const rightPad = ' '.repeat(boxWidth - 2 - padding - paddedStep.length);

    lines.push('┌' + '─'.repeat(boxWidth - 2) + '┐');
    lines.push('│' + leftPad + paddedStep + rightPad + '│');
    lines.push('└' + '─'.repeat(Math.floor((boxWidth - 3) / 2)) + '┬' + '─'.repeat(Math.ceil((boxWidth - 3) / 2)) + '┘');

    if (i < steps.length - 1) {
      lines.push(' '.repeat(Math.floor(boxWidth / 2)) + '│');
      lines.push(' '.repeat(Math.floor(boxWidth / 2)) + '▼');
    }
  }

  // Fix last box to not have connector
  if (lines.length >= 3) {
    const lastBoxEnd = lines.length - 1;
    lines[lastBoxEnd] = '└' + '─'.repeat(boxWidth - 2) + '┘';
  }

  return lines.join('\n');
}
