# Problem Advisor - Implementation Guide

## Quick Start

```bash
cd packages/problem-advisor
npm install
npm run build
npm run start
```

---

## Phase 1: Core Foundation

### 1.1 Create `src/core/types.ts`

```typescript
// Coverage levels for each dimension
export type CoverageLevel = 'not_started' | 'weak' | 'partial' | 'strong';

// The 6 dimensions we track
export type DimensionId =
  | 'problem_clarity'
  | 'customer_context'
  | 'severity_frequency'
  | 'root_cause'
  | 'business_impact'
  | 'validation';

// State of a single dimension
export interface DimensionState {
  id: DimensionId;
  coverage: CoverageLevel;
  evidence: string[];      // Quotes/facts extracted from conversation
  lastUpdated: number;     // Timestamp
}

// Full conversation state
export interface SessionState {
  id: string;
  dimensions: Record<DimensionId, DimensionState>;
  conversationHistory: Message[];
  currentFocus: DimensionId | null;
  startedAt: number;
  lastActivityAt: number;
}

// Message in conversation
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Final output structure
export interface ProblemStatement {
  problem: string;
  who: string;
  frequencySeverity: string;
  businessImpact: string;
  validation: string;
  gaps: DimensionId[];      // Dimensions that didn't reach threshold
  confidence: 'low' | 'medium' | 'high';
}

// Evaluation result from LLM
export interface EvaluationResult {
  dimensionId: DimensionId;
  newCoverage: CoverageLevel;
  evidence: string[];
  reasoning: string;
}

// Configuration options
export interface AdvisorConfig {
  llmProvider: 'anthropic';
  modelId: string;
  apiKey: string;
  streamResponses?: boolean;
  maxTurns?: number;        // Safety limit, default 50
}
```

### 1.2 Create `src/core/dimensions.ts`

```typescript
import { DimensionId, CoverageLevel } from './types';

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
```

### 1.3 Create `src/core/state-machine.ts`

```typescript
import {
  SessionState,
  DimensionId,
  DimensionState,
  CoverageLevel,
  Message,
  EvaluationResult
} from './types';
import { DIMENSIONS } from './dimensions';

export function createSession(id: string): SessionState {
  const now = Date.now();
  const dimensions = {} as Record<DimensionId, DimensionState>;

  for (const dimId of Object.keys(DIMENSIONS) as DimensionId[]) {
    dimensions[dimId] = {
      id: dimId,
      coverage: 'not_started',
      evidence: [],
      lastUpdated: now,
    };
  }

  return {
    id,
    dimensions,
    conversationHistory: [],
    currentFocus: 'problem_clarity', // Start here
    startedAt: now,
    lastActivityAt: now,
  };
}

export function addMessage(
  state: SessionState,
  role: 'user' | 'assistant',
  content: string
): SessionState {
  return {
    ...state,
    conversationHistory: [
      ...state.conversationHistory,
      { role, content, timestamp: Date.now() }
    ],
    lastActivityAt: Date.now(),
  };
}

export function applyEvaluation(
  state: SessionState,
  evaluation: EvaluationResult
): SessionState {
  const { dimensionId, newCoverage, evidence } = evaluation;
  const existing = state.dimensions[dimensionId];

  // Only upgrade coverage, never downgrade
  const levelOrder: CoverageLevel[] = ['not_started', 'weak', 'partial', 'strong'];
  const currentIdx = levelOrder.indexOf(existing.coverage);
  const newIdx = levelOrder.indexOf(newCoverage);

  const finalCoverage = newIdx > currentIdx ? newCoverage : existing.coverage;

  return {
    ...state,
    dimensions: {
      ...state.dimensions,
      [dimensionId]: {
        ...existing,
        coverage: finalCoverage,
        evidence: [...existing.evidence, ...evidence],
        lastUpdated: Date.now(),
      },
    },
  };
}

export function selectNextFocus(state: SessionState): DimensionId | null {
  // Priority order for focusing
  const priorityOrder: DimensionId[] = [
    'problem_clarity',      // Must be strong
    'customer_context',     // Must be strong
    'business_impact',      // Must be strong
    'severity_frequency',   // Must be partial
    'root_cause',           // Must be partial
    'validation',           // Must be partial
  ];

  const thresholds: Record<DimensionId, CoverageLevel> = {
    problem_clarity: 'strong',
    customer_context: 'strong',
    business_impact: 'strong',
    severity_frequency: 'partial',
    root_cause: 'partial',
    validation: 'partial',
  };

  const levelOrder: CoverageLevel[] = ['not_started', 'weak', 'partial', 'strong'];

  for (const dimId of priorityOrder) {
    const current = state.dimensions[dimId].coverage;
    const threshold = thresholds[dimId];
    if (levelOrder.indexOf(current) < levelOrder.indexOf(threshold)) {
      return dimId;
    }
  }

  return null; // All dimensions meet threshold
}

// Serialize for saving
export function serializeState(state: SessionState): string {
  return JSON.stringify(state, null, 2);
}

// Deserialize for loading
export function deserializeState(json: string): SessionState {
  return JSON.parse(json) as SessionState;
}
```

---

## Phase 2: LLM Integration

### 2.1 Create `src/llm/types.ts`

```typescript
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence';
}

export interface LLMStreamChunk {
  type: 'text' | 'done';
  text?: string;
}

export interface LLMAdapter {
  chat(messages: LLMMessage[], systemPrompt: string): Promise<LLMResponse>;
  chatStream(
    messages: LLMMessage[],
    systemPrompt: string
  ): AsyncIterable<LLMStreamChunk>;
}
```

### 2.2 Create `src/llm/anthropic.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { LLMAdapter, LLMMessage, LLMResponse, LLMStreamChunk } from './types';

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private modelId: string;

  constructor(apiKey: string, modelId: string) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
  }

  async chat(messages: LLMMessage[], systemPrompt: string): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return {
      content: textBlock?.text ?? '',
      stopReason: response.stop_reason === 'end_turn' ? 'end_turn' : 'max_tokens',
    };
  }

  async *chatStream(
    messages: LLMMessage[],
    systemPrompt: string
  ): AsyncIterable<LLMStreamChunk> {
    const stream = this.client.messages.stream({
      model: this.modelId,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      }
    }
    yield { type: 'done' };
  }
}
```

### 2.3 Create `src/core/prompt-builder.ts`

```typescript
import { SessionState, DimensionId } from './types';
import { DIMENSIONS, canSignOff } from './dimensions';

export function buildSystemPrompt(state: SessionState): string {
  const { ready, gaps } = canSignOff(state.dimensions);
  const focus = state.currentFocus;

  let progressSummary = Object.entries(state.dimensions)
    .map(([id, dim]) => `- ${DIMENSIONS[id as DimensionId].name}: ${dim.coverage}`)
    .join('\n');

  let focusGuidance = '';
  if (focus) {
    const def = DIMENSIONS[focus];
    focusGuidance = `
## Current Focus: ${def.name}

Goal: ${def.goal}

Good example: "${def.exampleGood}"
Bad example: "${def.exampleBad}"

Probe questions to consider:
${def.probeQuestions.map(q => `- ${q}`).join('\n')}
`;
  }

  let signOffGuidance = ready
    ? `
## Ready for Sign-Off
All dimensions meet their thresholds. You may now offer to generate the final problem statement.
Say something like: "I think we have enough clarity to write up a solid problem statement. Shall I generate it?"
`
    : `
## Not Yet Ready
These dimensions need more work: ${gaps.map(g => DIMENSIONS[g].name).join(', ')}
`;

  return `You are a Problem Advisor—a challenger who helps product managers sharpen vague problem statements into clear, testable hypotheses.

## Your Personality
- Direct and challenging, but supportive
- Push back on vague language, solution-speak, and unvalidated assumptions
- Ask probing questions, one at a time
- Acknowledge good answers genuinely, then dig deeper
- Never accept "users want X" without understanding WHY

## Current Progress
${progressSummary}

${focusGuidance}

${signOffGuidance}

## Rules
1. Ask ONE focused question at a time
2. When the user gives a good answer, explicitly acknowledge what was good about it
3. If the user jumps to solutions, redirect: "That sounds like a solution—what's the problem it solves?"
4. Keep responses concise (2-4 sentences typical)
5. Use the user's own words when possible to show you're listening
6. When ready to sign off, explicitly say so and offer to generate the statement

## Commands the User May Use
- /progress - You should summarize the current dimension states
- /eject - Generate best-effort output with warnings about gaps
- /help - List available commands

Begin by understanding what problem they want to explore.`;
}

export function buildEvaluationPrompt(
  userMessage: string,
  conversationContext: string,
  dimensionId: DimensionId
): string {
  const def = DIMENSIONS[dimensionId];

  return `You are evaluating how well a conversation addresses the "${def.name}" dimension of a problem statement.

## Dimension Definition
${def.description}

Goal: ${def.goal}
Good example: "${def.exampleGood}"
Bad example: "${def.exampleBad}"

## Conversation So Far
${conversationContext}

## Latest User Message
${userMessage}

## Your Task
Evaluate the coverage level for this dimension based on ALL information gathered so far.

Coverage levels:
- not_started: No relevant information provided
- weak: Some mention but vague/unclear
- partial: Decent clarity but missing specifics or validation
- strong: Clear, specific, and actionable

Respond in this exact JSON format:
{
  "coverage": "not_started" | "weak" | "partial" | "strong",
  "evidence": ["quote or fact 1", "quote or fact 2"],
  "reasoning": "Brief explanation of your assessment"
}`;
}
```

### 2.4 Create `src/core/evaluator.ts`

```typescript
import { SessionState, DimensionId, EvaluationResult, CoverageLevel } from './types';
import { DIMENSIONS } from './dimensions';
import { buildEvaluationPrompt } from './prompt-builder';
import { LLMAdapter } from '../llm/types';

export async function evaluateAllDimensions(
  state: SessionState,
  userMessage: string,
  llm: LLMAdapter
): Promise<EvaluationResult[]> {
  const conversationContext = state.conversationHistory
    .slice(-10) // Last 10 messages for context
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  const results: EvaluationResult[] = [];

  // Evaluate each dimension in parallel
  const evaluations = await Promise.all(
    (Object.keys(DIMENSIONS) as DimensionId[]).map(async (dimId) => {
      const prompt = buildEvaluationPrompt(userMessage, conversationContext, dimId);

      try {
        const response = await llm.chat(
          [{ role: 'user', content: prompt }],
          'You are a precise evaluator. Respond only with valid JSON.'
        );

        const parsed = JSON.parse(response.content);
        return {
          dimensionId: dimId,
          newCoverage: parsed.coverage as CoverageLevel,
          evidence: parsed.evidence || [],
          reasoning: parsed.reasoning || '',
        };
      } catch (e) {
        // On parse error, return no change
        return {
          dimensionId: dimId,
          newCoverage: state.dimensions[dimId].coverage,
          evidence: [],
          reasoning: 'Evaluation failed',
        };
      }
    })
  );

  return evaluations;
}

// Lighter-weight evaluation that only checks relevant dimensions
export async function evaluateFocusedDimension(
  state: SessionState,
  userMessage: string,
  llm: LLMAdapter
): Promise<EvaluationResult | null> {
  if (!state.currentFocus) return null;

  const dimId = state.currentFocus;
  const conversationContext = state.conversationHistory
    .slice(-6)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  const prompt = buildEvaluationPrompt(userMessage, conversationContext, dimId);

  try {
    const response = await llm.chat(
      [{ role: 'user', content: prompt }],
      'You are a precise evaluator. Respond only with valid JSON.'
    );

    const parsed = JSON.parse(response.content);
    return {
      dimensionId: dimId,
      newCoverage: parsed.coverage as CoverageLevel,
      evidence: parsed.evidence || [],
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return null;
  }
}
```

---

## Phase 3: Main API

### 3.1 Create `src/core/output-formatter.ts`

```typescript
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
```

### 3.2 Create `src/api/advisor.ts`

```typescript
import {
  AdvisorConfig,
  SessionState,
  ProblemStatement,
  Message
} from '../core/types';
import {
  createSession,
  addMessage,
  applyEvaluation,
  selectNextFocus,
  serializeState,
  deserializeState
} from '../core/state-machine';
import { buildSystemPrompt } from '../core/prompt-builder';
import { evaluateAllDimensions } from '../core/evaluator';
import { generateProblemStatement, formatOutput, formatProgress } from '../core/output-formatter';
import { AnthropicAdapter } from '../llm/anthropic';
import { LLMAdapter, LLMStreamChunk } from '../llm/types';

export class ProblemAdvisor {
  private config: AdvisorConfig;
  private llm: LLMAdapter;
  private sessions: Map<string, SessionState> = new Map();

  constructor(config: AdvisorConfig) {
    this.config = config;
    this.llm = new AnthropicAdapter(config.apiKey, config.modelId);
  }

  startSession(existingState?: string): { id: string; state: SessionState } {
    const id = existingState
      ? deserializeState(existingState).id
      : crypto.randomUUID();

    const state = existingState
      ? deserializeState(existingState)
      : createSession(id);

    this.sessions.set(id, state);
    return { id, state };
  }

  getState(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  async *chat(
    sessionId: string,
    userMessage: string
  ): AsyncIterable<{ type: 'text' | 'done' | 'progress'; text?: string }> {
    let state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    // Handle commands
    if (userMessage.startsWith('/')) {
      const command = userMessage.slice(1).toLowerCase().trim();

      if (command === 'progress') {
        yield { type: 'text', text: formatProgress(state) };
        yield { type: 'done' };
        return;
      }

      if (command === 'eject' || command === 'done') {
        const output = this.eject(sessionId);
        yield { type: 'text', text: output };
        yield { type: 'done' };
        return;
      }

      if (command === 'help') {
        yield { type: 'text', text: this.getHelp() };
        yield { type: 'done' };
        return;
      }

      if (command === 'save') {
        const saved = this.saveSession(sessionId);
        yield { type: 'text', text: `Session saved. ID: ${sessionId}\n\nRestore with: problem-advisor resume ${sessionId}` };
        yield { type: 'done' };
        return;
      }
    }

    // Add user message to history
    state = addMessage(state, 'user', userMessage);

    // Evaluate dimensions (in background, don't block response)
    const evaluationPromise = evaluateAllDimensions(state, userMessage, this.llm);

    // Build prompt and get response
    const systemPrompt = buildSystemPrompt(state);
    const messages = state.conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let fullResponse = '';

    if (this.config.streamResponses) {
      for await (const chunk of this.llm.chatStream(messages, systemPrompt)) {
        if (chunk.type === 'text' && chunk.text) {
          fullResponse += chunk.text;
          yield { type: 'text', text: chunk.text };
        }
      }
    } else {
      const response = await this.llm.chat(messages, systemPrompt);
      fullResponse = response.content;
      yield { type: 'text', text: fullResponse };
    }

    // Apply evaluations
    const evaluations = await evaluationPromise;
    for (const evaluation of evaluations) {
      state = applyEvaluation(state, evaluation);
    }

    // Update focus
    state = { ...state, currentFocus: selectNextFocus(state) };

    // Add assistant message
    state = addMessage(state, 'assistant', fullResponse);

    // Save updated state
    this.sessions.set(sessionId, state);

    yield { type: 'progress' }; // Signal that progress may have changed
    yield { type: 'done' };
  }

  eject(sessionId: string): string {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const statement = generateProblemStatement(state);
    return formatOutput(statement);
  }

  saveSession(sessionId: string): string {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');
    return serializeState(state);
  }

  private getHelp(): string {
    return `
Available Commands:
  /progress  - Show detailed dimension status
  /eject     - Exit early and generate best-effort output
  /save      - Save session for later
  /help      - Show this help message

Tips:
  • Be specific about WHO experiences the problem
  • Quantify severity and frequency when possible
  • Explain the business impact in measurable terms
  • Describe how you'd validate this problem exists
`.trim();
  }
}
```

### 3.3 Create `src/api/index.ts`

```typescript
export { ProblemAdvisor } from './advisor';
export type {
  AdvisorConfig,
  SessionState,
  ProblemStatement,
  DimensionId,
  CoverageLevel,
  Message
} from '../core/types';
export { DIMENSIONS, canSignOff } from '../core/dimensions';
export { formatOutput, formatProgress, generateProblemStatement } from '../core/output-formatter';
```

### 3.4 Create `src/index.ts`

```typescript
export * from './api';
```

---

## Phase 4: CLI

### 4.1 Create `src/cli/renderer.ts`

```typescript
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import boxen from 'boxen';
import { SessionState, DimensionId } from '../core/types';
import { DIMENSIONS, canSignOff } from '../core/dimensions';

export class CLIRenderer {
  private spinner: Ora | null = null;

  showWelcome(): void {
    const welcome = boxen(
      chalk.bold('Problem Advisor') + '\n\n' +
      'I help sharpen vague problem statements into\n' +
      'clear, testable hypotheses.\n\n' +
      chalk.dim('Commands: /progress, /eject, /save, /help'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }
    );
    console.log(welcome);
    console.log(chalk.cyan('\nWhat problem are you trying to solve?\n'));
  }

  startThinking(): void {
    this.spinner = ora({
      text: chalk.dim('Thinking...'),
      spinner: 'dots',
    }).start();
  }

  stopThinking(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  showResponse(text: string): void {
    console.log(chalk.white(text));
  }

  streamText(text: string): void {
    process.stdout.write(text);
  }

  showProgress(state: SessionState): void {
    const statusColors: Record<string, (s: string) => string> = {
      not_started: chalk.gray,
      weak: chalk.yellow,
      partial: chalk.hex('#FFA500'), // orange
      strong: chalk.green,
    };

    console.log('\n' + chalk.bold('Progress:'));

    for (const [id, dim] of Object.entries(state.dimensions)) {
      const def = DIMENSIONS[id as DimensionId];
      const colorFn = statusColors[dim.coverage];
      const bar = this.makeProgressBar(dim.coverage);
      console.log(`  ${colorFn(bar)} ${def.name}`);
    }

    const { ready } = canSignOff(state.dimensions);
    console.log(ready
      ? chalk.green('\n✓ Ready for sign-off')
      : chalk.yellow('\n⏳ Keep going...')
    );
    console.log('');
  }

  private makeProgressBar(coverage: string): string {
    const levels = { not_started: 0, weak: 1, partial: 2, strong: 3 };
    const filled = levels[coverage as keyof typeof levels] || 0;
    return '█'.repeat(filled) + '░'.repeat(3 - filled);
  }

  showError(message: string): void {
    console.error(chalk.red('Error: ') + message);
  }

  showOutput(output: string): void {
    console.log('\n' + chalk.cyan(output) + '\n');
  }

  newLine(): void {
    console.log('');
  }
}
```

### 4.2 Create `src/cli/index.ts`

```typescript
import { createInterface } from 'readline';
import { ProblemAdvisor } from '../api/advisor';
import { CLIRenderer } from './renderer';

export async function runCLI(options: {
  apiKey: string;
  modelId?: string;
  resume?: string;
}): Promise<void> {
  const renderer = new CLIRenderer();

  const advisor = new ProblemAdvisor({
    llmProvider: 'anthropic',
    modelId: options.modelId || 'claude-sonnet-4-20250514',
    apiKey: options.apiKey,
    streamResponses: true,
  });

  // Start or resume session
  const { id: sessionId, state } = advisor.startSession(options.resume);

  renderer.showWelcome();

  if (options.resume) {
    renderer.showResponse('Resumed previous session.\n');
    renderer.showProgress(state);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('\nGoodbye!\n');
        rl.close();
        process.exit(0);
      }

      renderer.newLine();
      renderer.startThinking();

      let firstChunk = true;

      try {
        for await (const chunk of advisor.chat(sessionId, trimmed)) {
          if (chunk.type === 'text' && chunk.text) {
            if (firstChunk) {
              renderer.stopThinking();
              process.stdout.write('Advisor: ');
              firstChunk = false;
            }
            renderer.streamText(chunk.text);
          } else if (chunk.type === 'progress') {
            // Could show mini progress indicator here
          }
        }

        renderer.newLine();
        renderer.newLine();
      } catch (error) {
        renderer.stopThinking();
        renderer.showError(error instanceof Error ? error.message : 'Unknown error');
      }

      prompt();
    });
  };

  prompt();
}
```

### 4.3 Create `bin/problem-advisor.ts`

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { runCLI } from '../src/cli';

const program = new Command();

program
  .name('problem-advisor')
  .description('Sharpen vague problem statements into clear, testable hypotheses')
  .version('0.1.0');

program
  .command('start')
  .description('Start a new problem definition session')
  .option('-m, --model <model>', 'Model to use', 'claude-sonnet-4-20250514')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY)')
  .action(async (options) => {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error('Error: API key required. Set ANTHROPIC_API_KEY or use --api-key');
      process.exit(1);
    }

    await runCLI({
      apiKey,
      modelId: options.model,
    });
  });

program
  .command('resume <sessionId>')
  .description('Resume a saved session')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY)')
  .action(async (sessionId, options) => {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error('Error: API key required. Set ANTHROPIC_API_KEY or use --api-key');
      process.exit(1);
    }

    // TODO: Load session from storage
    console.error('Session resume not yet implemented');
    process.exit(1);
  });

program.parse();
```

---

## Phase 5: Package Setup

### 5.1 Create `package.json`

```json
{
  "name": "problem-advisor",
  "version": "0.1.0",
  "description": "Conversational agent that helps define clear, testable problem statements",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "problem-advisor": "./dist/bin/problem-advisor.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/bin/problem-advisor.js start",
    "dev": "tsx bin/problem-advisor.ts start",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "boxen": "^7.1.1",
    "chalk": "^5.3.0",
    "commander": "^12.1.0",
    "ora": "^8.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=18"
  },
  "keywords": [
    "product-management",
    "problem-statement",
    "ai",
    "claude",
    "conversational-agent"
  ],
  "license": "MIT"
}
```

### 5.2 Create `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "bin/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Verification Checklist

After implementation, verify:

- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles successfully
- [ ] `npm run start` launches the CLI
- [ ] Typing a problem statement gets a challenging response
- [ ] `/progress` shows dimension status
- [ ] `/eject` generates output with gap warnings
- [ ] `/help` shows available commands
- [ ] Streaming responses appear character-by-character
- [ ] Import works: `import { ProblemAdvisor } from 'problem-advisor'`

---

## Example Session

```
╭──────────────────────────────────────────────╮
│                                              │
│           Problem Advisor                    │
│                                              │
│   I help sharpen vague problem statements    │
│   into clear, testable hypotheses.           │
│                                              │
│   Commands: /progress, /eject, /save, /help  │
│                                              │
╰──────────────────────────────────────────────╯

What problem are you trying to solve?

You: We need better onboarding

Advisor: "Better onboarding" sounds like a solution. What's actually happening
to users during onboarding that's causing problems? What do you see them
struggling with?

You: Users drop off during the setup wizard

Advisor: That's a good start—drop-off during setup. Can you tell me more about
WHO these users are and WHEN in the wizard they're leaving? Is this all users
or a specific segment?

You: /progress

📊 Dimension Progress:

🟨 Problem Clarity: weak
⬜ Customer & Context: not_started
⬜ Severity & Frequency: not_started
⬜ Root Cause: not_started
⬜ Business Impact: not_started
⬜ Validation: not_started

⏳ Keep going...
```
