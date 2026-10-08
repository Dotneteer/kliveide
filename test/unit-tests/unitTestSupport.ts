import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import type { IFileProvider } from "@renderer/core/IFileProvider";
import type { UnitTestEvent, UnitTestResult, UnitTestRunOptions, UnitTestSummary } from "@common/unit-tests/unitTestTypes";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { discoverUnitTests } from "@common/unit-tests/discovery";
import { checkSourceAnnotations } from "@common/utils/source-annotations";
import { createHeadlessMachine } from "@main/unit-tests/HeadlessMachineFactory";
import { runUnitTests } from "@main/unit-tests/UnitTestRunner";
import { KLIVE_UNIT_TEST_INCLUDE } from "@main/unit-tests/includes/kliveInclude";
import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_ZXNEXT } from "@common/machines/constants";

import { buildSp48Wasm, productionOutput as sp48Output } from "../../scripts/build-sp48-wasm.cjs";
import { buildSp128Wasm, productionOutput as sp128Output } from "../../scripts/build-sp128-wasm.cjs";
import { buildSpP3eWasm, productionOutput as spp3eOutput } from "../../scripts/build-spp3e-wasm.cjs";
import { productionOutput as zxnextOutput } from "../../scripts/build-zxnext-wasm.cjs";

/*
 * Shared by the unit-test runner's tests: the production cores and ROMs, read from the repo the way
 * the main process reads them from the app's resources.
 */

const PUBLIC = join(__dirname, "../../src/public");

/** ROMs and firmware from `src/public`, as the app's public folder */
export class RepoFileProvider implements IFileProvider {
  async readTextFile(path: string): Promise<string> {
    return readFileSync(this.resolve(path), "utf8");
  }
  async readBinaryFile(path: string): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(this.resolve(path)));
  }
  writeTextFile(): Promise<void> {
    throw new Error("read-only");
  }
  writeBinaryFile(): Promise<void> {
    throw new Error("read-only");
  }
  private resolve(path: string): string {
    return isAbsolute(path) ? path : join(PUBLIC, path);
  }
}

const built = new Set<string>();

/** The core's bytes, built once per test process (the Next's is built by its own tests) */
function artifactFor(machineId: string): Uint8Array {
  if (!built.has(machineId)) {
    if (machineId === MI_SPECTRUM_48) buildSp48Wasm();
    else if (machineId === MI_SPECTRUM_128) buildSp128Wasm();
    else if (machineId === MI_SPECTRUM_3E) buildSpP3eWasm();
    built.add(machineId);
  }
  const path =
    machineId === MI_SPECTRUM_48
      ? sp48Output
      : machineId === MI_SPECTRUM_128
        ? sp128Output
        : machineId === MI_SPECTRUM_3E
          ? spp3eOutput
          : zxnextOutput;
  return new Uint8Array(readFileSync(path));
}

export function createTestMachine(machineId: string, modelId?: string) {
  return createHeadlessMachine({
    machineId,
    modelId,
    readArtifact: () => artifactFor(machineId),
    fileProvider: new RepoFileProvider()
  });
}

/** Assembles a test program with Klive's include in front of it (file 0 holds both) */
export async function assembleWithInclude(source: string, model = SpectrumModelType.Spectrum48) {
  const options = new AssemblerOptions();
  options.currentModel = model;
  const output = await new Z80Assembler().compile(`${KLIVE_UNIT_TEST_INCLUDE}\n${source}`, options);
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) {
    throw new Error(errors.map((e) => `line ${e.line}: ${e.errorCode} ${e.message}`).join("\n"));
  }
  return checkSourceAnnotations(output as never) as typeof output;
}

/** The line of the include text plus one: where a test source's line 1 is */
export const INCLUDE_LINES = KLIVE_UNIT_TEST_INCLUDE.split("\n").length;

export type RunOutcome = {
  events: UnitTestEvent[];
  results: Record<string, UnitTestResult>;
  summary: UnitTestSummary;
  problems: string[];
};

/** Assembles, discovers and runs a program's tests on a fresh machine */
export async function runProgram(
  source: string,
  options: UnitTestRunOptions & { machineId?: string; modelId?: string; model?: SpectrumModelType; bootModel?: string } = {}
): Promise<RunOutcome> {
  const machineId = options.machineId ?? MI_SPECTRUM_48;
  const compilation = await assembleWithInclude(source, options.model);
  const program = discoverUnitTests(compilation as never, machineId);
  const machine = await createTestMachine(machineId, options.modelId);
  const events: UnitTestEvent[] = [];
  const summary = await runUnitTests(
    { program, compilation: compilation as never, machine: machine as never, options, bootModel: options.bootModel },
    (e) => events.push(e)
  );
  const results: Record<string, UnitTestResult> = {};
  for (const e of events) if (e.kind === "result") results[e.result.id] = e.result;
  return { events, results, summary, problems: events.flatMap((e) => (e.kind === "problem" ? [e.message] : [])) };
}

export { MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_ZXNEXT };
