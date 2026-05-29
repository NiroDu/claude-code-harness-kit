---
name: claude-harness-workflow
description: Use when a repository works with claude-code-harness-kit and you want Claude to restore state, initialize or validate the harness, ignore stale session context, and continue work through the repo artifacts instead of guessing from memory.
---

# Claude Code Harness Workflow

Use this skill when the repo should be driven by `claude-code-harness-kit`, especially in these cases:

- A new session starts in an empty repo and needs harness initialization before work begins.
- A new session starts in an existing repo and should recover state before editing code.
- A resumed session should stop relying on stale chat context and re-read the repo artifacts.
- You want a short prompt such as "restore state and continue" but expect the full harness workflow.

## Core rule

Do not begin implementation from chat context alone. Treat the repo artifacts as the source of truth:

- `CLAUDE.md`
- `CLAUDE.harness.md` when activated by `CLAUDE.md`
- `docs/harness-config.json`
- the configured state file from `paths.stateFile`
- the configured memory file from `paths.memoryFile`
- the configured decisions file from `paths.decisionsFile`
- the active contract referenced by the current state

## Workflow

1. Decide whether the repo is empty or already has project files.
2. If the repo does not appear to have a working harness yet, run `claude-code-harness-kit init`.
3. Run `claude-code-harness-kit validate-harness`.
4. If validation fails, repair or initialize the harness before continuing with feature work.
5. Run `claude-code-harness-kit check-state`.
6. Read the active harness artifacts and summarize:
   - current goal
   - current contract
   - blockers
   - next step
   - last verification result
7. Only then continue with implementation or analysis.

## Situation handling

### New session in an empty repo

- Initialize first with `claude-code-harness-kit init`.
- Validate with `claude-code-harness-kit validate-harness`.
- Summarize with `claude-code-harness-kit check-state`.
- Tell the user what is missing if the initial state is still mostly blank, such as empty goal or verification commands.

### New session in an existing repo

- Do not assume the harness is already active.
- Validate first.
- If the repo has no harness, initialize it safely.
- If the repo has an existing `CLAUDE.md`, preserve it and rely on the activation bridge workflow.
- Recover state from the configured files before editing code.

### Resumed session in an existing repo

- Explicitly ignore stale conversational context.
- Re-run validation and state recovery from repo files.
- Continue only from the recovered repository state, not from prior chat memory.

## Editing discipline

Before editing:

- Confirm the current goal, current contract, blockers, and next step.
- If the contract is missing or stale, update the contract before broad implementation.

After editing:

- Run the minimal verification command from `commands.verifyQuick` when it is configured.
- If a fuller check is clearly needed, use `commands.verifyFull`.
- Report exactly what verification ran and what did not run.
- Update the harness state so the next session can resume cleanly.

## Failure discipline

- If `validate-harness` fails, fix the harness before pretending work can safely continue.
- If the same category of failure happens twice in a row, stop trying random fixes.
- Output a diagnosis, likely root causes, and the safest next step instead of blind retries.

## Response shape

When using this skill, the first substantial response should include:

- whether the harness was already present or had to be initialized
- whether validation passed
- current goal
- current contract
- blockers
- next step

The closing response after implementation should include:

- what changed
- what verification ran
- what was not run
- whether the harness state was updated

## Short prompts this skill should expand correctly

- `/claude-harness-workflow and continue.`
- `/claude-harness-workflow in this empty repo.`
- `/claude-harness-workflow and ignore old session context.`
- `/claude-harness-workflow, restore state, then update the contract before coding.`
