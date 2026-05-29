import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runCheckState } from "../src/commands/check-state.js";
import { initializeHarness } from "../src/commands/init.js";

test("check-state summarizes the current harness state", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "claude-code-harness-kit-state-"));
  await initializeHarness({ targetPath: repoRoot });

  const configPath = path.join(repoRoot, "docs/harness-config.json");
  const statePath = path.join(repoRoot, "docs/harness-state.json");
  const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  const state = JSON.parse(await readFile(statePath, "utf8")) as Record<string, unknown>;

  config.commands = {
    verifyQuick: "npm run verify",
    verifyFull: "npm run verify",
    docsGenerate: ""
  };
  state.currentGoal = "Ship the init workflow";
  state.status = "in_progress";
  state.blockers = ["Need to confirm README wording"];
  state.nextStep = "Tighten the README examples and rerun verify.";
  state.verification = {
    lastCommand: "npm run verify",
    lastResult: "passed",
    notes: "Typecheck and tests passed."
  };

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  const result = await runCheckState(repoRoot);

  assert.equal(result.ok, true);
  assert.match(result.output, /Current goal: Ship the init workflow/u);
  assert.match(result.output, /Current status: in_progress/u);
  assert.match(result.output, /Current contract: docs\/contracts\/example-contract\.md \(Example Contract\)/u);
  assert.match(result.output, /Need to confirm README wording/u);
  assert.match(result.output, /Recent verification result: passed/u);
  assert.match(
    result.output,
    /Next step suggestion: Resolve the blockers or explicitly re-plan before more implementation work\./u
  );
});
