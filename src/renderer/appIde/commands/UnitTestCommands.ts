import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { UnitTestDebugInfo } from "@abstractions/CodeToInject";
import type { UnitTestCase } from "@common/unit-tests/discovery";

import { discoverUnitTests } from "@common/unit-tests/discovery";
import { testIdMatches } from "@common/unit-tests/unitTestTypes";
import { PROJECT_FILE } from "@common/structs/project-const";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import { outputNavigateAction } from "@common/utils/output-utils";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  commandSuccessWith,
  toHexa4,
  validationError,
  writeInfoMessage,
  writeMessage,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";
import { injectCode } from "./KliveCompilerCommands";
import {
  buildAndRunUnitTests,
  buildRootTestProblem,
  currentUnitTests
} from "@renderer/appIde/unit-tests/unitTestRun";
import { summaryText } from "@renderer/appIde/unit-tests/unitTestTree";

/*
 * The unit-test commands (`.plans/Z80_UNIT_TESTS_PLAN.md` D16): `test-list`, `test-run [<pattern>]
 * [-failed] [-coverage]`, `test-debug <test>` and `test-init`. Patterns match `Suite.UT_name` with
 * `*`. KSX scripts reach them through `executeCommand`.
 */

/** `test-list`: the tests of the last build, by suite */
export class TestListCommand extends IdeCommandBase {
  readonly id = "test-list";
  readonly description = "Lists the unit tests of the last build";
  readonly usage = "test-list";
  readonly aliases = ["tl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const problem = buildRootTestProblem(context);
    if (problem) return commandError(problem);
    const program = currentUnitTests(context);
    if (!program) return commandError("Build the project first: the tests come from the last successful build.");
    for (const p of program.problems) writeMessage(context.output, p, "yellow");
    for (const note of program.notes) writeMessage(context.output, note, "cyan");
    let suite: string | undefined;
    for (const test of program.tests) {
      const name = test.suitePath.join(".") || "(root)";
      if (name !== suite) {
        suite = name;
        writeMessage(context.output, name, "bright-blue");
      }
      context.output.write(`  ${test.label}  $${toHexa4(test.address)}  `);
      if (test.file) {
        context.output.color("bright-cyan");
        outputNavigateAction(context.output, test.file, test.line, 0);
        context.output.resetStyle();
      }
      context.output.writeLine();
    }
    return commandSuccessWith(`${program.tests.length} unit test${program.tests.length === 1 ? "" : "s"}`);
  }
}

type TestRunArgs = { pattern?: string; "-failed"?: boolean; "-coverage"?: boolean };

/** `test-run [<pattern>] [-failed] [-coverage]` */
export class TestRunCommand extends IdeCommandBase<TestRunArgs> {
  readonly id = "test-run";
  readonly description = "Builds the project and runs its unit tests";
  readonly usage = [
    "test-run [<pattern>] [-failed] [-coverage]",
    "pattern: Suite.UT_name, with * as a wildcard (all tests when omitted)",
    "-failed: only the tests that failed or ended in an error last time",
    "-coverage: merge the tests' code coverage into the editor's coverage view"
  ];
  readonly aliases = ["tr"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "pattern", type: "string" }],
    commandOptions: ["-failed", "-coverage"]
  };

  async execute(context: IdeCommandContext, args: TestRunArgs): Promise<IdeCommandResult> {
    let ids: string[] | undefined;
    if (args["-failed"]) {
      const results = context.store.getState().unitTests?.results ?? {};
      ids = Object.values(results)
        .filter((r) => r.status !== "passed")
        .map((r) => r.id);
      if (!ids.length) {
        writeSuccessMessage(context.output, "No failed tests to run again.");
        return commandSuccess;
      }
    }
    const { response, message } = await buildAndRunUnitTests(context, {
      ...(args.pattern ? { include: [args.pattern] } : {}),
      ...(ids ? { ids } : {}),
      ...(args["-coverage"] ? { coverage: true } : {})
    });
    if (message) return commandError(message);
    if (!response) return commandError("The tests did not run.");
    if (response.problems.length && !response.summary.total) return commandError(response.problems[0]);
    return response.summary.failed || response.summary.errors
      ? commandError(summaryText(response.summary))
      : commandSuccessWith(summaryText(response.summary));
  }
}

type TestDebugArgs = { test: string };

/** `test-debug <test>`: runs one test in the emulator under the debugger (D12) */
export class TestDebugCommand extends IdeCommandBase<TestDebugArgs> {
  readonly id = "test-debug";
  readonly description = "Debugs one unit test in the emulator";
  readonly usage = ["test-debug <test>", "test: Suite.UT_name, or a * pattern that names one test"];
  readonly aliases = ["td"];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "test", type: "string" }]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: TestDebugArgs): Promise<ValidationMessage[]> {
    return args.test?.trim() ? [] : [validationError("Name the test to debug")];
  }

  async execute(context: IdeCommandContext, args: TestDebugArgs): Promise<IdeCommandResult> {
    const problem = buildRootTestProblem(context);
    if (problem) return commandError(problem);
    const stopAtStart = (await readStopAtStart(context)) ?? true;
    const machineId = context.store.getState().emulatorState?.machineId;
    return injectCode(context, "debug", (result) => {
      const program = discoverUnitTests(result as never, machineId);
      if (!program.labels) return program.problems[0] ?? "The build has no unit-test frame.";
      const test = findTest(program.tests, args.test.trim());
      if (typeof test === "string") return test;
      const info: UnitTestDebugInfo = {
        id: test.id,
        testAddress: test.address,
        ...(test.partition !== undefined ? { testPartition: test.partition } : {}),
        labels: program.labels,
        stopAtStart
      };
      return info;
    });
  }
}

/** One test by id, or by a pattern that matches exactly one */
export function findTest(tests: UnitTestCase[], name: string): UnitTestCase | string {
  const exact = tests.find((t) => t.id === name);
  if (exact) return exact;
  const matches = tests.filter((t) => testIdMatches(t.id, name) || t.label === name);
  if (matches.length === 1) return matches[0];
  if (!matches.length) return `No unit test named '${name}'. List them with test-list.`;
  return `'${name}' names ${matches.length} tests (${matches
    .slice(0, 3)
    .map((t) => t.id)
    .join(", ")}${matches.length > 3 ? ", ..." : ""}); name one.`;
}

/** `unitTests.stopAtStart` of `klive.project` (D19), when set */
async function readStopAtStart(context: IdeCommandContext): Promise<boolean | undefined> {
  const folder = context.store.getState().project?.folderPath;
  if (!folder) return undefined;
  try {
    const project = JSON.parse(await context.mainApi.readTextFile(`${folder}/${PROJECT_FILE}`));
    const value = project?.unitTests?.stopAtStart;
    return typeof value === "boolean" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** `test-init`: Testing → Add unit-test support (D4, D5) */
export class TestInitCommand extends IdeCommandBase {
  readonly id = "test-init";
  readonly description = "Adds Klive's unit-test include to the project and the build root";
  readonly usage = "test-init";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const state = context.store.getState();
    if (!state.project?.isKliveProject) return commandError("Open a Klive project first.");
    const buildRoot = state.project.buildRoots?.[0];
    if (!buildRoot) return commandError("Select a build root first.");
    const fullPath = `${state.project.folderPath}/${buildRoot}`;
    const language = getFileTypeEntry(fullPath, context.store)?.subType ?? "";
    await context.service.projectService.performAllDelayedSavesNow?.();
    let result;
    try {
      result = await context.mainApi.addUnitTestSupport(fullPath, language);
    } catch (err) {
      return commandError(err instanceof Error ? err.message : String(err));
    }
    const file = result.includeFile.split(/[\\/]/).pop();
    writeSuccessMessage(
      context.output,
      result.created ? `Wrote ${file} next to the build root.` : `The project has ${file} already; it is kept as it is.`
    );
    if (result.includeAdded) writeSuccessMessage(context.output, `Added the include line of ${file} to ${buildRoot}.`);
    if (result.sldoptAdded) writeSuccessMessage(context.output, `Added the SLDOPT COMMENT line to ${buildRoot}.`);
    writeInfoMessage(
      context.output,
      language === "kz80-asm"
        ? "Next: invoke UNITTEST_INITIALIZE() once, follow it with your init code ending in RET, and write UT_ tests that end with TC_END()."
        : "Next: invoke UNITTEST_INITIALIZE once, follow it with your init code ending in RET, and write UT_ tests that end with TC_END."
    );
    return commandSuccess;
  }
}
