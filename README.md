# claude-code-harness-kit

[中文文档](README-zh.md)

`claude-code-harness-kit` is a lightweight CLI plus scaffold for making any repository easier to run with a harness-style Claude Code workflow.

It does not try to become a new agent platform. v1 is intentionally small and only helps with five things:

1. state recovery
2. project memory
3. decision logging
4. task contracts
5. a minimal validation entrypoint

## What Problem It Solves

Long Claude Code tasks break down when context lives only in chat history. New sessions lose the current goal, scope drifts mid-task, repeated failures trigger more guessing, and important decisions disappear.

This toolkit moves the durable parts of the workflow into repository files so a new session can recover context from the repo itself before writing code.

## Why It Fits Long Tasks and Multi-Session Collaboration

The harness files make the repo readable by both humans and Claude Code:

- `docs/harness-state.json` stores the current goal, status, blockers, contract, and last verification result.
- `docs/project-memory.md` stores durable preferences and recurring pitfalls.
- `docs/decisions.md` stores explicit trade-offs and decisions.
- `docs/contracts/` stores task contracts with acceptance and validation notes.
- `CLAUDE.md` is the active instruction source. In repos that already have a custom `CLAUDE.md`, the tool adds a small activation bridge there and writes the detailed harness rules to `CLAUDE.harness.md`.

That means a new session can start with repository context instead of trying to reconstruct intent from old messages.

The generated `CLAUDE.md` templates also tell Claude Code to ignore stale session context until it has reread the harness files, and to close each meaningful task by updating harness state plus any durable decision or memory records.

## Non-Goals

v1 deliberately does not include:

- multi-agent orchestration
- a background daemon
- a web UI
- a database
- cloud services
- automatic file watching
- plugin or MCP ecosystems
- a new chat interface

## Install and Run

This repository is npm-ready. If you are using the source repo directly, use the local development path below. After the package is published, the npm install path becomes available.

Published package, after release:

```bash
npx claude-code-harness-kit init
```

Local development from this repository:

```bash
npm install
npm run build
node dist/src/cli.js --help
```

Or link the local checkout:

```bash
npm link
claude-code-harness-kit --help
```

## CLI Commands

```bash
claude-code-harness-kit init [path] [--force]
claude-code-harness-kit check-state [path]
claude-code-harness-kit validate-harness [path]
```

### `init`

Generates the minimal harness files in the current directory or a target path.

Files created by default:

- `CLAUDE.md`
- `docs/harness-config.json`
- `docs/harness-state.json`
- `docs/project-memory.md`
- `docs/decisions.md`
- `docs/contracts/README.md`
- `docs/contracts/example-contract.md`

When the target repo already has its own `CLAUDE.md`, `init` also writes:

- `CLAUDE.harness.md`

Safety behavior:

- Existing files are not overwritten by default.
- Re-running `init` is safe and mostly results in `unchanged` or `skipped` outcomes.
- If the target repo already has a `CLAUDE.md`, this tool preserves the existing content and appends a marker-based activation bridge to that file.
- In that same case, the detailed harness rules are written to `CLAUDE.harness.md`.
- Re-running `init` does not duplicate the bridge block.
- Use `--force` only when you explicitly want harness-managed files overwritten.

### `check-state`

Reads the harness config and state, then prints a concise summary:

- current goal
- current status
- current contract
- blockers
- most recent verification result
- next step suggestion

If files are missing or invalid, it prints a clear error plus a recovery hint.

### `validate-harness`

Checks that the key harness files exist, required JSON is valid, required fields are present, and the harness is actually activated in `CLAUDE.md`.

It does not stop at marker detection. The validator also checks that the claude-harness-kit bridge block and harness block still contain non-empty, recognizable activation/workflow content.

That means `validate-harness` now fails when:

- there is a plain `CLAUDE.md` with no claude-harness-kit block
- `CLAUDE.harness.md` exists but `CLAUDE.md` does not bridge or merge it
- the bridge exists but the harness supplement file is missing or malformed
- the bridge or harness markers still exist, but their actual instructions were hand-edited away and left as empty shells

## Initialize an Empty Repo

Fastest first-use path after installation:

```bash
claude-code-harness-kit init
claude-code-harness-kit check-state
claude-code-harness-kit validate-harness
```

Inside the target repository:

```bash
claude-code-harness-kit init
```

Or from elsewhere:

```bash
claude-code-harness-kit init /path/to/repo
```

## Initialize an Existing Repo

Run the same `init` command in the existing repo.

If the repo already has its own `CLAUDE.md`, the tool:

1. preserves the existing content
2. appends a clearly marked claude-harness-kit activation bridge to `CLAUDE.md`
3. writes the detailed harness workflow to `CLAUDE.harness.md`

This keeps the repo safe and readable while still making the harness an active instruction source instead of an ignored sidecar.

## What Counts as "Harness Activated"

The harness is considered activated only when `CLAUDE.md` explicitly includes claude-harness-kit instructions.

There are two valid states:

1. `CLAUDE.md` contains the full claude-harness-kit harness block.
2. `CLAUDE.md` contains the claude-harness-kit bridge block and that bridge points to a valid `CLAUDE.harness.md`.

Having an unrelated `CLAUDE.md` file is not enough. Having only `CLAUDE.harness.md` is not enough either.

## What to Tell Claude Code After Initialization

These prompts are intentionally simple. The harness files carry the durable details.

Minimal examples:

- `Restore state and continue.`
- `Update the contract first, then implement.`
- `Do not change code yet; tell me the current blockers.`
- `Write this decision into project memory.`
- `Ignore old session context, restore state from the harness files, then continue.`
- `Wrap up by updating harness-state, then report verification and next steps.`

## Recommended Claude Code Workflow

1. Start by restoring state from the harness files.
2. Update the contract if scope or acceptance changed.
3. Implement only the scoped task.
4. Run the smallest meaningful validation command.
5. Before ending the session, update state and any durable decision or memory records.

## Customizing Validation Commands

Edit `docs/harness-config.json` after initialization:

```json
{
  "commands": {
    "verifyQuick": "npm test",
    "verifyFull": "npm run verify",
    "docsGenerate": ""
  }
}
```

`check-state` and the `CLAUDE.md` rules assume these commands describe the repo's minimal and fuller validation steps.

## Path Configuration and Recovery

The fixed entrypoint is `docs/harness-config.json`.

The `CLAUDE.md` instructions intentionally tell Claude Code to read that config first, then follow:

- `paths.stateFile`
- `paths.memoryFile`
- `paths.decisionsFile`
- `paths.contractsDir`

So if you later move the state or memory files, update `docs/harness-config.json` and the harness instructions still hold. The active contract path in the state file should also be updated if contract files move.

## If Initialization Did Not Activate the Harness

Run:

```bash
claude-code-harness-kit validate-harness
```

If validation fails on activation:

1. rerun `claude-code-harness-kit init`
2. check that `CLAUDE.md` contains the claude-harness-kit block or bridge markers
3. if the repo uses a bridge, check that `CLAUDE.harness.md` exists and still contains the harness-managed block

## Using It in Other Projects

Until this package is published, the simplest options are:

1. clone this repo
2. run `npm install && npm run build`
3. use `node /path/to/claude-code-harness-kit/dist/src/cli.js init /path/to/target-repo`

Or link it globally with `npm link`.

## Optional Local Claude Code Skills

This repository also includes two optional local Claude Code skills under
[`extras/claude-skills/`](extras/claude-skills/README.md):

- `claude-harness-workflow`
- `claude-harness-wrap-up`

These are convenience shortcuts for people who use Claude Code regularly and want
shorter start/end prompts. They are not part of the npm package contract, and
the main product still remains:

- the CLI
- the generated repository files
- the `CLAUDE.md` workflow

To install them manually into your personal Claude Code setup:

```bash
mkdir -p ~/.claude/skills
cp -R extras/claude-skills/claude-harness-workflow ~/.claude/skills/
cp -R extras/claude-skills/claude-harness-wrap-up ~/.claude/skills/
```

Then start a new Claude Code session. Invoke with `/claude-harness-workflow` and `/claude-harness-wrap-up`.

## Assumptions in v1

- The default layout uses `docs/` because it stays readable in ordinary repos.
- JSON stays intentionally small and explicit instead of introducing a DSL.
- Validation commands are configured by the repository owner; the toolkit does not guess them.

## Development

```bash
npm run build
npm run typecheck
npm test
npm run verify
```

`npm run verify` currently runs:

1. TypeScript typecheck
2. build
3. Node built-in tests

## Current Limitations

- `check-state` summarizes the active contract path and title, but it does not parse acceptance criteria yet.
- `validate-harness` only validates the minimal v1 file set.
- The CLI does not edit state or contracts for you; it scaffolds and validates the workflow.
