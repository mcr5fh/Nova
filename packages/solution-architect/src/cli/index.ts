import { createInterface } from 'readline';
import { SolutionArchitect } from '../api/architect.js';
import { CLIRenderer } from './renderer.js';
import { loadProblemStatement } from '../core/file-exporter.js';
import { setLoadedProblem } from '../core/state-machine.js';

function question(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
    rl.once('close', () => {
      resolve(null);
    });
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
    const input = await question(rl, 'You: ');

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
