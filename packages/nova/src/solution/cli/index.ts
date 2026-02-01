import { createInterface } from 'readline';
import { SolutionArchitect } from '../api/architect.js';
import { CLIRenderer } from './renderer.js';
import { loadProblemStatement } from '../core/file-exporter.js';
import { setLoadedProblem } from '../core/state-machine.js';

/**
 * Reads multi-line input from the user.
 * - Shows prompt for first line, then continuation prompt for additional lines
 * - Supports pasted multi-line content (detects rapid successive lines)
 * - User submits by pressing Enter on an empty line
 * - Returns null if the readline is closed (EOF)
 */
function readMultilineInput(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    let lastLineTime = 0;
    let waitingForMore = false;
    let timeoutId: NodeJS.Timeout | null = null;
    let closed = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      rl.removeListener('line', onLine);
      rl.removeListener('close', onClose);
    };

    const submit = () => {
      cleanup();
      if (closed && lines.length === 0) {
        resolve(null);
      } else {
        resolve(lines.join('\n'));
      }
    };

    const onClose = () => {
      closed = true;
      submit();
    };

    const onLine = (line: string) => {
      const now = Date.now();
      const timeSinceLastLine = now - lastLineTime;
      lastLineTime = now;

      // Clear any pending timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // If this is a rapid paste (< 50ms between lines), accumulate without prompting
      const isRapidPaste = timeSinceLastLine < 50 && lines.length > 0;

      if (line === '' && !isRapidPaste) {
        // Empty line that's not part of a paste = submit
        submit();
        return;
      }

      lines.push(line);

      // After receiving a line, wait briefly to see if more lines are coming (paste detection)
      // If no more lines come within 100ms, show continuation prompt or submit
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (!waitingForMore) {
          waitingForMore = true;
          // Show continuation prompt to indicate we're waiting for more input
          process.stdout.write('... ');
        }
      }, 100);
    };

    rl.on('line', onLine);
    rl.once('close', onClose);

    // Show initial prompt
    process.stdout.write(prompt);
    lastLineTime = Date.now();
  });
}

export async function runCLI(options: {
  apiKey: string;
  modelId?: string;
  resume?: string;
  loadPath?: string;
}): Promise<void> {
  const renderer = new CLIRenderer();

  const architect = new SolutionArchitect({
    llmProvider: 'anthropic',
    modelId: options.modelId || 'claude-sonnet-4-20250514',
    apiKey: options.apiKey,
    streamResponses: true,
  });

  // Start or resume session
  const { id: sessionId, state: initialState } = architect.startSession(options.resume);
  let currentState = initialState;

  // Load problem if path provided
  let loadedProblem = null;
  if (options.loadPath) {
    try {
      loadedProblem = await loadProblemStatement(options.loadPath);
      await architect.loadProblem(sessionId, options.loadPath);
      currentState = architect.getState(sessionId) || currentState;
    } catch (error) {
      console.error(`Failed to load problem: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  renderer.showWelcome(loadedProblem || undefined);

  if (options.resume) {
    renderer.showResponse('Resumed previous session.\n');
    renderer.showProgress(currentState);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Main conversation loop
  while (true) {
    const input = await readMultilineInput(rl, 'You: ');

    // Handle EOF or closed input
    if (input === null) {
      console.log('\nGoodbye!\n');
      break;
    }

    const trimmed = input.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      console.log('\nGoodbye!\n');
      break;
    }

    renderer.newLine();
    renderer.startThinking();

    let firstChunk = true;

    try {
      for await (const chunk of architect.chat(sessionId, trimmed)) {
        if (chunk.type === 'text' && chunk.text) {
          if (firstChunk) {
            renderer.stopThinking();
            process.stdout.write('Architect: ');
            firstChunk = false;
          }
          renderer.streamText(chunk.text);
        } else if (chunk.type === 'progress') {
          // Could show mini progress indicator here
        } else if (chunk.type === 'loaded' && chunk.loadedProblem) {
          // Problem was loaded via /load command
          currentState = architect.getState(sessionId) || currentState;
        }
      }

      renderer.newLine();
      renderer.newLine();
    } catch (error) {
      renderer.stopThinking();
      renderer.showError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  rl.close();
}
