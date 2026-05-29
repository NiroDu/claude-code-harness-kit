# Optional Claude Code Skills

These local skills are optional shortcuts for people who use `claude-code-harness-kit`
inside Claude Code regularly.

They are not part of the npm package contract, and the core product still
remains:

- the CLI
- the generated repository files
- the `CLAUDE.md` workflow

Use these skills only if you want faster prompt shortcuts in your personal Claude Code
setup.

## Included Skills

- `claude-harness-workflow`
- `claude-harness-wrap-up`

## Manual Install

### Personal skills (all your projects)

Copy the skill folders into your local Claude Code personal skills directory:

```bash
mkdir -p ~/.claude/skills
cp -R extras/claude-skills/claude-harness-workflow ~/.claude/skills/
cp -R extras/claude-skills/claude-harness-wrap-up ~/.claude/skills/
```

### Project skills (this project only)

```bash
mkdir -p .claude/skills
cp -R extras/claude-skills/claude-harness-workflow .claude/skills/
cp -R extras/claude-skills/claude-harness-wrap-up .claude/skills/
```

Then start a new Claude Code session, or restart the app if the new skills do
not appear immediately. Skills are invoked with `/claude-harness-workflow` and
`/claude-harness-wrap-up`.

## What They Do

`claude-harness-workflow` helps a session start correctly:

- restore repo state from harness files
- initialize or validate the harness when needed
- ignore stale session context in resumed conversations
- summarize current goal, contract, blockers, and next step before coding

`claude-harness-wrap-up` helps a session end correctly:

- update harness state
- record durable decisions or project memory when needed
- report what verification ran and what did not run
- leave the next step in repo artifacts instead of only in chat

## Typical Usage

```text
/claude-harness-workflow
```

```text
/claude-harness-wrap-up
```
