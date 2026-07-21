#!/usr/bin/env node
/** Command-line entrypoint for @tobisk/codesafari. */

import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { runValidate } from './commands/validate.js';
import { runExport } from './commands/export.js';
import { runInsert } from './commands/insert.js';
import { runDev } from './server/devServer.js';
import { packageRoot } from './commands/paths.js';

async function readVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(
      await readFile(`${packageRoot()}/package.json`, 'utf8'),
    );
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// @tour pipeline:1 The CLI entry point
// Every run starts here. A `commander` program declares three subcommands —
// `dev`, `export`, and `validate` — each taking an optional `root` (defaulting
// to the current directory). Follow the `validate` branch through this tour.
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('codesafari')
    .description('Local, offline code-tour websites')
    .version(await readVersion(), '-v, --version')
    .showHelpAfterError();

  // @tour:detail The dev command
  // `dev` builds the manifest, serves the viewer, watches files, and — unless
  // `--no-open` is passed — opens your browser. This is what `npm run safari`
  // runs against this very repository.
  program
    .command('dev')
    .argument('[root]', 'project directory', process.cwd())
    .description('Serve the viewer with live reload')
    .option('-p, --port <number>', 'dev server port', '4317')
    .option('--no-open', 'do not open the browser on startup')
    .action(async (root: string, opts: { port: string; open: boolean }) => {
      const port = Number.parseInt(opts.port, 10);
      if (!Number.isInteger(port) || port <= 0) {
        program.error(`Invalid --port value: ${opts.port}`);
      }
      await runDev(root, { port, open: opts.open });
    });

  program
    .command('export')
    .argument('[root]', 'project directory', process.cwd())
    .description('Write a self-contained static site')
    .option('-o, --out <dir>', 'output directory', 'codesafari-site')
    .option('--no-ignore', 'do not add the output directory to .gitignore')
    .action(async (root: string, opts: { out: string; ignore: boolean }) => {
      const result = await runExport(root, { out: opts.out, ignore: opts.ignore });
      if (!result.ok) process.exitCode = 1;
    });

  // @tour:detail The validate command
  // `validate` is the pure check: build the manifest, print diagnostics, and
  // exit non-zero if anything is wrong. No server, no output written.
  program
    .command('validate')
    .argument('[root]', 'project directory', process.cwd())
    .description('Parse content and report problems')
    .action(async (root: string) => {
      const result = await runValidate(root);
      if (!result.ok) process.exitCode = 1;
    });

  program
    .command('insert')
    .argument('<spec>', 'JSON file describing the comments to insert')
    .argument('[root]', 'project directory', process.cwd())
    .description('Insert @tour comments into source files from a spec')
    .option('--dry-run', 'resolve and report, but write nothing')
    .option('--radius <lines>', 'how far from the line hint to search', '40')
    .action(
      async (
        spec: string,
        root: string,
        opts: { dryRun?: boolean; radius: string },
      ) => {
        const radius = Number.parseInt(opts.radius, 10);
        if (!Number.isInteger(radius) || radius < 0) {
          program.error(`Invalid --radius value: ${opts.radius}`);
        }
        const result = await runInsert(root, spec, {
          dryRun: opts.dryRun,
          radius,
        });
        if (!result.ok) process.exitCode = 1;
      },
    );

  // With no command, print help rather than doing nothing.
  if (process.argv.length <= 2) {
    program.help();
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
