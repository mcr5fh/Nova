import { LLMAdapter } from '../llm/types.js';

export interface DesignOption {
  name: string;
  description: string;
  mockup: string;
  tradeoffs: {
    pros: string[];
    cons: string[];
  };
}

export interface DesignIterationResult {
  options: DesignOption[];
  prompt: string;
}

/**
 * Detect if the conversation suggests a frontend/UI solution
 */
export function detectFrontendContext(conversationHistory: Array<{ content: string }>): boolean {
  const uiKeywords = [
    'ui', 'interface', 'screen', 'page', 'dashboard', 'form', 'button',
    'navigation', 'layout', 'design', 'frontend', 'web app', 'webapp',
    'mobile app', 'display', 'view', 'component', 'sidebar', 'header',
    'modal', 'dialog', 'menu', 'panel', 'widget', 'card', 'list',
  ];

  const recentMessages = conversationHistory.slice(-6);
  const text = recentMessages.map(m => m.content.toLowerCase()).join(' ');

  return uiKeywords.some(keyword => text.includes(keyword));
}

/**
 * Generate ASCII mockup design options for a UI solution
 */
export async function generateDesignOptions(
  solutionDescription: string,
  userContext: string,
  llm: LLMAdapter
): Promise<DesignIterationResult> {
  const prompt = `Based on the solution description, generate TWO different ASCII mockup layout options for this UI.

## Solution Description
${solutionDescription}

## User Context
${userContext}

## Instructions
Create two distinct layout options (Option A and Option B) as ASCII mockups.

Use these ASCII drawing conventions:
- ┌ ┐ └ ┘ for corners
- │ for vertical lines
- ─ for horizontal lines
- ├ ┤ ┬ ┴ ┼ for intersections
- [ ] for buttons or clickable elements
- ═ for emphasis/headers

Each option should be roughly 40-50 characters wide.

Respond in this exact JSON format:
{
  "options": [
    {
      "name": "Option A - [Layout Style]",
      "description": "Brief description of this layout approach",
      "mockup": "ASCII mockup here (use \\n for newlines)",
      "pros": ["advantage 1", "advantage 2"],
      "cons": ["disadvantage 1", "disadvantage 2"]
    },
    {
      "name": "Option B - [Layout Style]",
      "description": "Brief description of this layout approach",
      "mockup": "ASCII mockup here (use \\n for newlines)",
      "pros": ["advantage 1", "advantage 2"],
      "cons": ["disadvantage 1", "disadvantage 2"]
    }
  ],
  "question": "Which direction feels right for your users?"
}`;

  try {
    const response = await llm.chat(
      [{ role: 'user', content: prompt }],
      'You are a UI/UX designer who creates clear ASCII mockups. Respond only with valid JSON.'
    );

    const parsed = JSON.parse(response.content);

    return {
      options: parsed.options.map((opt: {
        name: string;
        description: string;
        mockup: string;
        pros: string[];
        cons: string[];
      }) => ({
        name: opt.name,
        description: opt.description,
        mockup: opt.mockup.replace(/\\n/g, '\n'),
        tradeoffs: {
          pros: opt.pros || [],
          cons: opt.cons || [],
        },
      })),
      prompt: parsed.question || 'Which direction feels right for your users?',
    };
  } catch {
    return generateFallbackDesignOptions();
  }
}

/**
 * Fallback design options if LLM fails
 */
function generateFallbackDesignOptions(): DesignIterationResult {
  return {
    options: [
      {
        name: 'Option A - Sidebar Navigation',
        description: 'Classic sidebar layout with main content area',
        mockup: `┌──────────────────────────────────────┐
│ Logo    [Search]         [User Menu] │
├────────┬─────────────────────────────┤
│ Nav    │                             │
│ ───    │     Main Content Area       │
│ Home   │                             │
│ Dash   │                             │
│ Tasks  │                             │
└────────┴─────────────────────────────┘`,
        tradeoffs: {
          pros: ['Familiar pattern', 'Good for many nav items', 'Content always visible'],
          cons: ['Takes horizontal space', 'May feel dated'],
        },
      },
      {
        name: 'Option B - Top Navigation',
        description: 'Horizontal nav with full-width content',
        mockup: `┌──────────────────────────────────────┐
│ Logo  [Home] [Dash] [Tasks] [User]   │
├──────────────────────────────────────┤
│                                      │
│         Main Content Area            │
│                                      │
│                                      │
└──────────────────────────────────────┘`,
        tradeoffs: {
          pros: ['Maximum content width', 'Clean, modern feel'],
          cons: ['Limited nav items', 'Scrolling hides nav'],
        },
      },
    ],
    prompt: 'Which direction feels right for your users?',
  };
}

/**
 * Format design options for display
 */
export function formatDesignOptions(result: DesignIterationResult): string {
  const lines: string[] = [];

  lines.push('Based on what you\'ve described, here are two layout options:\n');

  for (const option of result.options) {
    lines.push(`**${option.name}**`);
    lines.push(option.description);
    lines.push('');
    lines.push(option.mockup);
    lines.push('');

    if (option.tradeoffs.pros.length > 0) {
      lines.push('Pros: ' + option.tradeoffs.pros.join(', '));
    }
    if (option.tradeoffs.cons.length > 0) {
      lines.push('Cons: ' + option.tradeoffs.cons.join(', '));
    }
    lines.push('');
  }

  lines.push(result.prompt);

  return lines.join('\n');
}

/**
 * Refine a design based on user feedback
 */
export async function refineDesign(
  selectedOption: DesignOption,
  feedback: string,
  llm: LLMAdapter
): Promise<DesignOption> {
  const prompt = `Refine this ASCII mockup based on the user's feedback.

## Current Design
${selectedOption.name}
${selectedOption.mockup}

## User Feedback
${feedback}

## Instructions
Create a refined version of this mockup incorporating the feedback.

Respond in this exact JSON format:
{
  "name": "Refined ${selectedOption.name}",
  "description": "Brief description of changes made",
  "mockup": "Updated ASCII mockup (use \\n for newlines)",
  "pros": ["updated advantage 1", "updated advantage 2"],
  "cons": ["remaining tradeoff 1"]
}`;

  try {
    const response = await llm.chat(
      [{ role: 'user', content: prompt }],
      'You are a UI/UX designer who creates clear ASCII mockups. Respond only with valid JSON.'
    );

    const parsed = JSON.parse(response.content);

    return {
      name: parsed.name,
      description: parsed.description,
      mockup: parsed.mockup.replace(/\\n/g, '\n'),
      tradeoffs: {
        pros: parsed.pros || [],
        cons: parsed.cons || [],
      },
    };
  } catch {
    // Return original if refinement fails
    return selectedOption;
  }
}
