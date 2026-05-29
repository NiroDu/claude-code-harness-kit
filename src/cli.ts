#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { initializeHarness, renderInitResult } from "./commands/init.js";
import { runCheckState } from "./commands/check-state.js";
import { runValidateHarness } from "./commands/validate-harness.js";

interface ParsedArgs {
  positionals: string[];
  flags: Set<string>;
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${renderHelp()}\n`);
    return 0;
  }

  const parsed = parseArgs(rest);
  const targetPath = parsed.positionals[0];

  switch (command) {
    case "init": {
      const result = await initializeHarness({
        targetPath,
        force: parsed.flags.has("force")
      });
      process.stdout.write(`${renderInitResult(result)}\n`);
      return 0;
    }
    case "check-state": {
      const result = await runCheckState(targetPath ?? process.cwd());
      const stream = result.ok ? process.stdout : process.stderr;
      stream.write(`${result.output}\n`);
      return result.ok ? 0 : 1;
    }
    case "validate-harness": {
      const result = await runValidateHarness(targetPath ?? process.cwd());
      const stream = result.ok ? process.stdout : process.stderr;
      stream.write(`${result.output}\n`);
      return result.ok ? 0 : 1;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${renderHelp()}\n`);
      return 1;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Set<string>();

  for (const arg of argv) {
    if (arg.startsWith("--")) {
      flags.add(arg.slice(2));
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

function renderHelp(): string {
  return `claude-code-harness-kit

Usage:
  claude-code-harness-kit init [path] [--force]
  claude-code-harness-kit check-state [path]
  claude-code-harness-kit validate-harness [path]

Commands:
  init              Generate the minimal harness files for a repository.
  check-state       Read the harness files and print a concise status summary.
  validate-harness  Validate required harness files and JSON structure.`;
}

const isDirectExecution = isExecutedDirectly();

if (isDirectExecution) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}

function isExecutedDirectly(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}
