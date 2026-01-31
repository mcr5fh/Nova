import chalk from 'chalk';
import ora, { Ora } from 'ora';
import boxen from 'boxen';
import { SessionState, DimensionId, LoadedProblem } from '../core/types.js';
import { DIMENSIONS, canSignOff } from '../core/dimensions.js';

export class CLIRenderer {
  private spinner: Ora | null = null;

  showWelcome(loadedProblem?: LoadedProblem): void {
    const welcome = boxen(
      chalk.bold('Solution Architect') + '\n\n' +
      'I help identify WHAT to build to solve a problem.\n' +
      'Bring a problem statement and we\'ll design\n' +
      'the solution together.\n\n' +
      chalk.dim('Commands: /progress, /eject, /save, /load, /help'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue',
      }
    );
    console.log(welcome);

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

  showProgress(state: SessionState): void {
    const statusColors: Record<string, (s: string) => string> = {
      not_started: chalk.gray,
      weak: chalk.yellow,
      partial: chalk.hex('#FFA500'), // orange
      strong: chalk.green,
    };

    console.log('\n' + chalk.bold('Progress:'));

    for (const [id, dim] of Object.entries(state.dimensions)) {
      const def = DIMENSIONS[id as DimensionId];
      const colorFn = statusColors[dim.coverage];
      const bar = this.makeProgressBar(dim.coverage);
      console.log(`  ${colorFn(bar)} ${def.name}`);
    }

    const { ready } = canSignOff(state.dimensions);
    console.log(ready
      ? chalk.green('\n✓ Ready for sign-off')
      : chalk.yellow('\n⏳ Keep going...')
    );
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

  newLine(): void {
    console.log('');
  }
}
