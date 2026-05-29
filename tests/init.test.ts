import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { initializeHarness } from "../src/commands/init.js";
import { pathExists } from "../src/harness.js";
import {
  HARNESS_BRIDGE_MARKER_END,
  HARNESS_BRIDGE_MARKER_START,
  HARNESS_MARKER_END,
  HARNESS_MARKER_START
} from "../src/templates.js";

test("init generates the harness files in an empty directory", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-init-"));
  const result = await initializeHarness({ targetPath: repoRoot });

  assert.equal(result.actions.some((action) => action.file === "CLAUDE.md"), true);

  const expectedFiles = [
    "CLAUDE.md",
    "docs/harness-config.json",
    "docs/harness-state.json",
    "docs/project-memory.md",
    "docs/decisions.md",
    "docs/contracts/README.md",
    "docs/contracts/example-contract.md"
  ];

  for (const relativePath of expectedFiles) {
    assert.equal(await pathExists(path.join(repoRoot, relativePath)), true, `${relativePath} should exist`);
  }
});

test("init writes CLAUDE guidance for stale-session recovery and task wrap-up", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-claude-guidance-"));
  await initializeHarness({ targetPath: repoRoot });

  const claudeContent = await readFile(path.join(repoRoot, "CLAUDE.md"), "utf8");

  assert.match(claudeContent, /ignore stale chat context until the harness files below have been reread/u);
  assert.match(claudeContent, /Before ending any meaningful task, update the configured state file/u);
  assert.match(claudeContent, /whether the harness state, decisions, or project memory were updated/u);
});

test("init safely activates harness in an existing CLAUDE.md repository", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-claude-"));
  const claudePath = path.join(repoRoot, "CLAUDE.md");
  const customClaude = "# Custom Claude\n\nDo not overwrite me.\n";

  await writeFile(claudePath, customClaude, "utf8");

  const result = await initializeHarness({ targetPath: repoRoot });
  const preservedClaude = await readFile(claudePath, "utf8");
  const harnessClaude = await readFile(path.join(repoRoot, "CLAUDE.harness.md"), "utf8");

  assert.match(preservedClaude, /# Custom Claude/u);
  assert.match(preservedClaude, new RegExp(escapeForRegExp(HARNESS_BRIDGE_MARKER_START), "u"));
  assert.match(preservedClaude, new RegExp(escapeForRegExp(HARNESS_BRIDGE_MARKER_END), "u"));
  assert.match(preservedClaude, /ignore stale chat context until the harness files have been reread/u);
  assert.equal(await pathExists(path.join(repoRoot, "CLAUDE.harness.md")), true);
  assert.match(harnessClaude, new RegExp(escapeForRegExp(HARNESS_MARKER_START), "u"));
  assert.match(harnessClaude, new RegExp(escapeForRegExp(HARNESS_MARKER_END), "u"));
  assert.match(harnessClaude, /Before ending any meaningful task, update the configured state file/u);
  assert.equal(result.notes.some((note) => note.includes("activation bridge")), true);
});

test("init does not duplicate the harness bridge on repeated runs", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-idempotent-"));
  const claudePath = path.join(repoRoot, "CLAUDE.md");
  await writeFile(claudePath, "# Team Rules\n\nKeep this heading.\n", "utf8");

  await initializeHarness({ targetPath: repoRoot });
  await initializeHarness({ targetPath: repoRoot });

  const claudeContent = await readFile(claudePath, "utf8");

  assert.equal(countOccurrences(claudeContent, HARNESS_BRIDGE_MARKER_START), 1);
  assert.equal(countOccurrences(claudeContent, HARNESS_BRIDGE_MARKER_END), 1);
  assert.match(claudeContent, /# Team Rules/u);
});

function countOccurrences(content: string, needle: string): number {
  return content.split(needle).length - 1;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
