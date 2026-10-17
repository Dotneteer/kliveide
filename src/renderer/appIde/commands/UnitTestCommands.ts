import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { UnitTestDebugInfo } from "@abstractions/CodeToInject";
import type { UnitTestCase } from "@common/unit-tests/discovery";

import { discoverUnitTests } from "@common/unit-tests/discovery";
import { junitOfLastRun } from "@renderer/appIde/unit-tests/unitTestJUnit";
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
import { t } from "@common/i18n/i18n";

/*
 * The unit-test commands (`.plans/Z80_UNIT_TESTS_PLAN.md` D16): `test-list`, `test-run [<pattern>]
 * [-failed] [-coverage]`, `test-debug <test>`, `test-init` and `test-junit <file>`
 * (`.plans/UNIT_TESTS_CLI_PLAN.md` D14). Patterns match `Suite.UT_name` with `*`. KSX scripts reach
 * them through `executeCommand`.
 */

/** `test-list`: the tests of the last build, by suite */
export class TestListCommand extends IdeCommandBase {
  readonly id = "test-list";
  get description() {
    return t("commands.unitTest.list.description");
  }
  readonly usage = "test-list";
  readonly aliases = ["tl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const problem = buildRootTestProblem(context);
    if (problem) return commandError(problem);
    const program = currentUnitTests(context);
    if (!program) return commandError(t("commands.unitTest.buildFirst"));
    for (const p of program.problems) writeMessage(context.output, p, "yellow");
    for (const note of program.notes) writeMessage(context.output, note, "cyan");
    let suite: string | undefined;
    for (const test of program.tests) {
      const name = test.suitePath.join(".") || t("commands.unitTest.rootSuite");
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
    return commandSuccessWith(t("commands.unitTest.count", { count: program.tests.length }));
  }
}

type TestRunArgs = { pattern?: string; "-failed"?: boolean; "-coverage"?: boolean };

/** `test-run [<pattern>] [-failed] [-coverage]` */
export class TestRunCommand extends IdeCommandBase<TestRunArgs> {
  readonly id = "test-run";
  get description() {
    return t("commands.unitTest.run.description");
  }
  get usage(): string[] {
    return [
      "test-run [<pattern>] [-failed] [-coverage]",
      t("commands.usage.testRun.pattern"),
      t("commands.usage.testRun.failed"),
      t("commands.usage.testRun.coverage")
    ];
  }
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
        writeSuccessMessage(context.output, t("commands.unitTest.noFailed"));
        return commandSuccess;
      }
    }
    const { response, message } = await buildAndRunUnitTests(context, {
      ...(args.pattern ? { include: [args.pattern] } : {}),
      ...(ids ? { ids } : {}),
      ...(args["-coverage"] ? { coverage: true } : {})
    });
    if (message) return commandError(message);
    if (!response) return commandError(t("commands.unitTest.didNotRun"));
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
  get description() {
    return t("commands.unitTest.debug.description");
  }
  get usage(): string[] {
    return ["test-debug <test>", t("commands.usage.testDebug.test")];
  }
  readonly aliases = ["td"];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "test", type: "string" }]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: TestDebugArgs): Promise<ValidationMessage[]> {
    return args.test?.trim() ? [] : [validationError(t("commands.unitTest.nameTest"))];
  }

  async execute(context: IdeCommandContext, args: TestDebugArgs): Promise<IdeCommandResult> {
    const problem = buildRootTestProblem(context);
    if (problem) return commandError(problem);
    const stopAtStart = (await readStopAtStart(context)) ?? true;
    const machineId = context.store.getState().emulatorState?.machineId;
    return injectCode(context, "debug", (result) => {
      const program = discoverUnitTests(result as never, machineId);
      if (!program.labels) return program.problems[0] ?? t("commands.unitTest.noFrame");
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
  const exact = tests.find((test) => test.id === name);
  if (exact) return exact;
  const matches = tests.filter((test) => testIdMatches(test.id, name) || test.label === name);
  if (matches.length === 1) return matches[0];
  if (!matches.length) return t("commands.unitTest.noSuchTest", { name });
  const ids = `${matches
    .slice(0, 3)
    .map((m) => m.id)
    .join(", ")}${matches.length > 3 ? ", ..." : ""}`;
  return t("commands.unitTest.ambiguous", { name, count: matches.length, ids });
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
  get description() {
    return t("commands.unitTest.init.description");
  }
  readonly usage = "test-init";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const state = context.store.getState();
    if (!state.project?.isKliveProject) return commandError(t("commands.unitTest.openProject"));
    const buildRoot = state.project.buildRoots?.[0];
    if (!buildRoot) return commandError(t("commands.unitTest.selectBuildRoot"));
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
      result.created ? t("commands.unitTest.wroteInclude", { file }) : t("commands.unitTest.keptInclude", { file })
    );
    if (result.includeAdded) {
      writeSuccessMessage(context.output, t("commands.unitTest.addedInclude", { file, buildRoot }));
    }
    if (result.sldoptAdded) writeSuccessMessage(context.output, t("commands.unitTest.addedSldopt", { buildRoot }));
    writeInfoMessage(
      context.output,
      language === "kz80-asm"
        ? t("commands.unitTest.nextKz80")
        : t("commands.unitTest.nextSjasm")
    );
    return commandSuccess;
  }
}

type TestJUnitArgs = { file: string; "-notimestamp"?: boolean };

/** `test-junit <file> [-notimestamp]`: the Test panel's "Export results as JUnit…" (D14) */
export class TestJUnitCommand extends IdeCommandBase<TestJUnitArgs> {
  readonly id = "test-junit";
  get description() {
    return t("commands.unitTest.junit.description");
  }
  get usage(): string[] {
    return ["test-junit <file> [-notimestamp]", t("commands.usage.testJunit.file"), t("commands.usage.testJunit.noTimestamp")];
  }
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    commandOptions: ["-notimestamp"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: TestJUnitArgs): Promise<ValidationMessage[]> {
    return args.file?.trim() ? [] : [validationError(t("commands.unitTest.nameFile"))];
  }

  async execute(context: IdeCommandContext, args: TestJUnitArgs): Promise<IdeCommandResult> {
    const xml = junitOfLastRun(context.store.getState(), currentUnitTests(context), !args["-notimestamp"]);
    if (!xml.startsWith("<?xml")) return commandError(xml);
    let written: string;
    try {
      written = await context.mainApi.saveTextFile(args.file.trim(), xml);
    } catch (err) {
      return commandError(
        t("commands.unitTest.writeFailed", { file: args.file, error: err instanceof Error ? err.message : String(err) })
      );
    }
    writeSuccessMessage(context.output, t("commands.unitTest.exported", { file: written || args.file }));
    return commandSuccess;
  }
}
