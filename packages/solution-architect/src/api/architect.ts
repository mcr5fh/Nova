import type {
  ArchitectConfig,
  SessionState,
  SolutionSpec,
  ExportFormat,
  LoadedProblem
} from '../core/types.js';
import { AnthropicAdapter } from '../llm/anthropic.js';
import type { LLMAdapter } from '../llm/types.js';
import {
  createSession,
  addMessage,
  applyEvaluation,
  selectNextFocus,
  serializeState,
  deserializeState,
  setLoadedProblem
} from '../core/state-machine.js';
import { evaluateAllDimensions } from '../core/evaluator.js';
import { buildSystemPrompt } from '../core/prompt-builder.js';
import { generateSolutionSpec, formatOutput, formatProgress } from '../core/output-formatter.js';
import { generateFlowDiagram } from '../core/flow-diagram.js';
import {
  exportSession,
  detectSaveIntent,
  writeSolutionFile,
  loadProblemStatement,
  type SaveSolutionResult
} from '../core/file-exporter.js';

export class SolutionArchitect {
  private config: ArchitectConfig;
  private llm: LLMAdapter;
  private sessions: Map<string, SessionState> = new Map();
  private basePath: string;
  private flowDiagrams: Map<string, string> = new Map();

  constructor(config: ArchitectConfig, basePath?: string) {
    this.config = config;
    this.llm = new AnthropicAdapter(config.apiKey, config.modelId);
    this.basePath = basePath || process.cwd();
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
  ): AsyncIterable<{
    type: 'text' | 'done' | 'progress' | 'saved' | 'loaded';
    text?: string;
    saveResult?: SaveSolutionResult;
    loadedProblem?: LoadedProblem;
  }> {
    let state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    // Check for natural language save intent
    const saveIntent = detectSaveIntent(userMessage);
    if (saveIntent.shouldSave) {
      const result = await this.saveSolution(sessionId, saveIntent.solutionName || undefined);
      if (result.saved) {
        yield { type: 'text', text: `Solution saved to: ${result.filePath}` };
        yield { type: 'saved', saveResult: result };
        yield { type: 'done' };
        return;
      } else {
        yield { type: 'text', text: 'Could not save solution. Please provide a name with "save as <name>".' };
        yield { type: 'done' };
        return;
      }
    }

    // Handle commands
    if (userMessage.startsWith('/')) {
      const parts = userMessage.slice(1).trim().split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');

      if (command === 'progress') {
        yield { type: 'text', text: formatProgress(state) };
        yield { type: 'done' };
        return;
      }

      if (command === 'eject' || command === 'done') {
        const output = await this.eject(sessionId);
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
        const name = args || undefined;
        const result = await this.saveSolution(sessionId, name);
        if (result.saved) {
          yield { type: 'text', text: `Solution saved to: ${result.filePath}` };
          yield { type: 'saved', saveResult: result };
        } else {
          yield { type: 'text', text: 'Could not save. Please provide a name: /save <name>' };
        }
        yield { type: 'done' };
        return;
      }

      if (command === 'load') {
        if (!args) {
          yield { type: 'text', text: 'Please provide a file path: /load <path>' };
          yield { type: 'done' };
          return;
        }

        try {
          const problem = await loadProblemStatement(args);
          state = setLoadedProblem(state, problem);
          this.sessions.set(sessionId, state);

          yield {
            type: 'text',
            text: `Loaded problem statement from ${problem.sourceFile}:\n\n**Problem:** ${problem.problem}\n**Who:** ${problem.who}${problem.businessImpact ? `\n**Business Impact:** ${problem.businessImpact}` : ''}\n\nNow let's design a solution for this problem.`
          };
          yield { type: 'loaded', loadedProblem: problem };
          yield { type: 'done' };
          return;
        } catch (error) {
          yield { type: 'text', text: `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}` };
          yield { type: 'done' };
          return;
        }
      }

      if (command === 'export') {
        const format = args as ExportFormat | undefined;
        const result = await this.export(sessionId, format);
        yield { type: 'text', text: result.content };
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

    yield { type: 'progress' };
    yield { type: 'done' };
  }

  async eject(sessionId: string): Promise<string> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const spec = generateSolutionSpec(state);

    // Generate flow diagram
    const flowDiagram = await generateFlowDiagram(state, spec, this.llm);
    this.flowDiagrams.set(sessionId, flowDiagram);

    return formatOutput(spec, flowDiagram);
  }

  saveSession(sessionId: string): string {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');
    return serializeState(state);
  }

  async export(sessionId: string, format?: ExportFormat): Promise<{ format: ExportFormat; content: string }> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const validFormats: ExportFormat[] = ['json', 'markdown'];
    const selectedFormat: ExportFormat = format && validFormats.includes(format) ? format : 'markdown';

    // Generate flow diagram if not already generated
    let flowDiagram = this.flowDiagrams.get(sessionId);
    if (!flowDiagram) {
      const spec = generateSolutionSpec(state);
      flowDiagram = await generateFlowDiagram(state, spec, this.llm);
      this.flowDiagrams.set(sessionId, flowDiagram);
    }

    const content = exportSession(state, selectedFormat, flowDiagram);
    return { format: selectedFormat, content };
  }

  async saveSolution(sessionId: string, solutionName?: string): Promise<SaveSolutionResult> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    if (!solutionName) {
      return { saved: false };
    }

    try {
      // Generate flow diagram if not already generated
      let flowDiagram = this.flowDiagrams.get(sessionId);
      if (!flowDiagram) {
        const spec = generateSolutionSpec(state);
        flowDiagram = await generateFlowDiagram(state, spec, this.llm);
        this.flowDiagrams.set(sessionId, flowDiagram);
      }

      const filePath = await writeSolutionFile(state, solutionName, this.basePath, flowDiagram);
      return { saved: true, filePath, solutionName };
    } catch (error) {
      return { saved: false };
    }
  }

  async loadProblem(sessionId: string, filePath: string): Promise<LoadedProblem> {
    let state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const problem = await loadProblemStatement(filePath);
    state = setLoadedProblem(state, problem);
    this.sessions.set(sessionId, state);

    return problem;
  }

  private getHelp(): string {
    return `
Available Commands:
  /progress        - Show detailed dimension status
  /eject           - Exit early and generate best-effort output
  /export [format] - Export solution spec (formats: markdown, json)
  /save <name>     - Save to specs/solutions/<name>.md
  /load <path>     - Load problem statement from file
  /help            - Show this help message

Tips:
  • Describe your solution concept clearly
  • Think about who uses it and what value they get
  • Be explicit about what's in scope and out of scope
  • Define how you'll know if it works
`.trim();
  }
}
