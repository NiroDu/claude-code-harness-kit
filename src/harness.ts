import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_CONFIG_PATH,
  HARNESS_BRIDGE_MARKER_END,
  HARNESS_BRIDGE_MARKER_START,
  HARNESS_MARKER_END,
  HARNESS_MARKER_START
} from "./templates.js";
import type {
  HarnessConfig,
  HarnessState,
  ValidationIssue,
  ValidationReport
} from "./types.js";

export {
  DEFAULT_CONFIG_PATH,
  HARNESS_BRIDGE_MARKER_END,
  HARNESS_BRIDGE_MARKER_START,
  HARNESS_MARKER_END,
  HARNESS_MARKER_START
};

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export function relativeToRepo(repoRoot: string, targetPath: string): string {
  const relativePath = path.relative(repoRoot, targetPath);
  return relativePath === "" ? "." : relativePath;
}

export function resolveFromRepo(repoRoot: string, configuredPath: string): string {
  return path.resolve(repoRoot, configuredPath);
}

export function hasMarkedBlock(content: string, startMarker: string, endMarker: string): boolean {
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    return false;
  }

  const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
  return endIndex !== -1;
}

export function getMarkedBlockContent(
  content: string,
  startMarker: string,
  endMarker: string
): string | null {
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    return null;
  }

  const blockStartIndex = startIndex + startMarker.length;
  const endIndex = content.indexOf(endMarker, blockStartIndex);
  if (endIndex === -1) {
    return null;
  }

  return content.slice(blockStartIndex, endIndex);
}

export function upsertMarkedBlock(
  existingContent: string,
  blockContent: string,
  startMarker: string,
  endMarker: string
): string {
  const normalizedBlock = blockContent.trimEnd();
  if (hasMarkedBlock(existingContent, startMarker, endMarker)) {
    const pattern = new RegExp(
      `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
      "u"
    );
    return `${existingContent.replace(pattern, normalizedBlock).trimEnd()}\n`;
  }

  const trimmedExisting = existingContent.trimEnd();
  if (trimmedExisting === "") {
    return `${normalizedBlock}\n`;
  }

  return `${trimmedExisting}\n\n${normalizedBlock}\n`;
}

async function readJson<T>(filePath: string): Promise<{ value?: T; error?: string }> {
  try {
    const content = await readFile(filePath, "utf8");
    return {
      value: JSON.parse(content) as T
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function validateConfigShape(config: unknown, configPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isRecord(config)) {
    return [
      {
        level: "error",
        path: configPath,
        message: "Expected a JSON object.",
        suggestion: "Re-run `claude-code-harness-kit init --force` to restore the default file."
      }
    ];
  }

  if (typeof config.version !== "number") {
    issues.push({
      level: "error",
      path: configPath,
      message: "Missing numeric `version` field."
    });
  }

  if (!isRecord(config.paths)) {
    issues.push({
      level: "error",
      path: configPath,
      message: "Missing object `paths` field."
    });
  } else {
    const requiredPaths = ["stateFile", "memoryFile", "decisionsFile", "contractsDir"] as const;
    for (const key of requiredPaths) {
      if (typeof config.paths[key] !== "string" || config.paths[key].trim() === "") {
        issues.push({
          level: "error",
          path: configPath,
          message: `Missing non-empty \`paths.${key}\` string.`
        });
      }
    }
  }

  if (!isRecord(config.commands)) {
    issues.push({
      level: "error",
      path: configPath,
      message: "Missing object `commands` field."
    });
  } else {
    const requiredCommands = ["verifyQuick", "verifyFull", "docsGenerate"] as const;
    for (const key of requiredCommands) {
      if (typeof config.commands[key] !== "string") {
        issues.push({
          level: "error",
          path: configPath,
          message: `Missing string \`commands.${key}\` field.`
        });
      }
    }

    if (
      typeof config.commands.verifyQuick === "string" &&
      typeof config.commands.verifyFull === "string" &&
      config.commands.verifyQuick.trim() === "" &&
      config.commands.verifyFull.trim() === ""
    ) {
      issues.push({
        level: "warning",
        path: configPath,
        message: "Verification commands are still blank.",
        suggestion: "Set `commands.verifyQuick` and optionally `commands.verifyFull` after initialization."
      });
    }
  }

  if (!isRecord(config.rules)) {
    issues.push({
      level: "error",
      path: configPath,
      message: "Missing object `rules` field."
    });
  } else if (
    typeof config.rules.maxRepeatedFailures !== "number" ||
    config.rules.maxRepeatedFailures < 1
  ) {
    issues.push({
      level: "error",
      path: configPath,
      message: "`rules.maxRepeatedFailures` must be a number greater than or equal to 1."
    });
  }

  return issues;
}

function validateStateShape(state: unknown, statePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isRecord(state)) {
    return [
      {
        level: "error",
        path: statePath,
        message: "Expected a JSON object.",
        suggestion: "Re-run `claude-code-harness-kit init --force` to restore the default state."
      }
    ];
  }

  const requiredStrings = [
    "currentGoal",
    "status",
    "currentContract",
    "nextStep",
    "lastUpdated"
  ] as const;
  for (const key of requiredStrings) {
    if (typeof state[key] !== "string") {
      issues.push({
        level: "error",
        path: statePath,
        message: `Missing string \`${key}\` field.`
      });
    }
  }

  if (!isStringArray(state.blockers)) {
    issues.push({
      level: "error",
      path: statePath,
      message: "`blockers` must be an array of strings."
    });
  }

  if (!isRecord(state.verification)) {
    issues.push({
      level: "error",
      path: statePath,
      message: "Missing object `verification` field."
    });
  } else {
    const verificationKeys = ["lastCommand", "lastResult", "notes"] as const;
    for (const key of verificationKeys) {
      if (typeof state.verification[key] !== "string") {
        issues.push({
          level: "error",
          path: statePath,
          message: `Missing string \`verification.${key}\` field.`
        });
      }
    }
  }

  if (typeof state.lastUpdated === "string" && Number.isNaN(Date.parse(state.lastUpdated))) {
    issues.push({
      level: "warning",
      path: statePath,
      message: "`lastUpdated` is not a valid ISO timestamp."
    });
  }

  return issues;
}

export async function validateHarness(repoRootInput: string): Promise<ValidationReport> {
  const repoRoot = path.resolve(repoRootInput);
  const issues: ValidationIssue[] = [];
  const claudePath = path.join(repoRoot, "CLAUDE.md");
  const harnessClaudePath = path.join(repoRoot, "CLAUDE.harness.md");
  const hasClaude = await pathExists(claudePath);
  const hasHarnessClaude = await pathExists(harnessClaudePath);

  if (!hasClaude && !hasHarnessClaude) {
    issues.push({
      level: "error",
      path: "CLAUDE.md",
      message: "Missing `CLAUDE.md`.",
      suggestion: "Run `claude-code-harness-kit init` in this repository."
    });
  } else if (!hasClaude && hasHarnessClaude) {
    issues.push({
      level: "error",
      path: "CLAUDE.md",
      message: "`CLAUDE.harness.md` exists, but `CLAUDE.md` is missing so the harness is not activated.",
      suggestion: "Create `CLAUDE.md` or rerun `claude-code-harness-kit init` so the activation bridge can be added."
    });
  } else {
    issues.push(...(await validateHarnessActivation(claudePath, harnessClaudePath, hasHarnessClaude)));
  }

  const configPath = path.join(repoRoot, DEFAULT_CONFIG_PATH);
  if (!(await pathExists(configPath))) {
    issues.push({
      level: "error",
      path: DEFAULT_CONFIG_PATH,
      message: "Missing harness config file.",
      suggestion: "Run `claude-code-harness-kit init` to generate the default harness files."
    });
    return {
      ok: false,
      repoRoot,
      claudeFile: hasClaude ? "CLAUDE.md" : hasHarnessClaude ? "CLAUDE.harness.md" : null,
      issues
    };
  }

  const configLoad = await readJson<HarnessConfig>(configPath);
  if (configLoad.error) {
    issues.push({
      level: "error",
      path: DEFAULT_CONFIG_PATH,
      message: `Invalid JSON: ${configLoad.error}`,
      suggestion: "Fix the JSON syntax or restore the file with `claude-code-harness-kit init --force`."
    });
    return {
      ok: false,
      repoRoot,
      claudeFile: hasClaude ? "CLAUDE.md" : hasHarnessClaude ? "CLAUDE.harness.md" : null,
      issues
    };
  }

  const config = configLoad.value;
  issues.push(...validateConfigShape(config, DEFAULT_CONFIG_PATH));
  if (!config || issues.some((issue) => issue.level === "error")) {
    return {
      ok: false,
      repoRoot,
      claudeFile: hasClaude ? "CLAUDE.md" : hasHarnessClaude ? "CLAUDE.harness.md" : null,
      issues,
      config
    };
  }

  const statePath = resolveFromRepo(repoRoot, config.paths.stateFile);
  const memoryPath = resolveFromRepo(repoRoot, config.paths.memoryFile);
  const decisionsPath = resolveFromRepo(repoRoot, config.paths.decisionsFile);
  const contractsDirPath = resolveFromRepo(repoRoot, config.paths.contractsDir);
  const contractsReadmePath = path.join(contractsDirPath, "README.md");

  if (!(await pathExists(statePath))) {
    issues.push({
      level: "error",
      path: config.paths.stateFile,
      message: "Missing state file."
    });
  }
  if (!(await pathExists(memoryPath))) {
    issues.push({
      level: "error",
      path: config.paths.memoryFile,
      message: "Missing project memory file."
    });
  }
  if (!(await pathExists(decisionsPath))) {
    issues.push({
      level: "error",
      path: config.paths.decisionsFile,
      message: "Missing decisions file."
    });
  }
  if (!(await pathExists(contractsDirPath))) {
    issues.push({
      level: "error",
      path: config.paths.contractsDir,
      message: "Missing contracts directory."
    });
  } else if (!(await pathExists(contractsReadmePath))) {
    issues.push({
      level: "error",
      path: path.join(config.paths.contractsDir, "README.md"),
      message: "Missing contracts README."
    });
  }

  let state: HarnessState | undefined;
  if (await pathExists(statePath)) {
    const stateLoad = await readJson<HarnessState>(statePath);
    if (stateLoad.error) {
      issues.push({
        level: "error",
        path: config.paths.stateFile,
        message: `Invalid JSON: ${stateLoad.error}`,
        suggestion: "Fix the JSON syntax or restore the file with `claude-code-harness-kit init --force`."
      });
    } else {
      const loadedState = stateLoad.value;
      if (loadedState === undefined) {
        issues.push({
          level: "error",
          path: config.paths.stateFile,
          message: "State file parsed but no data was returned."
        });
      } else {
        state = loadedState;
        issues.push(...validateStateShape(state, config.paths.stateFile));
        if (state.currentContract.trim() !== "") {
          const contractPath = resolveFromRepo(repoRoot, state.currentContract);
          if (!(await pathExists(contractPath))) {
            issues.push({
              level: "error",
              path: state.currentContract,
              message: "The active contract file does not exist."
            });
          }
        } else {
          issues.push({
            level: "warning",
            path: config.paths.stateFile,
            message: "No active contract is set in `currentContract`."
          });
        }
      }
    }
  }

  const ok = !issues.some((issue) => issue.level === "error");
  return {
    ok,
    repoRoot,
    claudeFile: hasClaude ? "CLAUDE.md" : hasHarnessClaude ? "CLAUDE.harness.md" : null,
    issues,
    config,
    state
  };
}

export function renderValidationReport(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push(`Harness validation for ${report.repoRoot}`);
  lines.push(report.ok ? "PASS" : "FAIL");

  if (report.issues.length === 0) {
    lines.push("- No issues found.");
    return lines.join("\n");
  }

  const errors = report.issues.filter((issue) => issue.level === "error");
  const warnings = report.issues.filter((issue) => issue.level === "warning");

  if (errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const issue of errors) {
      lines.push(formatIssue(issue));
    }
  }

  if (warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const issue of warnings) {
      lines.push(formatIssue(issue));
    }
  }

  return lines.join("\n");
}

function formatIssue(issue: ValidationIssue): string {
  const parts = [`- ${issue.path ? `${issue.path}: ` : ""}${issue.message}`];
  if (issue.suggestion) {
    parts.push(`  Suggestion: ${issue.suggestion}`);
  }
  return parts.join("\n");
}

export async function buildStateSummary(repoRootInput: string): Promise<string> {
  const report = await validateHarness(repoRootInput);
  if (!report.ok || !report.config || !report.state) {
    throw new Error(renderValidationReport(report));
  }

  const repoRoot = report.repoRoot;
  const { config, state } = report;
  const contractLabel = await describeContract(repoRoot, state.currentContract);
  const blockers = state.blockers.length > 0 ? state.blockers.map((item) => `  - ${item}`) : ["  - none"];
  const verificationCommand =
    state.verification.lastCommand.trim() === "" ? "(not recorded)" : state.verification.lastCommand;
  const verificationNotes =
    state.verification.notes.trim() === "" ? "(no notes)" : state.verification.notes;

  const lines = [
    `Harness state for ${repoRoot}`,
    `- Current goal: ${fallbackValue(state.currentGoal)}`,
    `- Current status: ${fallbackValue(state.status)}`,
    `- Current contract: ${contractLabel}`,
    "- Blockers:",
    ...blockers,
    `- Recent verification result: ${fallbackValue(state.verification.lastResult)}`,
    `- Recent verification command: ${verificationCommand}`,
    `- Recent verification notes: ${verificationNotes}`,
    `- Next step suggestion: ${buildNextStepSuggestion(config, state)}`,
    `- Last updated: ${fallbackValue(state.lastUpdated)}`
  ];

  return lines.join("\n");
}

async function describeContract(repoRoot: string, currentContract: string): Promise<string> {
  const contractPath = currentContract.trim();
  if (contractPath === "") {
    return "(not set)";
  }

  const absolutePath = resolveFromRepo(repoRoot, contractPath);
  if (!(await pathExists(absolutePath))) {
    return `${contractPath} (missing)`;
  }

  const content = await readFile(absolutePath, "utf8");
  const title = extractMarkdownTitle(content);
  return title ? `${contractPath} (${title})` : contractPath;
}

function extractMarkdownTitle(content: string): string | null {
  for (const line of content.split(/\r?\n/u)) {
    if (line.startsWith("# ")) {
      return line.slice(2).trim();
    }
  }
  return null;
}

function fallbackValue(value: string): string {
  return value.trim() === "" ? "(not set)" : value;
}

function buildNextStepSuggestion(config: HarnessConfig, state: HarnessState): string {
  if (state.blockers.length > 0) {
    return "Resolve the blockers or explicitly re-plan before more implementation work.";
  }

  if (state.currentGoal.trim() === "") {
    return `Set \`currentGoal\` in ${config.paths.stateFile} before continuing.`;
  }

  if (state.currentContract.trim() === "") {
    return "Point `currentContract` at the active contract before editing code.";
  }

  if (state.verification.lastResult.toLowerCase() === "failed") {
    return "Review the last failing verification before retrying more changes.";
  }

  if (config.commands.verifyQuick.trim() === "") {
    return "Configure `commands.verifyQuick` in docs/harness-config.json so minimal verification is explicit.";
  }

  if (state.nextStep.trim() !== "") {
    return state.nextStep;
  }

  return "Read the active contract, make the next scoped change, then record validation results.";
}

async function validateHarnessActivation(
  claudePath: string,
  harnessClaudePath: string,
  hasHarnessClaude: boolean
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const claudeContent = await readFile(claudePath, "utf8");
  const hasFullHarnessBlock = hasMarkedBlock(claudeContent, HARNESS_MARKER_START, HARNESS_MARKER_END);
  const hasBridgeBlock = hasMarkedBlock(
    claudeContent,
    HARNESS_BRIDGE_MARKER_START,
    HARNESS_BRIDGE_MARKER_END
  );

  if (hasFullHarnessBlock) {
    if (!hasValidFullHarnessContent(claudeContent)) {
      issues.push({
        level: "error",
        path: "CLAUDE.md",
        message:
          "`CLAUDE.md` contains claude-harness-kit markers, but the harness block is empty or missing required workflow instructions.",
        suggestion:
          "Re-run `claude-code-harness-kit init --force` or restore the harness-managed instructions inside the claude-harness-kit block."
      });
    }
    return issues;
  }

  if (!hasBridgeBlock) {
    issues.push({
      level: "error",
      path: "CLAUDE.md",
      message: hasHarnessClaude
        ? "`CLAUDE.harness.md` exists, but `CLAUDE.md` does not activate it with a claude-harness-kit bridge or merged harness block."
        : "`CLAUDE.md` exists, but claude-harness-kit is not activated in it.",
      suggestion:
        "Run `claude-code-harness-kit init` again, or merge the claude-harness-kit harness block into `CLAUDE.md`."
    });
    return issues;
  }

  if (!hasValidBridgeContent(claudeContent)) {
    issues.push({
      level: "error",
      path: "CLAUDE.md",
      message:
        "`CLAUDE.md` contains claude-harness-kit bridge markers, but the bridge block is empty or missing the activation instructions.",
      suggestion:
        "Re-run `claude-code-harness-kit init` or restore the bridge text that points `CLAUDE.md` to `CLAUDE.harness.md`."
    });
    return issues;
  }

  if (!hasHarnessClaude) {
    issues.push({
      level: "error",
      path: "CLAUDE.harness.md",
      message: "`CLAUDE.md` contains the claude-harness-kit bridge, but the harness supplement file is missing.",
      suggestion: "Run `claude-code-harness-kit init` again to recreate `CLAUDE.harness.md`."
    });
    return issues;
  }

  const harnessClaudeContent = await readFile(harnessClaudePath, "utf8");
  if (!hasMarkedBlock(harnessClaudeContent, HARNESS_MARKER_START, HARNESS_MARKER_END)) {
    issues.push({
      level: "error",
      path: "CLAUDE.harness.md",
      message: "`CLAUDE.harness.md` exists, but it does not contain the claude-harness-kit harness block.",
      suggestion:
        "Re-run `claude-code-harness-kit init --force` or restore the harness-managed block in `CLAUDE.harness.md`."
    });
  } else if (!hasValidHarnessSupplementContent(harnessClaudeContent)) {
    issues.push({
      level: "error",
      path: "CLAUDE.harness.md",
      message:
        "`CLAUDE.harness.md` contains claude-harness-kit markers, but the harness block is empty or missing required workflow instructions.",
      suggestion:
        "Re-run `claude-code-harness-kit init --force` or restore the harness-managed instructions inside `CLAUDE.harness.md`."
    });
  }

  return issues;
}

function hasValidBridgeContent(claudeContent: string): boolean {
  return hasRequiredSnippets(
    getMarkedBlockContent(claudeContent, HARNESS_BRIDGE_MARKER_START, HARNESS_BRIDGE_MARKER_END),
    ["claude-code-harness-kit", "CLAUDE.harness.md", "paths"]
  );
}

function hasValidFullHarnessContent(claudeContent: string): boolean {
  return hasRequiredSnippets(
    getMarkedBlockContent(claudeContent, HARNESS_MARKER_START, HARNESS_MARKER_END),
    ["currentContract", "paths.stateFile", "Final responses"]
  );
}

function hasValidHarnessSupplementContent(harnessClaudeContent: string): boolean {
  return hasRequiredSnippets(
    getMarkedBlockContent(harnessClaudeContent, HARNESS_MARKER_START, HARNESS_MARKER_END),
    ["currentContract", "paths.stateFile", "Final responses"]
  );
}

function hasRequiredSnippets(content: string | null, requiredSnippets: string[]): boolean {
  if (content === null) {
    return false;
  }

  const normalizedContent = content.trim();
  if (normalizedContent === "") {
    return false;
  }

  return requiredSnippets.every((snippet) => normalizedContent.includes(snippet));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
