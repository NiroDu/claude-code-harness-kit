import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createDefaultConfig,
  createDefaultState,
  renderClaudeActivationBridge,
  renderClaudeHarnessSupplement,
  renderClaudeTemplate,
  renderContractsReadmeTemplate,
  renderDecisionsTemplate,
  renderExampleContractTemplate,
  renderJsonFile,
  renderProjectMemoryTemplate
} from "../templates.js";
import {
  ensureParentDirectory,
  hasMarkedBlock,
  pathExists,
  relativeToRepo,
  upsertMarkedBlock
} from "../harness.js";
import type { FileAction, InitResult } from "../types.js";
import {
  HARNESS_BRIDGE_MARKER_END,
  HARNESS_BRIDGE_MARKER_START,
  HARNESS_MARKER_END,
  HARNESS_MARKER_START
} from "../templates.js";

export interface InitOptions {
  targetPath?: string;
  force?: boolean;
}

export async function initializeHarness(options: InitOptions = {}): Promise<InitResult> {
  const repoRoot = path.resolve(options.targetPath ?? process.cwd());
  await mkdir(repoRoot, { recursive: true });

  const actions: FileAction[] = [];
  const notes: string[] = [];
  const force = options.force ?? false;

  const templates = new Map<string, string>([
    ["docs/harness-config.json", renderJsonFile(createDefaultConfig())],
    ["docs/harness-state.json", renderJsonFile(createDefaultState())],
    ["docs/project-memory.md", renderProjectMemoryTemplate()],
    ["docs/decisions.md", renderDecisionsTemplate()],
    ["docs/contracts/README.md", renderContractsReadmeTemplate()],
    ["docs/contracts/example-contract.md", renderExampleContractTemplate()]
  ]);

  const claudeResult = await writeClaudeFiles(repoRoot);
  actions.push(...claudeResult.actions);
  notes.push(...claudeResult.notes);

  for (const [relativePath, content] of templates) {
    const absolutePath = path.join(repoRoot, relativePath);
    actions.push(await writeTextFileSafely(repoRoot, absolutePath, content, force));
  }

  return {
    repoRoot,
    actions,
    notes
  };
}

async function writeClaudeFiles(repoRoot: string): Promise<{ actions: FileAction[]; notes: string[] }> {
  const claudePath = path.join(repoRoot, "CLAUDE.md");
  const harnessClaudePath = path.join(repoRoot, "CLAUDE.harness.md");
  const fullClaudeContent = renderClaudeTemplate();
  const bridgeContent = renderClaudeActivationBridge();
  const supplementContent = renderClaudeHarnessSupplement();
  const actions: FileAction[] = [];

  if (!(await pathExists(claudePath))) {
    actions.push(await writeManagedFile(repoRoot, claudePath, fullClaudeContent));
    return { actions, notes: [] };
  }

  const existingClaude = await readFile(claudePath, "utf8");
  if (hasMarkedBlock(existingClaude, HARNESS_MARKER_START, HARNESS_MARKER_END)) {
    const nextClaudeContent = upsertMarkedBlock(
      existingClaude,
      fullClaudeContent,
      HARNESS_MARKER_START,
      HARNESS_MARKER_END
    );
    actions.push(await writeManagedFile(repoRoot, claudePath, nextClaudeContent));
    return { actions, notes: [] };
  }

  const nextClaudeContent = upsertMarkedBlock(
    existingClaude,
    bridgeContent,
    HARNESS_BRIDGE_MARKER_START,
    HARNESS_BRIDGE_MARKER_END
  );
  actions.push(await writeManagedFile(repoRoot, claudePath, nextClaudeContent));
  actions.push(await writeManagedMarkedFile(repoRoot, harnessClaudePath, supplementContent));
  const notes = [
    "Existing CLAUDE.md was preserved and a claude-harness-kit activation bridge was added. Detailed harness rules live in CLAUDE.harness.md."
  ];
  return { actions, notes };
}

async function writeTextFileSafely(
  repoRoot: string,
  absolutePath: string,
  content: string,
  force: boolean
): Promise<FileAction> {
  const relativePath = relativeToRepo(repoRoot, absolutePath);
  if (!(await pathExists(absolutePath))) {
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, content, "utf8");
    return {
      file: relativePath,
      status: "created"
    };
  }

  const existing = await readFile(absolutePath, "utf8");
  if (existing === content) {
    return {
      file: relativePath,
      status: "unchanged"
    };
  }

  if (!force) {
    return {
      file: relativePath,
      status: "skipped",
      reason: "File already exists. Re-run with --force to overwrite the harness-managed version."
    };
  }

  await ensureParentDirectory(absolutePath);
  await writeFile(absolutePath, content, "utf8");
  return {
    file: relativePath,
    status: "updated",
    reason: "Overwritten because --force was provided."
  };
}

async function writeManagedMarkedFile(
  repoRoot: string,
  absolutePath: string,
  blockContent: string
): Promise<FileAction> {
  if (!(await pathExists(absolutePath))) {
    return writeManagedFile(repoRoot, absolutePath, blockContent);
  }

  const existingContent = await readFile(absolutePath, "utf8");
  const nextContent = upsertMarkedBlock(
    existingContent,
    blockContent,
    HARNESS_MARKER_START,
    HARNESS_MARKER_END
  );
  return writeManagedFile(repoRoot, absolutePath, nextContent);
}

async function writeManagedFile(
  repoRoot: string,
  absolutePath: string,
  content: string
): Promise<FileAction> {
  const relativePath = relativeToRepo(repoRoot, absolutePath);
  if (!(await pathExists(absolutePath))) {
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, content, "utf8");
    return {
      file: relativePath,
      status: "created"
    };
  }

  const existing = await readFile(absolutePath, "utf8");
  if (existing === content) {
    return {
      file: relativePath,
      status: "unchanged"
    };
  }

  await ensureParentDirectory(absolutePath);
  await writeFile(absolutePath, content, "utf8");
  return {
    file: relativePath,
    status: "updated"
  };
}

export function renderInitResult(result: InitResult): string {
  const lines: string[] = [];
  lines.push(`Initialized claude-code-harness-kit in ${result.repoRoot}`);
  for (const action of result.actions) {
    const suffix = action.reason ? ` (${action.reason})` : "";
    lines.push(`- ${action.status}: ${action.file}${suffix}`);
  }

  if (result.notes.length > 0) {
    lines.push("");
    lines.push("Notes:");
    for (const note of result.notes) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join("\n");
}
