import { buildStateSummary, renderValidationReport, validateHarness } from "../harness.js";

export async function runCheckState(repoRoot: string): Promise<{ ok: boolean; output: string }> {
  const report = await validateHarness(repoRoot);
  if (!report.ok) {
    return {
      ok: false,
      output: `${renderValidationReport(report)}\n\nFix the errors above, then rerun \`claude-code-harness-kit check-state\`.`
    };
  }

  return {
    ok: true,
    output: await buildStateSummary(repoRoot)
  };
}
