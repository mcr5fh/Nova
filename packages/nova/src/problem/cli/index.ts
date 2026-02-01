import { createInterface } from 'readline';
import { ProblemAdvisor } from '../api/advisor.js';
import { CLIRenderer } from './renderer.js';

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
  }

  rl.close();
}
