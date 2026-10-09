import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { UnitTestCoverage } from "@common/unit-tests/unitTestTypes";
import { PF_EXECUTED } from "@common/profile/profileTypes";
import { profileLayoutOf } from "@common/profile/layouts";
import { toKcov, toLcov } from "@common/profile/coverageExport";
import { buildCoverageModel, lcovFilesOf, lineCoverage } from "@common/profile/coverageModel";
import { resolveProfileOffsets } from "@emu/machines/profile/profileViews";

/*
 * `klive test --coverage` (`.plans/UNIT_TESTS_CLI_PLAN.md` D8): the runner's merged coverage of the
 * tests (G5.5 D17) as LCOV - the IDE's `coverage export` exporter over the compilation's source
 * lines - or as Klive's own `.kcov`, which `coverage load` merges into the IDE.
 */

export type CoverageFormat = "lcov" | "kcov";

/** The parts of the machine the offsets of unbanked lines need: what is paged where */
export type CoverageMachine = {
  getPartition?(address: number): number | undefined;
  currentProfileOffset?(address: number): number | undefined;
  /** The profile's time unit, for `.kcov` */
  getProfileInfo?(): { timeUnit: string } | undefined;
};

/**
 * The coverage file's text
 * @returns The text and a one-line summary, or a reason there is none
 */
export function coverageText(
  format: CoverageFormat,
  coverage: UnitTestCoverage,
  compilation: KliveCompilerOutput,
  machineId: string,
  projectFolder: string,
  machine: CoverageMachine
): { text: string; summary: string } | string {
  const layout = profileLayoutOf(coverage.profileMachineId);
  if (!layout) return `The ${machineId} core's coverage layout is unknown.`;
  if (format === "kcov") {
    const text = toKcov(
      coverage.profileMachineId,
      layout,
      { timeUnit: machine.getProfileInfo?.()?.timeUnit ?? "T-states", instructions: coverage.instructions, timeTotal: coverage.timeTotal },
      coverage.bytes
    );
    return { text, summary: `${coverage.bytes.length.toLocaleString("en-US")} touched bytes` };
  }

  const model = buildCoverageModel(compilation, machineId);
  if (!model.points.length) return "LCOV needs source lines, and the build has none.";
  const offsets = resolveProfileOffsets(
    layout,
    (address) => machine.getPartition?.(address),
    model.points.map((p) => p.address),
    model.points.map((p) => p.partition),
    machine.currentProfileOffset ? (address) => machine.currentProfileOffset!(address) : undefined
  );
  const byOffset = new Map(coverage.bytes.map((b) => [b.offset, b]));
  const flags = new Uint8Array(offsets.length);
  const exec = new Uint32Array(offsets.length);
  offsets.forEach((o, i) => {
    const b = o < 0 ? undefined : byOffset.get(o);
    if (!b) return;
    flags[i] = b.flags;
    exec[i] = b.exec ?? (b.flags & PF_EXECUTED ? 1 : 0);
  });
  const files = lcovFilesOf(lineCoverage(model, flags, exec), projectFolder);
  const lines = files.reduce((n, f) => n + f.lines.length, 0);
  const hit = files.reduce((n, f) => n + f.lines.filter((l) => l.hits > 0).length, 0);
  return {
    text: toLcov(files),
    summary: `${hit.toLocaleString("en-US")} of ${lines.toLocaleString("en-US")} lines hit in ${files.length} file${files.length === 1 ? "" : "s"}`
  };
}
