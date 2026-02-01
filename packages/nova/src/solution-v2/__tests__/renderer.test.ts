import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CLIRendererV2 } from '../cli/renderer.js';
import { createSessionV2, setCodebaseContext, addEdgeCase } from '../core/state-machine.js';
import type { CodebaseContext, EdgeCase, LoadedProblem } from '../core/types.js';

// Mock chalk, ora, and boxen
vi.mock('chalk', () => ({
  default: {
    bold: vi.fn((s: string) => `[BOLD]${s}[/BOLD]`),
    blue: vi.fn((s: string) => `[BLUE]${s}[/BLUE]`),
    white: vi.fn((s: string) => s),
    dim: vi.fn((s: string) => `[DIM]${s}[/DIM]`),
    green: vi.fn((s: string) => `[GREEN]${s}[/GREEN]`),
    yellow: vi.fn((s: string) => `[YELLOW]${s}[/YELLOW]`),
    red: vi.fn((s: string) => `[RED]${s}[/RED]`),
    gray: vi.fn((s: string) => `[GRAY]${s}[/GRAY]`),
    hex: vi.fn(() => (s: string) => `[HEX]${s}[/HEX]`),
    cyan: vi.fn((s: string) => `[CYAN]${s}[/CYAN]`),
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
  })),
}));

vi.mock('boxen', () => ({
  default: vi.fn((content: string) => `[BOX]${content}[/BOX]`),
}));

describe('CLIRendererV2', () => {
  let renderer: CLIRendererV2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutSpy: any;

  beforeEach(() => {
    renderer = new CLIRendererV2();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('showWelcome', () => {
    it('should display welcome message for v2', () => {
      renderer.showWelcome();

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Solution Architect v2');
    });

    it('should display loaded problem when provided', () => {
      const problem: LoadedProblem = {
        problem: 'Users cannot find search results',
        who: 'Product managers',
        sourceFile: 'problem.md',
      };

      renderer.showWelcome(problem);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('problem.md');
    });

    it('should display codebase context summary when provided', () => {
      const context: CodebaseContext = {
        files: [{ path: 'src/api.ts', type: 'controller', description: 'API', relevance: 'high' }],
        patterns: [],
        dependencies: [],
        techStack: ['TypeScript', 'React'],
        architecture: 'MVC',
        discoveredAt: Date.now(),
      };

      renderer.showWelcome(undefined, context);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Codebase context');
    });
  });

  describe('showProgress', () => {
    it('should display all 6 dimensions', () => {
      const session = createSessionV2('test-id');

      renderer.showProgress(session);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Solution Clarity');
      expect(output).toContain('Technical Constraints');
      expect(output).toContain('Edge Cases');
    });

    it('should show codebase context indicator when present', () => {
      let session = createSessionV2('test-id');
      const context: CodebaseContext = {
        files: [{ path: 'test.ts', type: 'file', description: 'Test', relevance: 'high' }],
        patterns: [],
        dependencies: [],
        techStack: ['TypeScript'],
        architecture: '',
        discoveredAt: Date.now(),
      };
      session = setCodebaseContext(session, context);

      renderer.showProgress(session);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Codebase context');
    });

    it('should show edge case count when present', () => {
      let session = createSessionV2('test-id');
      const edgeCase: EdgeCase = {
        id: 'ec-1',
        description: 'Test edge case',
        source: 'llm_inference',
        severity: 'high',
        recommendation: 'Handle it',
        discoveredAt: Date.now(),
      };
      session = addEdgeCase(session, edgeCase);

      renderer.showProgress(session);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Edge cases');
    });
  });

  describe('streamText', () => {
    it('should write text to stdout', () => {
      renderer.streamText('Hello world');

      expect(stdoutSpy).toHaveBeenCalledWith('Hello world');
    });
  });

  describe('showError', () => {
    it('should display error message', () => {
      const errorSpy = vi.spyOn(console, 'error');
      renderer.showError('Something went wrong');

      expect(errorSpy).toHaveBeenCalled();
      const output = errorSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('Something went wrong');
    });
  });

  describe('showOutput', () => {
    it('should display output text', () => {
      renderer.showOutput('Generated output');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Generated output');
    });
  });

  describe('showCodebaseContext', () => {
    it('should display codebase context details', () => {
      const context: CodebaseContext = {
        files: [
          { path: 'src/api.ts', type: 'controller', description: 'API handler', relevance: 'high' },
          { path: 'src/utils.ts', type: 'utility', description: 'Helpers', relevance: 'low' },
        ],
        patterns: [
          { name: 'Repository', location: 'src/repos', description: 'Data access', examples: ['userRepo.ts'] },
        ],
        dependencies: [
          { name: 'express', version: '^4.18.0', type: 'production', usage: 'Web framework' },
        ],
        techStack: ['Node.js', 'TypeScript', 'Express'],
        architecture: 'Layered architecture',
        discoveredAt: Date.now(),
      };

      renderer.showCodebaseContext(context);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Tech Stack');
      expect(output).toContain('TypeScript');
      expect(output).toContain('src/api.ts');
      expect(output).toContain('Repository');
    });

    it('should handle empty context gracefully', () => {
      const context: CodebaseContext = {
        files: [],
        patterns: [],
        dependencies: [],
        techStack: [],
        architecture: '',
        discoveredAt: Date.now(),
      };

      renderer.showCodebaseContext(context);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('showEdgeCases', () => {
    it('should display edge cases with severity', () => {
      const edgeCases: EdgeCase[] = [
        {
          id: 'ec-1',
          description: 'Network timeout',
          source: 'llm_inference',
          severity: 'critical',
          recommendation: 'Add retry logic',
          discoveredAt: Date.now(),
        },
        {
          id: 'ec-2',
          description: 'Invalid input',
          source: 'user_input',
          severity: 'medium',
          recommendation: 'Validate input',
          discoveredAt: Date.now(),
        },
      ];

      renderer.showEdgeCases(edgeCases);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Network timeout');
      expect(output).toContain('CRITICAL'); // uppercase in output
      expect(output).toContain('Invalid input');
    });

    it('should show message when no edge cases', () => {
      renderer.showEdgeCases([]);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('No edge cases');
    });
  });

  describe('showEffortEstimate', () => {
    it('should display T-shirt size estimate', () => {
      const estimate = {
        size: 'M' as const,
        reasoning: 'Medium complexity due to multiple components',
        confidence: 'medium' as const,
        factors: ['3 files to modify', '2 integrations'],
      };

      renderer.showEffortEstimate(estimate);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('M');
      expect(output).toContain('Medium complexity');
    });
  });

  describe('startThinking and stopThinking', () => {
    it('should start and stop spinner', () => {
      renderer.startThinking();
      renderer.stopThinking();

      // Just verify no errors thrown
      expect(true).toBe(true);
    });
  });

  describe('newLine', () => {
    it('should print a blank line', () => {
      renderer.newLine();

      expect(consoleSpy).toHaveBeenCalledWith('');
    });
  });
});
