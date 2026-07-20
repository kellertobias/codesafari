#!/usr/bin/env node
/** Command-line entrypoint for @kobisk/codesafari. */

import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { runValidate } from './commands/validate.js';
import { runExport } from './commands/export.js';
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

  program
    .command('dev')
    .argument('[root]', 'project directory', process.cwd())
    .description('Serve the viewer with live reload')
    .option('-p, --port <number>', 'dev server port', '4317')
    .action(async (root: string, opts: { port: string }) => {
      const port = Number.parseInt(opts.port, 10);
      if (!Number.isInteger(port) || port <= 0) {
        program.error(`Invalid --port value: ${opts.port}`);
      }
      await runDev(root, { port });
    });

  program
    .command('export')
    .argument('[root]', 'project directory', process.cwd())
    .description('Write a self-contained static site')
    .option('-o, --out <dir>', 'output directory', 'codesafari-site')
    .action(async (root: string, opts: { out: string }) => {
      const result = await runExport(root, { out: opts.out });
      if (!result.ok) process.exitCode = 1;
    });

  program
    .command('validate')
    .argument('[root]', 'project directory', process.cwd())
    .description('Parse content and report problems')
    .action(async (root: string) => {
      const result = await runValidate(root);
      if (!result.ok) process.exitCode = 1;
    });

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
