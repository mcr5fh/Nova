#!/usr/bin/env node

import { Command } from 'commander';
import { runCLI } from '../src/cli/index.js';

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
