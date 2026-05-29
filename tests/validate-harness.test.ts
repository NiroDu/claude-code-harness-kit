import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { initializeHarness } from "../src/commands/init.js";
import { runValidateHarness } from "../src/commands/validate-harness.js";

test("validate-harness reports missing files in an uninitialized repository", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-missing-"));
  const result = await runValidateHarness(repoRoot);

  assert.equal(result.ok, false);
  assert.match(result.output, /Missing `CLAUDE\.md`/u);
  assert.match(result.output, /Missing harness config file/u);
});

test("validate-harness reports invalid JSON in the state file", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-invalid-json-"));
  await initializeHarness({ targetPath: repoRoot });

  await writeFile(path.join(repoRoot, "docs/harness-state.json"), "{\n  \"currentGoal\":\n", "utf8");

  const result = await runValidateHarness(repoRoot);

  assert.equal(result.ok, false);
  assert.match(result.output, /docs\/harness-state\.json: Invalid JSON/u);
});

test("validate-harness fails when a sidecar exists but CLAUDE.md does not activate it", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-inactive-"));
  const claudePath = path.join(repoRoot, "CLAUDE.md");
  await writeFile(claudePath, "# Existing Rules\n\nNo harness here.\n", "utf8");
  await initializeHarness({ targetPath: repoRoot });

  await writeFile(claudePath, "# Existing Rules\n\nStill no harness bridge.\n", "utf8");

  const result = await runValidateHarness(repoRoot);

  assert.equal(result.ok, false);
  assert.match(
    result.output,
    /CLAUDE\.harness\.md` exists, but `CLAUDE\.md` does not activate it with a claude-harness-kit bridge or merged harness block/u
  );
});

test("validate-harness fails when CLAUDE.md has only empty bridge markers", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-empty-bridge-"));
  await initializeHarness({ targetPath: repoRoot });

  await writeFile(
    path.join(repoRoot, "CLAUDE.md"),
    [
      "# Existing Rules",
      "",
      "<!-- claude-harness-kit:bridge:start -->",
      "<!-- claude-harness-kit:bridge:end -->",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = await runValidateHarness(repoRoot);

  assert.equal(result.ok, false);
  assert.match(
    result.output,
    /CLAUDE\.md` contains claude-harness-kit bridge markers, but the bridge block is empty or missing the activation instructions/u
  );
});

test("validate-harness fails when CLAUDE.harness.md has only empty harness markers", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-empty-supplement-"));
  // Pre-create CLAUDE.md with custom content to trigger bridge mode (not full harness block)
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "# Repo Rules\n\nKeep me.\n", "utf8");
  await initializeHarness({ targetPath: repoRoot });

  // Now overwrite CLAUDE.harness.md with empty markers only
  await writeFile(
    path.join(repoRoot, "CLAUDE.harness.md"),
    ["<!-- claude-harness-kit:start -->", "<!-- claude-harness-kit:end -->", ""].join("\n"),
    "utf8"
  );

  const result = await runValidateHarness(repoRoot);

  assert.equal(result.ok, false);
  assert.match(
    result.output,
    /CLAUDE\.harness\.md` contains claude-harness-kit markers, but the harness block is empty or missing required workflow instructions/u
  );
});

test("validate-harness passes when an existing CLAUDE.md has been bridged", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-bridge-pass-"));
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "# Repo Rules\n\nKeep me.\n", "utf8");
  await initializeHarness({ targetPath: repoRoot });

  const result = await runValidateHarness(repoRoot);

  assert.equal(result.ok, true);
  assert.match(result.output, /^Harness validation .*?\nPASS/mu);
});

test("validate-harness follows custom configured paths and CLAUDE stays config-driven", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-custom-paths-"));
  await initializeHarness({ targetPath: repoRoot });

  const configPath = path.join(repoRoot, "docs/harness-config.json");
  const statePath = path.join(repoRoot, "docs/harness-state.json");
  const config = JSON.parse(await readFile(configPath, "utf8")) as {
    paths: {
      stateFile: string;
      memoryFile: string;
      decisionsFile: string;
      contractsDir: string;
    };
  };
  const state = JSON.parse(await readFile(statePath, "utf8")) as {
    currentContract: string;
  };

  config.paths = {
    stateFile: ".claude-harness/state.json",
    memoryFile: ".claude-harness/memory.md",
    decisionsFile: ".claude-harness/decisions.md",
    contractsDir: ".claude-harness/contracts"
  };
  state.currentContract = ".claude-harness/contracts/example-contract.md";

  await mkdir(path.join(repoRoot, ".claude-harness/contracts"), { recursive: true });
  await cp(path.join(repoRoot, "docs/harness-state.json"), path.join(repoRoot, ".claude-harness/state.json"));
  await cp(path.join(repoRoot, "docs/project-memory.md"), path.join(repoRoot, ".claude-harness/memory.md"));
  await cp(path.join(repoRoot, "docs/decisions.md"), path.join(repoRoot, ".claude-harness/decisions.md"));
  await cp(
    path.join(repoRoot, "docs/contracts/README.md"),
    path.join(repoRoot, ".claude-harness/contracts/README.md")
  );
  await cp(
    path.join(repoRoot, "docs/contracts/example-contract.md"),
    path.join(repoRoot, ".claude-harness/contracts/example-contract.md")
  );

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await writeFile(path.join(repoRoot, ".claude-harness/state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");

  const result = await runValidateHarness(repoRoot);
  const claudeContent = await readFile(path.join(repoRoot, "CLAUDE.md"), "utf8");

  assert.equal(result.ok, true);
  assert.match(claudeContent, /paths\.stateFile/u);
  assert.doesNotMatch(claudeContent, /docs\/harness-state\.json/u);
});
