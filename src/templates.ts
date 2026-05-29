import type { HarnessConfig, HarnessState } from "./types.js";

export const DEFAULT_CONFIG_PATH = "docs/harness-config.json";
export const HARNESS_MARKER_START = "<!-- claude-harness-kit:start -->";
export const HARNESS_MARKER_END = "<!-- claude-harness-kit:end -->";
export const HARNESS_BRIDGE_MARKER_START = "<!-- claude-harness-kit:bridge:start -->";
export const HARNESS_BRIDGE_MARKER_END = "<!-- claude-harness-kit:bridge:end -->";

export function createDefaultConfig(): HarnessConfig {
  return {
    version: 1,
    paths: {
      stateFile: "docs/harness-state.json",
      memoryFile: "docs/project-memory.md",
      decisionsFile: "docs/decisions.md",
      contractsDir: "docs/contracts"
    },
    commands: {
      verifyQuick: "",
      verifyFull: "",
      docsGenerate: ""
    },
    rules: {
      maxRepeatedFailures: 2
    }
  };
}

export function createDefaultState(now = new Date()): HarnessState {
  return {
    currentGoal: "",
    status: "idle",
    currentContract: "docs/contracts/example-contract.md",
    blockers: [],
    nextStep: "Update the current goal and contract before making code changes.",
    lastUpdated: now.toISOString(),
    verification: {
      lastCommand: "",
      lastResult: "unknown",
      notes: "No verification has been recorded yet."
    }
  };
}

export function renderJsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function renderClaudeTemplate(configPath = DEFAULT_CONFIG_PATH): string {
  return `${HARNESS_MARKER_START}
# CLAUDE

## Claude Code Harness Workflow

1. At the start of any session, especially a resumed one, ignore stale chat context until the harness files below have been reread from the repository.
2. Before changing code, read \`${configPath}\` first.
3. Then use the configured paths from that file instead of assuming fixed \`docs/...\` locations:
   - read \`paths.stateFile\`
   - read the active contract referenced by \`currentContract\` inside the state file
   - read \`paths.decisionsFile\`
   - read \`paths.memoryFile\`
   - use \`paths.contractsDir\` for contract discovery
4. Use the configured validation commands from \`commands.verifyQuick\` and \`commands.verifyFull\` when they are set.
5. Restore state before editing. Do not jump straight into implementation.
6. Keep the contract current. If scope or acceptance changes, update the contract before more code changes.
7. After edits, run the smallest meaningful verification command and record the result in the file pointed to by \`paths.stateFile\`.
8. If the same class of failure reaches the configured repeated-failure limit in \`rules.maxRepeatedFailures\`, stop trial-and-error and write a short diagnosis with evidence, suspected root cause, and the safest next move.
9. Before ending any meaningful task, update the configured state file with the new status, blockers, next step, and verification result.
10. Capture durable context:
   - long-lived preferences and quirks go in \`paths.memoryFile\`
   - explicit trade-offs and architectural choices go in \`paths.decisionsFile\`
11. If the contract changed materially, update the active contract before ending the session.
12. Final responses must always say:
   - what changed
   - what verification ran
   - what verification did not run
   - whether the harness state, decisions, or project memory were updated

## Restore Prompt

When a new Claude Code session starts, begin by reading the harness files above. A good prompt is:

> Restore state and continue from the harness files before making changes.

When resuming an old session, a good prompt is:

> Ignore old session context, restore state from the harness files, then continue.

## Wrap-Up Prompt

Before ending a task, a good prompt is:

> Update harness-state, record any durable decisions or memory, then report verification and next steps.

## Guardrails

- Prefer the existing repo layout over inventing a new framework.
- Keep this harness lightweight; do not turn it into a platform.
- If validation is not configured yet, say so explicitly instead of claiming full verification.
${HARNESS_MARKER_END}
`;
}

export function renderClaudeHarnessSupplement(configPath = DEFAULT_CONFIG_PATH): string {
  return `${HARNESS_MARKER_START}
# CLAUDE Harness Supplement

This file is active only when \`CLAUDE.md\` contains the claude-harness-kit bridge block.

## Harness Rules

1. At the start of any session, especially a resumed one, ignore stale chat context until the harness files have been reread from the repository.
2. Read \`${configPath}\` first.
3. Resolve the working files from \`paths.stateFile\`, \`paths.memoryFile\`, \`paths.decisionsFile\`, and \`paths.contractsDir\`.
4. Open the active contract from \`currentContract\` in the state file before writing code.
5. Restore state before editing, then keep the contract current as scope changes.
6. After edits, run the smallest meaningful verification command from the config and record the result back into the configured state file.
7. Before ending any meaningful task, update the configured state file with status, blockers, next step, and verification result.
8. If repeated failures hit the configured limit in \`rules.maxRepeatedFailures\`, stop guessing and produce a diagnosis instead of trying random fixes.
9. Write durable preferences to the memory file and explicit trade-offs to the decisions file.
10. If the contract changed materially, update it before ending the session.
11. Final responses must say what changed, what verification ran, what verification did not run, and whether the harness records were updated.
${HARNESS_MARKER_END}
`;
}

export function renderClaudeActivationBridge(configPath = DEFAULT_CONFIG_PATH): string {
  return `${HARNESS_BRIDGE_MARKER_START}
## Claude Code Harness Activation

This repository uses \`claude-code-harness-kit\`.

Keep the existing instructions in this file, and additionally treat \`CLAUDE.harness.md\` as active instructions.

Before making code changes:

1. Read \`${configPath}\` first.
2. Use the file paths from the config \`paths\` object instead of assuming fixed \`docs/...\` paths.
3. Follow the harness workflow in \`CLAUDE.harness.md\` together with the rest of this file.
4. In resumed sessions, ignore stale chat context until the harness files have been reread.
5. Before ending meaningful work, follow the wrap-up steps in \`CLAUDE.harness.md\` so state, decisions, and memory stay current.
${HARNESS_BRIDGE_MARKER_END}
`;
}

export function renderProjectMemoryTemplate(): string {
  return `# Project Memory

Use this file for durable context that should survive across sessions.

## Product and Repo Context

- What this repository is for.
- Constraints that matter every time.

## Working Preferences

- Coding style choices that are stable over time.
- Review preferences or release expectations.

## Known Pitfalls

- Repeated mistakes, flaky areas, or environment traps.

## Open Questions Worth Tracking

- Questions that are not blockers today but should not disappear.
`;
}

export function renderDecisionsTemplate(): string {
  return `# Decisions

Record notable technical or product decisions here so they do not live only in chat history.

## Entry Template

### YYYY-MM-DD - Short Decision Title

- Context:
- Decision:
- Consequences:
- Follow-up:
`;
}

export function renderContractsReadmeTemplate(): string {
  return `# Contracts

Contracts define the current unit of work before code changes begin.

Each contract should answer:

1. What is being changed right now?
2. What is explicitly out of scope?
3. How will we know it is done?
4. What is the smallest verification that proves progress?

Suggested flow:

1. Update or create a contract.
2. Point \`currentContract\` in your configured state file at that contract.
3. Implement against the contract.
4. Run verification.
5. Update state and decisions.
`;
}

export function renderExampleContractTemplate(): string {
  return `# Example Contract

## Goal

Describe the current objective in one or two sentences.

## In Scope

- The smallest changes that count as success.

## Out of Scope

- Anything intentionally deferred.

## Acceptance Criteria

- A reader can tell whether the task is done.
- Validation steps are explicit.

## Verification Plan

- Quick check:
- Full check:

## Notes

- Risks, assumptions, or sequencing notes.
`;
}
