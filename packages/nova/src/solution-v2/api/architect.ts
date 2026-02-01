import type {
  ArchitectConfigV2,
  SessionStateV2,
  SolutionSpecV2,
  ExportFormatV2,
  CodebaseContext,
  LoadedProblem,
  DimensionIdV2,
} from '../core/types.js';
import { AnthropicAdapter } from '../../shared/llm/anthropic.js';
import type { LLMAdapter } from '../../shared/llm/types.js';
import {
  createSessionV2,
  addMessageV2,
  applyEvaluationV2,
  selectNextFocusV2,
  serializeStateV2,
  deserializeStateV2,
  setCodebaseContext,
  setLoadedProblemV2,
  addEdgeCase,
} from '../core/state-machine.js';
import { DIMENSIONS_V2, canSignOffV2 } from '../core/dimensions.js';
import { buildSystemPromptV2, buildEvaluationPromptV2, buildCodebaseContextSection } from '../core/prompt-builder.js';
import { formatV2Output } from '../core/output-formatter.js';
import { generateImplementationDiagram, generateFallbackDiagram } from '../core/mermaid-generator.js';
import { analyzeEdgeCases } from '../core/edge-case-analyzer.js';
import { estimateComplexity } from '../core/complexity-estimator.js';
import {
  loadProblemStatement,
  detectSaveIntent,
  writeSolutionFile,
} from '../../solution/core/file-exporter.js';
import type { SaveSolutionResult } from '../../solution/core/file-exporter.js';

export class SolutionArchitectV2 {
  private config: ArchitectConfigV2;
  private llm: LLMAdapter;
  private sessions: Map<string, SessionStateV2> = new Map();
  private basePath: string;

  constructor(config: ArchitectConfigV2, basePath?: string) {
    this.config = config;
    this.llm = new AnthropicAdapter(config.apiKey, config.modelId);
    this.basePath = basePath || process.cwd();
  }

  /**
   * Start a new session or restore from existing state.
   * Optionally accepts codebase context discovered by CC.
   */
  startSession(
    existingState?: string,
    codebaseContext?: CodebaseContext
  ): { id: string; state: SessionStateV2 } {
    const id = existingState
      ? deserializeStateV2(existingState).id
      : crypto.randomUUID();

    let state = existingState
      ? deserializeStateV2(existingState)
      : createSessionV2(id);

    // Inject codebase context if provided
    if (codebaseContext) {
      state = setCodebaseContext(state, codebaseContext);
    }

    this.sessions.set(id, state);
    return { id, state };
  }

  /**
   * Get the current state of a session.
   */
  getState(sessionId: string): SessionStateV2 | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Inject codebase context into an existing session.
   * Use this when CC discovers context mid-session.
   */
  injectCodebaseContext(sessionId: string, context: CodebaseContext): void {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const updated = setCodebaseContext(state, context);
    this.sessions.set(sessionId, updated);
  }

  /**
   * Chat with the architect. Yields streaming chunks and handles commands.
   */
  async *chat(
    sessionId: string,
    userMessage: string
  ): AsyncIterable<{
    type: 'text' | 'done' | 'progress' | 'saved' | 'loaded' | 'context';
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
        yield { type: 'text', text: this.formatProgress(state) };
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

      if (command === 'context') {
        yield { type: 'text', text: this.formatContext(state) };
        yield { type: 'context' };
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
          state = setLoadedProblemV2(state, problem);
          this.sessions.set(sessionId, state);

          yield {
            type: 'text',
            text: `Loaded problem statement from ${problem.sourceFile}:\n\n**Problem:** ${problem.problem}\n**Who:** ${problem.who}${problem.businessImpact ? `\n**Business Impact:** ${problem.businessImpact}` : ''}\n\nNow let's design a solution for this problem.`,
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
        const format = args as ExportFormatV2 | undefined;
        const result = await this.export(sessionId, format);
        yield { type: 'text', text: result.content };
        yield { type: 'done' };
        return;
      }
    }

    // Add user message to history
    state = addMessageV2(state, 'user', userMessage);

    // Evaluate dimensions (in background, don't block response)
    const evaluationPromise = this.evaluateAllDimensions(state, userMessage);

    // Build prompt and get response
    const systemPrompt = buildSystemPromptV2(state);
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
      state = applyEvaluationV2(state, evaluation);
    }

    // Update focus
    state = { ...state, currentFocus: selectNextFocusV2(state) };

    // Add assistant message with metadata
    state = addMessageV2(state, 'assistant', fullResponse, {
      codebaseContextUsed: state.codebaseContext !== null,
    });

    // Save updated state
    this.sessions.set(sessionId, state);

    yield { type: 'progress' };
    yield { type: 'done' };
  }

  /**
   * Eject and generate the full v2 output package.
   */
  async eject(sessionId: string): Promise<string> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const spec = await this.generateSolutionSpecV2(state);
    return formatV2Output(spec);
  }

  /**
   * Save session state for later resumption.
   */
  saveSession(sessionId: string): string {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');
    return serializeStateV2(state);
  }

  /**
   * Export session in the specified format.
   */
  async export(
    sessionId: string,
    format?: ExportFormatV2
  ): Promise<{ format: ExportFormatV2; content: string }> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const validFormats: ExportFormatV2[] = ['json', 'markdown'];
    const selectedFormat: ExportFormatV2 = format && validFormats.includes(format) ? format : 'markdown';

    const spec = await this.generateSolutionSpecV2(state);

    if (selectedFormat === 'json') {
      return { format: selectedFormat, content: JSON.stringify(spec, null, 2) };
    }

    return { format: selectedFormat, content: formatV2Output(spec) };
  }

  /**
   * Save solution to a file.
   */
  async saveSolution(sessionId: string, solutionName?: string): Promise<SaveSolutionResult> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    if (!solutionName) {
      return { saved: false };
    }

    try {
      // Generate v2 spec and save
      const spec = await this.generateSolutionSpecV2(state);
      const content = formatV2Output(spec);

      // Use the v1 file exporter but with our v2 content
      const filePath = await writeSolutionFile(
        // We need a v1 state shape - create a minimal compatible one
        {
          id: state.id,
          dimensions: state.dimensions as any,
          conversationHistory: state.conversationHistory.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          currentFocus: state.currentFocus,
          startedAt: state.startedAt,
          lastActivityAt: state.lastActivityAt,
          loadedProblem: state.loadedProblem,
        } as any,
        solutionName,
        this.basePath,
        spec.implementationDiagram.mermaid
      );

      return { saved: true, filePath, solutionName };
    } catch {
      return { saved: false };
    }
  }

  /**
   * Load a problem statement from file.
   */
  async loadProblem(sessionId: string, filePath: string): Promise<LoadedProblem> {
    let state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    const problem = await loadProblemStatement(filePath);
    state = setLoadedProblemV2(state, problem);
    this.sessions.set(sessionId, state);

    return problem;
  }

  /**
   * Generate the full v2 solution spec from session state.
   */
  private async generateSolutionSpecV2(state: SessionStateV2): Promise<SolutionSpecV2> {
    // Extract info from conversation for spec fields
    const solutionSummary = this.extractFromConversation(state, 'solution');
    const userValue = this.extractFromConversation(state, 'value');
    const scope = this.extractScope(state);
    const successCriteria = this.extractSuccessCriteria(state);
    const userFlow = this.extractFromConversation(state, 'flow');
    const technicalConstraints = this.extractTechnicalConstraints(state);

    // Get edge cases - combine discovered ones with newly analyzed
    let edgeCases = [...state.discoveredEdgeCases];
    if (state.codebaseContext) {
      try {
        const analyzed = await analyzeEdgeCases(
          state.codebaseContext,
          state.conversationHistory,
          this.llm
        );
        // Add any new edge cases not already discovered
        for (const ec of analyzed) {
          if (!edgeCases.some(existing => existing.description === ec.description)) {
            edgeCases.push(ec);
          }
        }
      } catch {
        // Continue without additional edge cases
      }
    }

    // Generate implementation diagram
    let implementationDiagram;
    if (state.codebaseContext) {
      try {
        implementationDiagram = await generateImplementationDiagram(
          state.codebaseContext,
          { scope, solutionSummary } as any,
          this.llm
        );
      } catch {
        implementationDiagram = generateFallbackDiagram({ scope, solutionSummary } as any);
      }
    } else {
      implementationDiagram = generateFallbackDiagram({ scope, solutionSummary } as any);
    }

    // Estimate complexity
    const effortEstimate = await estimateComplexity(
      state.codebaseContext || {
        files: [],
        patterns: [],
        dependencies: [],
        techStack: [],
        architecture: '',
        discoveredAt: Date.now(),
      },
      {
        scope,
        edgeCases,
        technicalConstraints,
      } as any
    );

    // Determine gaps and confidence
    const { gaps } = canSignOffV2(state.dimensions);
    const confidence = gaps.length === 0 ? 'high' : gaps.length <= 2 ? 'medium' : 'low';

    return {
      solutionSummary,
      userValue,
      scope,
      successCriteria,
      userFlow,
      gaps,
      confidence,
      problemContext: state.loadedProblem || undefined,
      codebaseContext: state.codebaseContext || undefined,
      edgeCases,
      effortEstimate,
      implementationDiagram,
      technicalConstraints,
    };
  }

  /**
   * Evaluate all dimensions against the latest message.
   */
  private async evaluateAllDimensions(
    state: SessionStateV2,
    userMessage: string
  ): Promise<Array<{
    dimensionId: DimensionIdV2;
    newCoverage: any;
    evidence: string[];
    reasoning: string;
  }>> {
    const conversationContext = state.conversationHistory
      .slice(-10)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    const evaluations = await Promise.all(
      (Object.keys(DIMENSIONS_V2) as DimensionIdV2[]).map(async (dimId) => {
        const prompt = buildEvaluationPromptV2(
          userMessage,
          conversationContext,
          dimId,
          state.loadedProblem
        );

        try {
          const response = await this.llm.chat(
            [{ role: 'user', content: prompt }],
            'You are a precise evaluator. Respond only with valid JSON.'
          );

          const parsed = JSON.parse(response.content);
          return {
            dimensionId: dimId,
            newCoverage: parsed.coverage,
            evidence: parsed.evidence || [],
            reasoning: parsed.reasoning || '',
          };
        } catch {
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

  /**
   * Format progress display.
   */
  private formatProgress(state: SessionStateV2): string {
    const lines: string[] = ['**Progress:**', ''];

    for (const [id, dim] of Object.entries(state.dimensions)) {
      const def = DIMENSIONS_V2[id as DimensionIdV2];
      const bar = this.makeProgressBar(dim.coverage);
      lines.push(`${bar} ${def.name}: ${dim.coverage}`);
    }

    const { ready, gaps } = canSignOffV2(state.dimensions);
    lines.push('');
    lines.push(ready
      ? '✓ Ready for sign-off'
      : `⏳ Still need: ${gaps.map(g => DIMENSIONS_V2[g].name).join(', ')}`
    );

    if (state.codebaseContext) {
      lines.push('');
      lines.push(`📁 Codebase context: ${state.codebaseContext.files.length} files, ${state.codebaseContext.patterns.length} patterns`);
    }

    if (state.discoveredEdgeCases.length > 0) {
      lines.push(`⚠️ Edge cases discovered: ${state.discoveredEdgeCases.length}`);
    }

    return lines.join('\n');
  }

  /**
   * Format codebase context display.
   */
  private formatContext(state: SessionStateV2): string {
    if (!state.codebaseContext) {
      return '**Codebase Context:** No context loaded.\n\nUse `/load <path>` or inject context via the API.';
    }

    return '**Codebase Context:**\n\n' + buildCodebaseContextSection(state.codebaseContext);
  }

  /**
   * Make a simple progress bar.
   */
  private makeProgressBar(coverage: string): string {
    const levels: Record<string, number> = { not_started: 0, weak: 1, partial: 2, strong: 3 };
    const filled = levels[coverage] || 0;
    return '█'.repeat(filled) + '░'.repeat(3 - filled);
  }

  /**
   * Get help text.
   */
  private getHelp(): string {
    return `
**Available Commands:**
  /progress        - Show detailed dimension status
  /eject           - Exit early and generate best-effort output
  /export [format] - Export solution spec (formats: markdown, json)
  /save <name>     - Save to specs/solutions/<name>.md
  /load <path>     - Load problem statement from file
  /context         - Show current codebase context
  /help            - Show this help message

**v2 Features:**
  • Codebase-aware design suggestions
  • Automatic edge case discovery
  • Implementation diagrams (Mermaid)
  • Effort estimation (T-shirt sizing)

**Tips:**
  • Describe your solution concept clearly
  • Think about who uses it and what value they get
  • Be explicit about what's in scope and out of scope
  • Define how you'll know if it works
`.trim();
  }

  // Helper methods for extracting information from conversation
  private extractFromConversation(state: SessionStateV2, type: string): string {
    // In a real implementation, this would use LLM to extract
    // For now, return a placeholder based on conversation content
    const messages = state.conversationHistory
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join(' ');

    if (type === 'solution' && messages.length > 0) {
      return 'Solution based on conversation context';
    }
    if (type === 'value' && messages.length > 0) {
      return 'User value derived from discussion';
    }
    if (type === 'flow' && messages.length > 0) {
      return 'User flow described in conversation';
    }

    return 'Not yet defined';
  }

  private extractScope(state: SessionStateV2): { included: string[]; excluded: string[]; futureConsiderations: string[] } {
    // Placeholder - would extract from conversation
    return {
      included: ['Core functionality'],
      excluded: ['Out of scope items'],
      futureConsiderations: ['Future enhancements'],
    };
  }

  private extractSuccessCriteria(state: SessionStateV2): string[] {
    // Placeholder - would extract from conversation
    return ['Success criterion 1', 'Success criterion 2'];
  }

  private extractTechnicalConstraints(state: SessionStateV2): string[] {
    const constraints: string[] = [];

    if (state.codebaseContext) {
      if (state.codebaseContext.techStack.length > 0) {
        constraints.push(`Must use existing tech stack: ${state.codebaseContext.techStack.join(', ')}`);
      }
      if (state.codebaseContext.architecture) {
        constraints.push(`Must fit ${state.codebaseContext.architecture} architecture`);
      }
    }

    return constraints;
  }
}
