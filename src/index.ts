export { initializeHarness, renderInitResult } from "./commands/init.js";
export { runCheckState } from "./commands/check-state.js";
export { runValidateHarness } from "./commands/validate-harness.js";
export { buildStateSummary, renderValidationReport, validateHarness } from "./harness.js";
export type {
  FileAction,
  HarnessConfig,
  HarnessState,
  InitResult,
  ValidationIssue,
  ValidationReport
} from "./types.js";
