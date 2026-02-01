import chalk from 'chalk';
import ora, { Ora } from 'ora';
import boxen from 'boxen';
import type { SessionStateV2, DimensionIdV2, LoadedProblem, CodebaseContext, EdgeCase, TShirtSize } from '../core/types.js';
import { DIMENSIONS_V2, canSignOffV2 } from '../core/dimensions.js';

export class CLIRendererV2 {
  private spinner: Ora | null = null;

  showWelcome(loadedProblem?: LoadedProblem, codebaseContext?: CodebaseContext): void {
    const welcome = boxen(
      chalk.bold('Solution Architect v2') + '\n\n' +
      'I help identify WHAT to build to solve a problem.\n' +
      'Now with codebase-aware design suggestions,\n' +
      'edge case discovery, and effort estimation.\n\n' +
      chalk.dim('Commands: /progress, /eject, /save, /load, /context, /help'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue',
      }
    );
    console.log(welcome);

    if (codebaseContext) {
      console.log(chalk.cyan('\n📁 Codebase context loaded: ') +
        `${codebaseContext.files.length} files, ` +
        `${codebaseContext.patterns.length} patterns, ` +
        `${codebaseContext.techStack.join(', ')}`);
    }

    if (loadedProblem) {
      console.log(chalk.blue('\n📄 Problem loaded from: ') + loadedProblem.sourceFile);
      console.log(chalk.white(`\n"${loadedProblem.problem}"\n`));
      console.log(chalk.blue('What solution do you have in mind for this problem?\n'));
    } else {
      console.log(chalk.blue('\nWhat problem are you trying to solve, and what\'s your initial solution idea?\n'));
      console.log(chalk.dim('Tip: Use /load <path> to import a problem statement from problem-advisor\n'));
    }
  }

  startThinking(): void {
    this.spinner = ora({
      text: chalk.dim('Thinking...'),
      spinner: 'dots',
      discardStdin: false,
    }).start();
  }

  stopThinking(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  showResponse(text: string): void {
    console.log(chalk.white(text));
  }

  streamText(text: string): void {
    process.stdout.write(text);
  }

  showProgress(state: SessionStateV2): void {
    const statusColors: Record<string, (s: string) => string> = {
      not_started: chalk.gray,
      weak: chalk.yellow,
      partial: chalk.hex('#FFA500'), // orange
      strong: chalk.green,
    };

    console.log('\n' + chalk.bold('Progress:'));

    for (const [id, dim] of Object.entries(state.dimensions)) {
      const def = DIMENSIONS_V2[id as DimensionIdV2];
      const colorFn = statusColors[dim.coverage];
      const bar = this.makeProgressBar(dim.coverage);
      console.log(`  ${colorFn(bar)} ${def.name}`);
    }

    const { ready } = canSignOffV2(state.dimensions);
    console.log(ready
      ? chalk.green('\n✓ Ready for sign-off')
      : chalk.yellow('\n⏳ Keep going...')
    );

    // Show v2 specific status
    if (state.codebaseContext) {
      console.log(chalk.cyan(`\n📁 Codebase context: ${state.codebaseContext.files.length} files, ${state.codebaseContext.patterns.length} patterns`));
    }

    if (state.discoveredEdgeCases.length > 0) {
      console.log(chalk.yellow(`⚠️  Edge cases discovered: ${state.discoveredEdgeCases.length}`));
    }

    console.log('');
  }

  private makeProgressBar(coverage: string): string {
    const levels = { not_started: 0, weak: 1, partial: 2, strong: 3 };
    const filled = levels[coverage as keyof typeof levels] || 0;
    return '█'.repeat(filled) + '░'.repeat(3 - filled);
  }

  showError(message: string): void {
    console.error(chalk.red('Error: ') + message);
  }

  showOutput(output: string): void {
    console.log('\n' + chalk.blue(output) + '\n');
  }

  showLoadedProblem(problem: LoadedProblem): void {
    console.log(chalk.blue('\n📄 Problem loaded:'));
    console.log(chalk.white(`  Problem: ${problem.problem}`));
    console.log(chalk.white(`  Who: ${problem.who}`));
    if (problem.businessImpact) {
      console.log(chalk.white(`  Impact: ${problem.businessImpact}`));
    }
    console.log('');
  }

  showCodebaseContext(context: CodebaseContext): void {
    console.log('\n' + chalk.bold('Codebase Context:'));

    if (context.techStack.length > 0) {
      console.log(chalk.cyan('\n  Tech Stack: ') + context.techStack.join(', '));
    }

    if (context.architecture) {
      console.log(chalk.cyan('  Architecture: ') + context.architecture);
    }

    if (context.files.length > 0) {
      console.log(chalk.cyan('\n  Relevant Files:'));
      for (const file of context.files.slice(0, 10)) {
        const relevanceColor = file.relevance === 'high' ? chalk.green :
          file.relevance === 'medium' ? chalk.yellow : chalk.gray;
        console.log(`    ${relevanceColor('●')} ${file.path} (${file.type})`);
        console.log(chalk.dim(`      ${file.description}`));
      }
      if (context.files.length > 10) {
        console.log(chalk.dim(`    ... and ${context.files.length - 10} more`));
      }
    }

    if (context.patterns.length > 0) {
      console.log(chalk.cyan('\n  Patterns Identified:'));
      for (const pattern of context.patterns) {
        console.log(`    • ${chalk.bold(pattern.name)}: ${pattern.description}`);
        if (pattern.examples.length > 0) {
          console.log(chalk.dim(`      Examples: ${pattern.examples.join(', ')}`));
        }
      }
    }

    console.log('');
  }

  showEdgeCases(edgeCases: EdgeCase[]): void {
    if (edgeCases.length === 0) {
      console.log(chalk.dim('\n  No edge cases identified yet.\n'));
      return;
    }

    console.log('\n' + chalk.bold('Edge Cases Discovered:'));

    const severityColors: Record<string, (s: string) => string> = {
      critical: chalk.red,
      high: chalk.hex('#FFA500'),
      medium: chalk.yellow,
      low: chalk.green,
    };

    for (const ec of edgeCases) {
      const colorFn = severityColors[ec.severity] || chalk.white;
      console.log(`\n  ${colorFn(`[${ec.severity.toUpperCase()}]`)} ${ec.description}`);
      console.log(chalk.dim(`    Source: ${ec.source}`));
      console.log(chalk.white(`    → ${ec.recommendation}`));
      if (ec.affectedFiles && ec.affectedFiles.length > 0) {
        console.log(chalk.dim(`    Files: ${ec.affectedFiles.join(', ')}`));
      }
    }

    console.log('');
  }

  showEffortEstimate(estimate: TShirtSize): void {
    console.log('\n' + chalk.bold('Effort Estimate:'));

    const sizeColors: Record<string, (s: string) => string> = {
      XS: chalk.green,
      S: chalk.green,
      M: chalk.yellow,
      L: chalk.hex('#FFA500'),
      XL: chalk.red,
    };

    const colorFn = sizeColors[estimate.size] || chalk.white;
    console.log(`\n  Size: ${colorFn(chalk.bold(estimate.size))} (${estimate.confidence} confidence)`);
    console.log(chalk.white(`\n  ${estimate.reasoning}`));

    if (estimate.factors.length > 0) {
      console.log(chalk.cyan('\n  Factors:'));
      for (const factor of estimate.factors) {
        console.log(`    • ${factor}`);
      }
    }

    console.log('');
  }

  showDiagram(mermaid: string, description: string): void {
    console.log('\n' + chalk.bold('Implementation Diagram:'));
    if (description) {
      console.log(chalk.dim(`  ${description}`));
    }
    console.log(chalk.cyan('\n```mermaid'));
    console.log(mermaid);
    console.log(chalk.cyan('```\n'));
  }

  newLine(): void {
    console.log('');
  }
}
