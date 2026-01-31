import { createInterface } from 'readline';
import { ProblemAdvisor } from '../api/advisor.js';
import { CLIRenderer } from './renderer.js';

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

  // Return a promise that resolves when the user exits
  return new Promise<void>((resolve) => {
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
          resolve();
          return;
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
  });
}
