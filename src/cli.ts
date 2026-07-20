#!/usr/bin/env node
/** Command-line entrypoint for @codetour/local. */

import { runValidate } from './commands/validate.js';
import { runExport } from './commands/export.js';
import { runDev } from './server/devServer.js';

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string | boolean>;
}

const USAGE = `codetour — local, offline code-tour websites

Usage:
  codetour dev [root] [--port <n>]        Serve the viewer with live reload (default port 4317)
  codetour export [root] [--out <dir>]    Write a static site (default ./codetour-site)
  codetour validate [root]                Parse content and report problems

Arguments:
  root                                    Project directory (default: current directory)

Options:
  --port <n>       Dev server port (default 4317)
  --out <dir>      Export output directory (default codetour-site)
  -h, --help       Show this help
  -v, --version    Show version
`;

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags.set(key, next);
        i++;
      } else {
        flags.set(key, true);
      }
    } else if (arg.startsWith('-')) {
      flags.set(arg.slice(1), true);
    } else {
      positionals.push(arg);
    }
  }

  return { command, positionals, flags };
}

async function main(): Promise<number> {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));

  const wantsHelp =
    flags.has('help') ||
    flags.has('h') ||
    command === 'help' ||
    command === '--help' ||
    command === '-h';
  const wantsVersion =
    flags.has('version') ||
    flags.has('v') ||
    command === '--version' ||
    command === '-v';

  if (wantsVersion) {
    console.log(await readVersion());
    return 0;
  }
  if (wantsHelp || !command) {
    console.log(USAGE);
    // No command at all is a usage error; an explicit --help is success.
    return command ? 0 : 1;
  }

  const root = positionals[0] ?? process.cwd();

  switch (command) {
    case 'validate': {
      const result = await runValidate(root);
      return result.ok ? 0 : 1;
    }
    case 'export': {
      const out = String(flags.get('out') ?? 'codetour-site');
      const result = await runExport(root, { out });
      return result.ok ? 0 : 1;
    }
    case 'dev': {
      const port = Number(flags.get('port') ?? 4317);
      await runDev(root, { port });
      return await new Promise<number>(() => {
        /* run until interrupted */
      });
    }
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(USAGE);
      return 1;
  }
}

async function readVersion(): Promise<string> {
  try {
    const { packageRoot } = await import('./commands/paths.js');
    const { readFile } = await import('node:fs/promises');
    const pkg = JSON.parse(
      await readFile(`${packageRoot()}/package.json`, 'utf8'),
    );
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
