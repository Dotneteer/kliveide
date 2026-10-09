import type { UnitTestCase } from "@common/unit-tests/discovery";
import type { UnitTestCoverage, UnitTestEvent, UnitTestRunOptions } from "@common/unit-tests/unitTestTypes";
import { MI_ZXNEXT } from "@common/machines/constants";
import { discoverUnitTests } from "@common/unit-tests/discovery";
import { projectRelative, toJUnitXml, type JUnitResult } from "@common/unit-tests/junit";
import { toRunnableCompilation } from "@common/unit-tests/runnableCompilation";
import { selectTests } from "@common/unit-tests/unitTestTypes";
import { UNIT_TEST_LANGUAGES } from "@main/unit-tests/addUnitTestSupport";
import { bootModelFor, runUnitTests } from "@main/unit-tests/UnitTestRunner";
import { unsupportedMachineMessage } from "@main/unit-tests/unitTestMachines";
import { parseArgs } from "../args";
import { compileProject } from "../compile";
import { coverageText, type CoverageFormat } from "../coverage";
import { CliError, EXIT_BUILD_ERRORS, EXIT_FAILED, EXIT_INTERNAL, EXIT_OK, EXIT_USAGE, usageError } from "../exit-codes";
import { gccDiagnostic } from "../format";
import { createCliMachine, romOverrides } from "../headless";
import type { CliIo } from "../io";
import { loadProject, type CliProject } from "../project";
import { defaultReporter, type ConsoleReporter, type ReporterName, type RunTotals } from "../reporters/reporter";
import { createTapReporter } from "../reporters/tap";
import { createTextReporter } from "../reporters/text";

/*
 * `klive test` (`.plans/UNIT_TESTS_CLI_PLAN.md` D2-D10, §4): load the project, compile the build
 * root, discover the tests, run them in this process on one machine (D10), stream them to the
 * console and write JUnit and coverage files. The exit code is D3's.
 */

export const TEST_HELP = `Usage: klive test [<project-dir>] [<options>]

Builds the project and runs its Z80 unit tests on a machine of their own, without the IDE.

Options:
  --filter <pattern>        Only the tests matching it (Suite.*, *.UT_parse*); may repeat
  --list                    List the tests and exit
  --junit <file>            Write JUnit XML (time is emulated seconds; the tstates property is exact)
  --no-timestamp            Leave the timestamp out of the JUnit file (byte-identical runs)
  --coverage <file>         Write the tests' code coverage (LCOV)
  --coverage-format <f>     lcov (default) or kcov (Klive's own; 'coverage load' reads it)
  --reporter <r>            pretty, plain or tap (default: pretty on a terminal, plain otherwise)
  --timeout <s>             Each test's budget in emulated seconds (default 1)
  --bail                    Stop at the first failure
  --machine <id>[:<model>]  Run on this machine (sp48, sp128, spp3e, zxnext)
  --rom <name>=<file>       Use a ROM file in place of the one Klive ships (sp48, sp128-0, ...)
  --sjasmplus <path>        The sjasmplus executable (else SJASMPLUS, the project, the PATH)
  --use-ide-settings        Read the IDE's user settings too (sjasmplus, language extensions)

Options override klive.project's unitTests section, which overrides the defaults.
Exit codes: 0 passed, 1 failed, 2 build errors, 3 usage or configuration, 4 internal error.`;

const SPEC = {
  flags: ["list", "bail", "no-timestamp", "use-ide-settings", "help"],
  values: ["junit", "coverage", "coverage-format", "reporter", "timeout", "machine", "sjasmplus"],
  repeatable: ["filter", "rom"]
};

/** `--machine sp128:plus2` */
export function parseMachineOption(text: string): { machineId: string; modelId?: string } {
  const [machineId, modelId] = text.split(":").map((s) => s.trim());
  if (!machineId) throw usageError(`--machine takes <id>[:<model>]: '${text}'.`);
  return modelId ? { machineId, modelId } : { machineId };
}

/** The machine a run uses: `--machine`, then `unitTests.machine`, then the project's machine */
export function machineOf(project: CliProject, option?: string): { machineId?: string; modelId?: string; config?: Record<string, any> } {
  if (option) return parseMachineOption(option);
  const machineId = project.unitTests.machine ?? project.machineId;
  const sameMachine = machineId === project.machineId;
  const modelId = project.unitTests.model ?? (sameMachine ? project.modelId : undefined);
  return { machineId, modelId, ...(sameMachine && project.config ? { config: project.config } : {}) };
}

/** Runs `klive test`; returns the exit code */
export async function runTestVerb(argv: string[], io: CliIo): Promise<number> {
  const { positional, options } = parseArgs(argv, SPEC);
  if (options.help) {
    io.out(TEST_HELP);
    return EXIT_OK;
  }
  if (positional.length > 1) throw usageError(`klive test takes one project folder: ${positional.join(" ")}`);

  // --- Options checked before anything is built
  const reporterName = (options.reporter as string | undefined) ?? defaultReporter(!!io.isTty, io.env);
  if (!["pretty", "plain", "tap"].includes(reporterName)) throw usageError(`--reporter is pretty, plain or tap: '${reporterName}'.`);
  const coverageFormat = ((options["coverage-format"] as string | undefined) ?? "lcov") as CoverageFormat;
  if (!["lcov", "kcov"].includes(coverageFormat)) throw usageError(`--coverage-format is lcov or kcov: '${coverageFormat}'.`);
  let timeoutSeconds: number | undefined;
  if (options.timeout !== undefined) {
    timeoutSeconds = Number(options.timeout);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      throw usageError(`--timeout must be a positive number of emulated seconds: '${options.timeout}'.`);
    }
  }

  const project = loadProject(positional[0] ?? ".", io.cwd);
  const machine = machineOf(project, options.machine as string | undefined);
  if (!machine.machineId) throw usageError("The project names no machine; pass --machine <id>.");
  const unsupported = unsupportedMachineMessage(machine.machineId);
  if (unsupported) throw usageError(unsupported);
  const roms = romOverrides(options.rom as string[] | undefined, project.roms, project.folder, io.cwd);

  // --- 1. Compile
  const build = await compileProject(
    project,
    {
      sjasmplus: options.sjasmplus as string | undefined,
      useIdeSettings: !!options["use-ide-settings"],
      machineId: machine.machineId,
      modelId: machine.modelId
    },
    io.env,
    io.cwd
  );
  for (const d of build.diagnostics) io.err(gccDiagnostic(d));
  if (build.failed) {
    io.err(`Build failed: ${build.diagnostics.filter((d) => !d.warning).length} error(s).`);
    return EXIT_BUILD_ERRORS;
  }
  if (!UNIT_TEST_LANGUAGES.includes(build.language)) {
    throw usageError("The build root's language has no unit tests; they need the Klive Z80 assembler or sjasmplus.");
  }

  // --- 2. Discover
  const compilation = toRunnableCompilation(build.output);
  const program = discoverUnitTests(compilation, machine.machineId);
  if (!program.labels) throw usageError(program.problems[0] ?? "The build has no unit-test frame.");
  if (!program.tests.length) throw usageError("The project has no unit tests: no UT_ labels in the build.");
  const include = (options.filter as string[] | undefined) ?? project.unitTests.include;
  // --- Paths relative to the project, as CI annotators and a byte-identical JUnit file want them
  const rel = (file: string) => projectRelative(file, project.folder);
  const selected = selectTests(program.tests, { include }).map((t) => (t.file ? { ...t, file: rel(t.file) } : t));
  if (!selected.length) throw usageError(`No unit test matches ${include!.map((p) => `'${p}'`).join(", ")}.`);

  if (options.list) {
    for (const test of selected) {
      io.out(`${test.id}${test.file ? `  ${test.file}${test.line !== undefined ? `:${test.line}` : ""}` : ""}`);
    }
    return EXIT_OK;
  }

  // --- 3. Run
  const write = (line: string) => io.out(line);
  const reporter: ConsoleReporter =
    reporterName === "tap" ? createTapReporter(write) : createTextReporter(write, (reporterName as ReporterName) === "pretty");
  for (const note of program.notes) reporter.problem(note);

  const runOptions: UnitTestRunOptions = {
    ...(include ? { include } : {}),
    timeoutSeconds: timeoutSeconds ?? project.unitTests.timeout ?? 1,
    // --- A Next program usually pages the ROM out: reset only, unless the project says otherwise
    boot: project.unitTests.boot ?? (machine.machineId === MI_ZXNEXT ? "none" : "rom"),
    ...(options.coverage ? { coverage: true } : {})
  };
  const byId = new Map(selected.map((t) => [t.id, t]));
  const results: Record<string, JUnitResult> = {};
  const problems: string[] = [];
  let coverage: UnitTestCoverage | undefined;
  let clockHz: number | undefined;
  let running: string | undefined;
  let crash: string | undefined;
  const signal = { aborted: false };
  const started = Date.now();

  const headless = await createCliMachine({
    machineId: machine.machineId,
    modelId: machine.modelId,
    config: machine.config,
    romOverrides: roms,
    baseDir: __dirname,
    env: io.env
  });
  reporter.start(selected);
  const onEvent = (event: UnitTestEvent) => {
    switch (event.kind) {
      case "started":
        running = event.id;
        break;
      case "result": {
        running = undefined;
        const result: JUnitResult = event.result.location
          ? { ...event.result, location: { ...event.result.location, file: rel(event.result.location.file) } }
          : event.result;
        results[result.id] = result;
        const test = byId.get(result.id);
        if (test) reporter.result(test, result);
        if (options.bail && result.status !== "passed") signal.aborted = true;
        break;
      }
      case "problem":
        problems.push(event.message);
        reporter.problem(event.message);
        break;
      case "finished":
        clockHz = event.summary.clockHz;
        coverage = event.coverage;
        break;
    }
  };
  try {
    await runUnitTests(
      {
        program,
        compilation,
        machine: headless as never,
        bootModel: bootModelFor(machine.machineId, compilation.modelType),
        options: runOptions
      },
      onEvent,
      signal
    );
  } catch (err) {
    // --- A trap in the core (T8): the test that was running ends in an internal error, exit code 4
    crash = err instanceof Error ? err.message : String(err);
    const test = running ? byId.get(running) : undefined;
    if (test) {
      const result: JUnitResult = { id: test.id, status: "error", errorKind: "internal", tstates: 0, message: `The machine crashed: ${crash}` };
      results[test.id] = result;
      reporter.result(test, result);
    } else {
      reporter.problem(`The machine crashed: ${crash}`);
    }
  }

  // --- 4. Report
  const totals = totalsOf(selected, results, Date.now() - started);
  reporter.finish(selected, totals);

  if (options.junit) {
    const xml = toJUnitXml({
      name: project.name,
      tests: selected,
      results,
      projectFolder: project.folder,
      clockHz: clockHz ?? headless.baseClockFrequency * (headless.clockMultiplier || 1),
      ...(options["no-timestamp"] ? {} : { timestamp: new Date(started).toISOString() })
    });
    io.err(`JUnit: ${io.writeFile(options.junit as string, xml)}`);
  }
  if (options.coverage) {
    if (!coverage) {
      io.err("No coverage: the run collected none.");
    } else {
      const file = coverageText(coverageFormat, coverage, build.output, machine.machineId, project.folder, headless as never);
      if (typeof file === "string") io.err(`No coverage: ${file}`);
      else io.err(`Coverage (${coverageFormat.toUpperCase()}, ${file.summary}): ${io.writeFile(options.coverage as string, file.text)}`);
    }
  }

  if (crash) return EXIT_INTERNAL;
  if (problems.length && !Object.keys(results).length) return EXIT_USAGE;
  return totals.failed || totals.errors ? EXIT_FAILED : EXIT_OK;
}

/** The run's totals over the selected tests */
export function totalsOf(tests: readonly UnitTestCase[], results: Record<string, JUnitResult>, wallMs: number): RunTotals {
  const totals: RunTotals = { total: tests.length, passed: 0, failed: 0, errors: 0, skipped: 0, wallMs };
  for (const test of tests) {
    const r = results[test.id];
    if (!r) totals.skipped++;
    else if (r.status === "passed") totals.passed++;
    else if (r.status === "failed") totals.failed++;
    else totals.errors++;
  }
  return totals;
}

/** Wraps an unexpected throw as an internal error (exit code 4) */
export function asCliError(err: unknown): CliError {
  if (err instanceof CliError) return err;
  return new CliError(`Internal error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`, EXIT_INTERNAL);
}
