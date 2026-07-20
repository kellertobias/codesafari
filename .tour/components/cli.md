---
slug: cli
title: CLI
summary: Argument parsing and the dev / export / validate commands.
order: 10
---

The command-line surface. [`src/cli.ts`](src/cli.ts) parses `argv` into a
command, positional `root`, and flags, then dispatches to one of three command
modules under `src/commands/` (plus the dev server under `src/server/`).

Everything the CLI needs at runtime — the parser, the manifest builder, and the
prebuilt viewer — ships inside the npm package, so `npx @kobisk/codesafari` works
with no separate download or post-install step.
