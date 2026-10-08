import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IOutputBuffer } from "@renderer/appIde/ToolArea/abstractions";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type {
  UnitTestResult,
  UnitTestRunOptions,
  UnitTestRunResponse,
  UnitTestSummary
} from "@common/unit-tests/unitTestTypes";
export { summaryText } from "./unitTestTree";

import { compileCode } from "@renderer/appIde/utils/compile-code";
import { outputNavigateAction } from "@common/utils/output-utils";
import { PANE_ID_TESTS } from "@common/integration/constants";
import { isAdvancedDebuggingEnabled } from "@common/features/advancedDebugging";
import { discoverUnitTests, type UnitTestProgram } from "@common/unit-tests/discovery";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import { summaryText } from "./unitTestTree";

/*
 * The IDE's side of a unit-test run (`.plans/Z80_UNIT_TESTS_PLAN.md` D13-D17): build first (D15),
 * run in the main process's worker, report to an output buffer - the Tests pane - with
 * click-to-source links. The Unit Tests panel and the `test-*` commands share it.
 */

/** The languages whose builds hold DeZog-style tests (D14) */
const TEST_LANGUAGES = ["kz80-asm", "sjasmp"];

/** Why the build root cannot hold tests, or `undefined` when it can (D14) */
export function buildRootTestProblem(context: Pick<IdeCommandContext, "store">): string | undefined {
  const state = context.store.getState();
  if (!state.project?.isKliveProject) return "Open a Klive project to run its unit tests.";
  const buildRoot = state.project.buildRoots?.[0];
  if (!buildRoot) return "Select a build root: the tests come from the build root's compilation.";
  const language = getFileTypeEntry(`${state.project.folderPath}/${buildRoot}`, context.store)?.subType;
  if (!language || !TEST_LANGUAGES.includes(language)) {
    return "The build root's language has no DeZog-style unit tests; they need the Klive Z80 assembler or sjasmplus.";
  }
  return undefined;
}

/** The tests of the build the IDE holds now (D14); `undefined` without a successful build */
export function currentUnitTests(
  context: Pick<IdeCommandContext, "store">
): UnitTestProgram | undefined {
  const state = context.store.getState();
  const compilation = state.compilation;
  const result = compilation?.result as KliveCompilerOutput | undefined;
  if (!result || compilation?.failed || result.errors?.some((e) => !e.isWarning)) return undefined;
  return discoverUnitTests(result as never, state.emulatorState?.machineId);
}

/**
 * Builds the project and runs its tests
 * @param context The command context; `output` receives the build's and the run's report
 * @param options Which tests, and how
 * @returns The run, or a message saying why it did not happen
 */
export async function buildAndRunUnitTests(
  context: IdeCommandContext,
  options: UnitTestRunOptions
): Promise<{ response?: UnitTestRunResponse; message?: string }> {
  const problem = buildRootTestProblem(context);
  if (problem) return { message: problem };
  // --- The report goes to the Tests pane (D16), whoever started the run; a run started at the prompt
  // --- gets the summary there as well. Each run starts the pane afresh.
  const testsPane = context.service.outputPaneService?.getOutputPaneBuffer(PANE_ID_TESTS);
  testsPane?.clear();
  const build = await compileCode(context);
  if (build.message) return { message: build.message };

  const out = testsPane ?? context.output;
  out.color("bright-blue");
  out.writeLine(`Running unit tests (${new Date().toLocaleTimeString()})...`);
  out.resetStyle();
  const response = await context.mainApi.runUnitTests({ options });
  writeRunReport(out, response);
  if (testsPane && testsPane !== context.output) {
    for (const problem of response.problems) {
      context.output.color("bright-red");
      context.output.writeLine(problem);
      context.output.resetStyle();
    }
    if (response.summary.total) {
      context.output.writeLine(`${summaryText(response.summary)} (details in the Tests pane: outp tests)`);
    }
  }

  // --- Run with coverage (D17): the tests' merged profile goes into the emulator's coverage
  if (response.coverage) {
    const merged = await mergeCoverage(context, response);
    out.color(merged ? "cyan" : "yellow");
    out.writeLine(
      merged
        ? "The tests' coverage is in the editor and the memory views (coverage status, coverage export)."
        : isAdvancedDebuggingEnabled(context.store.getState())
          ? "The tests' coverage could not be shown: the emulator runs another machine, or has no coverage."
          : "The tests' coverage is shown with advanced debugging on (set -u features.advancedDebugging 1, then restart Klive)."
    );
    out.resetStyle();
  }
  return { response };
}

async function mergeCoverage(context: IdeCommandContext, response: UnitTestRunResponse): Promise<boolean> {
  const coverage = response.coverage!;
  // --- Coverage is shown only with advanced debugging on (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`)
  if (!isAdvancedDebuggingEnabled(context.store.getState())) return false;
  if (context.store.getState().emulatorState?.machineId !== response.machineId) return false;
  try {
    const status = await context.emuApi.getProfileStatus();
    if (!status || status.machineId !== coverage.profileMachineId) return false;
    await context.emuApi.resetProfile();
    await context.emuApi.setProfiling(true);
    const merged = await context.emuApi.mergeProfile(coverage.bytes, {
      instructions: coverage.instructions,
      timeTotal: coverage.timeTotal
    });
    return !!merged;
  } catch {
    return false;
  }
}

/** One line per test, then the summary; failures link to their line */
export function writeRunReport(out: IOutputBuffer, response: UnitTestRunResponse): void {
  for (const problem of response.problems) {
    out.severity("error");
    out.color("bright-red");
    out.writeLine(problem);
    out.resetStyle();
  }
  for (const result of response.results) writeResultLine(out, result);
  if (response.summary.total || response.results.length) writeSummary(out, response.summary);
}

/** A test's line: `✓ Suite.UT_x  1,234 T`, or the failure with its link */
export function writeResultLine(out: IOutputBuffer, result: UnitTestResult): void {
  const tstates = `${result.tstates.toLocaleString("en-US")} T`;
  switch (result.status) {
    case "passed":
      out.color("green");
      out.write("PASS  ");
      out.resetStyle();
      out.writeLine(`${result.id}  (${tstates})`);
      break;
    case "failed":
    case "error": {
      const failed = result.status === "failed";
      out.severity(failed ? "error" : "warning");
      out.color(failed ? "bright-red" : "yellow");
      out.bold(true);
      out.write(failed ? "FAIL  " : "ERROR ");
      out.bold(false);
      out.write(`${result.id}  (${tstates}): `);
      out.writeLine(result.message ?? "");
      if (result.location) {
        out.color("bright-cyan");
        out.write("      ");
        outputNavigateAction(out, result.location.file, result.location.line, 0);
        out.writeLine();
      }
      out.resetStyle();
      break;
    }
  }
  for (const line of result.log ?? []) {
    out.color("cyan");
    out.writeLine(`      ${line}`);
    out.resetStyle();
  }
}

function writeSummary(out: IOutputBuffer, summary: UnitTestSummary): void {
  const ok = !summary.failed && !summary.errors && !summary.cancelled;
  out.color(ok ? "green" : "bright-red");
  out.bold(true);
  out.writeLine(summaryText(summary));
  out.resetStyle();
}
