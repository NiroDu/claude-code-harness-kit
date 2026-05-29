export interface HarnessConfig {
  version: number;
  paths: {
    stateFile: string;
    memoryFile: string;
    decisionsFile: string;
    contractsDir: string;
  };
  commands: {
    verifyQuick: string;
    verifyFull: string;
    docsGenerate: string;
  };
  rules: {
    maxRepeatedFailures: number;
  };
}

export interface HarnessState {
  currentGoal: string;
  status: string;
  currentContract: string;
  blockers: string[];
  nextStep: string;
  lastUpdated: string;
  verification: {
    lastCommand: string;
    lastResult: string;
    notes: string;
  };
}

export interface ValidationIssue {
  level: "error" | "warning";
  path?: string;
  message: string;
  suggestion?: string;
}

export interface ValidationReport {
  ok: boolean;
  repoRoot: string;
  claudeFile: string | null;
  issues: ValidationIssue[];
  config?: HarnessConfig;
  state?: HarnessState;
}

export interface FileAction {
  file: string;
  status: "created" | "updated" | "unchanged" | "skipped";
  reason?: string;
}

export interface InitResult {
  repoRoot: string;
  actions: FileAction[];
  notes: string[];
}
