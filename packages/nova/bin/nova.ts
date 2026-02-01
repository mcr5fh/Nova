#!/usr/bin/env node

import { Command } from 'commander';
import { runCLI as runProblemCLI } from '../src/problem/cli/index.js';
import { runCLI as runSolutionCLI } from '../src/solution/cli/index.js';

const program = new Command();

program
  .name('nova')
  .description('Problem definition and solution design workflows')
  .version('0.1.0');

// Problem subcommand
const problem = program
  .command('problem')
  .description('Problem definition workflow');

problem
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

    await runProblemCLI({
      apiKey,
      modelId: options.model,
    });
  });

problem
  .command('resume <sessionId>')
  .description('Resume a saved problem session')
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

// Solution subcommand
const solution = program
  .command('solution')
  .description('Solution design workflow');

solution
  .command('start')
  .description('Start a new solution design session')
  .option('-m, --model <model>', 'Model to use', 'claude-sonnet-4-20250514')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY)')
  .option('-l, --load <path>', 'Load problem statement from file')
  .action(async (options) => {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error('Error: API key required. Set ANTHROPIC_API_KEY or use --api-key');
      process.exit(1);
    }

    await runSolutionCLI({
      apiKey,
      modelId: options.model,
      loadPath: options.load,
    });
  });

solution
  .command('resume <sessionId>')
  .description('Resume a saved solution session')
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
