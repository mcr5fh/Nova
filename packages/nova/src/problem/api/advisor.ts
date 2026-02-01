import type {
  AdvisorConfig,
  SessionState,
  ProblemStatement,
  ExportFormat
} from '../core/types.js';
import {
  createSession,
  addMessage,
  applyEvaluation,
  selectNextFocus,
  serializeState,
  deserializeState
} from '../core/state-machine.js';
import { buildSystemPrompt } from '../core/prompt-builder.js';
import { evaluateAllDimensions } from '../core/evaluator.js';
import { generateProblemStatement, formatOutput, formatProgress } from '../core/output-formatter.js';
import { exportSession, detectSaveIntent, writeProjectFile } from '../core/file-exporter.js';
import { AnthropicAdapter } from '../../shared/llm/anthropic.js';
import type { LLMAdapter } from '../../shared/llm/types.js';

export interface SaveProjectResult {
  saved: boolean;
  filePath?: string;
  projectName?: string;
}

export class ProblemAdvisor {
  private config: AdvisorConfig;
  private llm: LLMAdapter;
  private sessions: Map<string, SessionState> = new Map();
  private basePath: string;

  constructor(config: AdvisorConfig, basePath?: string) {
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
  ): AsyncIterable<{ type: 'text' | 'done' | 'progress' | 'saved'; text?: string; saveResult?: SaveProjectResult }> {
    let state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    // Check for natural language save intent
    const saveIntent = detectSaveIntent(userMessage);
    if (saveIntent.shouldSave) {
      const result = await this.saveProject(sessionId, saveIntent.projectName || undefined);
      if (result.saved) {
        yield { type: 'text', text: `Project saved to: ${result.filePath}` };
        yield { type: 'saved', saveResult: result };
        yield { type: 'done' };
        return;
      } else {
        yield { type: 'text', text: 'Could not save project. Please provide a project name with "save as <name>".' };
        yield { type: 'done' };
        return;
      }
    }

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
        yield { type: 'text', text: `Session saved. ID: ${sessionId}\n\nRestore with: nova problem resume ${sessionId}` };
        yield { type: 'done' };
        return;
      }

      // Handle /export and /export <format> commands
      if (command === 'export' || command.startsWith('export ')) {
        const parts = command.split(' ');
        const format = parts[1] as ExportFormat | undefined;
        const result = this.export(sessionId, format);
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

  export(sessionId: string, format?: ExportFormat): { format: ExportFormat; content: string } {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const validFormats: ExportFormat[] = ['json', 'markdown'];
    const selectedFormat: ExportFormat = format && validFormats.includes(format) ? format : 'markdown';

    const content = exportSession(state, selectedFormat);
    return { format: selectedFormat, content };
  }

  async saveProject(sessionId: string, projectName?: string): Promise<SaveProjectResult> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    // If no project name provided, we can't save
    if (!projectName) {
      return { saved: false };
    }

    try {
      const filePath = await writeProjectFile(state, projectName, this.basePath);
      return { saved: true, filePath, projectName };
    } catch (error) {
      return { saved: false };
    }
  }

  private getHelp(): string {
    return `
Available Commands:
  /progress        - Show detailed dimension status
  /eject           - Exit early and generate best-effort output
  /export [format] - Export problem statement (formats: markdown, json)
  /save            - Save session for later
  /help            - Show this help message

Tips:
  • Be specific about WHO experiences the problem
  • Quantify severity and frequency when possible
  • Explain the business impact in measurable terms
  • Describe how you'd validate this problem exists
`.trim();
  }
}
