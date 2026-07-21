# CodeSafari agent skills

Skills shipped with `@tobisk/codesafari` for coding agents that generate
CodeSafari content **in other repositories**.

| Skill | Purpose |
| --- | --- |
| [`authoring-code-safaris`](authoring-code-safaris/SKILL.md) | Plan and author a full `.tour/` folder plus inline `@tour` comments for a codebase. |

The skill file is plain Markdown with YAML frontmatter, so it works with any
agent that can read a file. Below are the two setups we test.

## Claude Code

Copy the skill into the target repository (or into `~/.claude/skills/` to make
it available everywhere):

```bash
mkdir -p .claude/skills
cp -R node_modules/@tobisk/codesafari/skills/authoring-code-safaris .claude/skills/
```

Claude discovers it from the `name`/`description` frontmatter and loads it when
the request matches — or invoke it directly with `/authoring-code-safaris`.

## Codex

Codex reads `AGENTS.md` from the repository root. Copy the skill in the same
way, then point at it:

```bash
mkdir -p .agents/skills
cp -R node_modules/@tobisk/codesafari/skills/authoring-code-safaris .agents/skills/
```

and add to `AGENTS.md`:

```markdown
## Code tours

When asked to create, extend, or fix CodeSafari content — `.tour/` Markdown,
`@tour` source comments, code tours, onboarding walkthroughs — read
`.agents/skills/authoring-code-safaris/SKILL.md` first and follow it.
```

Inlining the whole skill into `AGENTS.md` also works if you prefer one file.

## Anything else

Give the agent the file and one instruction: *"follow
`authoring-code-safaris/SKILL.md` when writing code tours."* The skill is
self-contained and assumes no tool beyond a shell that can run
`npx @tobisk/codesafari validate`.
