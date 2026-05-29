import { renderValidationReport, validateHarness } from "../harness.js";

export async function runValidateHarness(
  repoRoot: string
): Promise<{ ok: boolean; output: string }> {
  const report = await validateHarness(repoRoot);
  return {
    ok: report.ok,
    output: renderValidationReport(report)
  };
}
