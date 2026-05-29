---
name: claude-harness-wrap-up
description: Use when a task in a claude-code-harness-kit repository is ending and Claude should close the loop honestly by updating harness-state, recording important decisions or memory, and reporting what verification ran and what did not run.
---

# Claude Code Harness Wrap-Up

Use this skill when work is ending in a repository that uses `claude-code-harness-kit`.

This skill is for the final phase only. It does not replace initialization or state recovery. Use it after implementation, investigation, or planning work when the repo artifacts should be updated so the next session can resume cleanly.

## Core rule

Do not end the task with knowledge trapped only in chat. Move durable state back into the repository artifacts when appropriate.

## Wrap-up workflow

1. Identify what actually changed in this task.
2. Identify what verification actually ran.
3. Update the configured state file from `docs/harness-config.json`:
   - `status`
   - `blockers`
   - `nextStep`
   - `lastUpdated`
   - `verification.lastCommand`
   - `verification.lastResult`
   - `verification.notes`
4. If the task produced an important implementation decision, append it to the configured decisions file.
5. If the task revealed a durable team preference, workflow convention, or recurring pitfall, add it to the configured project memory file.
6. If the contract changed materially, update the active contract before finishing.
7. In the final response, state:
   - what changed
   - what verification ran
   - what did not run
   - current blockers
   - next step

## Decision rules

Update `harness-state` on every meaningful task closeout.

Update `decisions.md` when:

- the team made a choice that future work should follow
- a tradeoff was chosen over another valid path
- a fix depends on a non-obvious rationale

Update `project-memory.md` when:

- the repo has a durable preference
- there is a recurring gotcha
- there is a workflow expectation future sessions should remember

Update the contract when:

- scope changed
- acceptance changed
- the implementation plan changed enough that future work would be misled

## Honesty rules

- Never claim verification ran if it did not.
- Never say "done" without noting the unverified parts when checks were skipped.
- If no files were updated because there was nothing durable to record, say that explicitly instead of pretending a write happened.

## Response shape

The final response should be concise but must include:

- updated state summary
- verification summary
- any new decision or memory entry
- next step

## Short prompts this skill should expand correctly

- `/claude-harness-wrap-up`
- `/claude-harness-wrap-up and close this task honestly.`
- `/claude-harness-wrap-up and update the harness records.`
