import type { DebuggableOutput, KliveCompilerOutput, ListFileItem } from "@abstractions/CompilerInfo";
import { MI_ZXNEXT } from "@common/machines/constants";
import { PF_EXECUTED } from "@common/profile/profileTypes";
import { instructionStarts } from "@common/profile/z80InstructionLength";
import { resolvedPartitionFor } from "@common/utils/source-breakpoint-partition";
import type { LcovFile } from "@common/profile/coverageExport";

/*
 * Code coverage of a compilation's source lines (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D11,
 * D12, T8). Pure: the compilation gives every line's instruction starts, each with the partition its
 * code lives in; the core's flags at those starts (`getProfileSample`) say which ran.
 *
 * - A line is **covered** when every instruction that starts in it ran, **partial** when some did
 *   (a Klive BASIC statement or a macro invocation whose branch was never taken, T8), **uncovered**
 *   when none did. A line that emitted no code has no state.
 * - A banked line is checked against its own bank's byte (D11): the partition comes from its segment
 *   (`resolvedPartitionFor`); an unbanked line's is whatever the machine has paged there, which the
 *   Emu API resolves (the partition is null).
 * - Klive BASIC's list items are statement address ranges: the instruction starts inside are decoded
 *   from the emitted code, so a statement is partial when only some of its instructions ran.
 */

export type CoverageState = "covered" | "partial" | "uncovered";

/** One instruction start the coverage asks the core about */
export type CoveragePoint = {
  address: number;
  /** The partition its code lives in; null: whatever is paged there */
  partition: number | null;
};

/** The instruction starts of one source line: indexes into the model's points */
export type CoverageLine = {
  fileIndex: number;
  line: number;
  points: number[];
};

export type CoverageModel = {
  /** Every distinct instruction start, in the order `getProfileSample` takes them */
  points: CoveragePoint[];
  /** The lines that emitted code, by file index */
  lines: CoverageLine[];
  /** The source files, by index */
  files: string[];
};

/** A line's coverage */
export type LineCoverage = {
  state: CoverageState;
  /** Instruction starts that ran, of `total` */
  executed: number;
  total: number;
  /** How often the line's first instruction ran, when counters are kept */
  hits?: number;
};

/** Builds the model of a compilation: its lines and their instruction starts (asked once per build) */
export function buildCoverageModel(output: KliveCompilerOutput | undefined, machineId: string | undefined): CoverageModel {
  const model: CoverageModel = { points: [], lines: [], files: [] };
  const compilation = output as Partial<DebuggableOutput> | undefined;
  if (!compilation?.listFileItems?.length) return model;
  model.files = (compilation.sourceFileList ?? []).map((f) => f.filename);
  const z80n = machineId === MI_ZXNEXT;
  const pointIndex = new Map<string, number>();
  const lineIndex = new Map<string, CoverageLine>();

  const pointOf = (address: number, partition: number | null): number => {
    const key = `${partition ?? "*"}:${address}`;
    let index = pointIndex.get(key);
    if (index === undefined) {
      index = model.points.length;
      model.points.push({ address, partition });
      pointIndex.set(key, index);
    }
    return index;
  };

  for (const item of compilation.listFileItems) {
    const segment = item.segmentIndex !== undefined ? compilation.segments?.[item.segmentIndex] : undefined;
    // --- sjasmplus names the partition itself (its SLD page, PROFILER_PLAN D8b)
    const partition = item.partition ?? resolvedPartitionFor(segment, item.address, machineId) ?? null;
    const key = `${item.fileIndex}:${item.lineNumber}`;
    let line = lineIndex.get(key);
    if (!line) {
      line = { fileIndex: item.fileIndex, line: item.lineNumber, points: [] };
      lineIndex.set(key, line);
      model.lines.push(line);
    }
    for (const address of startsOf(item, segment, z80n)) {
      const point = pointOf(address, partition);
      if (!line.points.includes(point)) line.points.push(point);
    }
  }
  return model;
}

/** The instruction starts of a list item: decoded from its code when it spans several instructions */
function startsOf(
  item: ListFileItem,
  segment: { startAddress: number; emittedCode: readonly number[] } | undefined,
  z80n: boolean
): number[] {
  const length = item.codeLength ?? 0;
  if (!segment || length <= 1) return [item.address & 0xffff];
  const from = item.address - segment.startAddress;
  if (from < 0 || from + length > segment.emittedCode.length) return [item.address & 0xffff];
  return instructionStarts(segment.emittedCode, from, length, z80n).map((o) => (segment.startAddress + o) & 0xffff);
}

/**
 * The coverage of every line, from the flags (and execution counts) at the model's points
 * @returns By file name, then by line number
 */
export function lineCoverage(
  model: CoverageModel,
  flags: ArrayLike<number>,
  exec?: ArrayLike<number>
): Map<string, Map<number, LineCoverage>> {
  const result = new Map<string, Map<number, LineCoverage>>();
  for (const line of model.lines) {
    const file = model.files[line.fileIndex];
    if (file === undefined || line.points.length === 0) continue;
    let executed = 0;
    for (const p of line.points) if ((flags[p] ?? 0) & PF_EXECUTED) executed++;
    const total = line.points.length;
    const state: CoverageState = executed === 0 ? "uncovered" : executed === total ? "covered" : "partial";
    let byLine = result.get(file);
    if (!byLine) {
      byLine = new Map();
      result.set(file, byLine);
    }
    byLine.set(line.line, { state, executed, total, ...(exec ? { hits: exec[line.points[0]] ?? 0 } : {}) });
  }
  return result;
}

/** The totals of a file's (or every file's) coverage, for `coverage status` and the export's summary */
export function coverageTotals(lines: Iterable<LineCoverage>): { lines: number; covered: number; partial: number } {
  let count = 0;
  let covered = 0;
  let partial = 0;
  for (const l of lines) {
    count++;
    if (l.state === "covered") covered++;
    else if (l.state === "partial") partial++;
  }
  return { lines: count, covered, partial };
}

/** LCOV's files from the line coverage: paths relative to the project folder, as CI tools want them */
export function lcovFilesOf(
  coverage: Map<string, Map<number, { hits?: number; state: string }>>,
  projectFolder?: string | null
): LcovFile[] {
  const files: LcovFile[] = [];
  for (const [path, lines] of coverage) {
    files.push({
      path: relativeTo(path, projectFolder),
      lines: [...lines].map(([line, c]) => ({ line, hits: c.hits ?? (c.state === "uncovered" ? 0 : 1) }))
    });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function relativeTo(path: string, folder?: string | null): string {
  if (!folder) return path;
  const norm = (p: string) => p.replace(/\\/g, "/");
  const p = norm(path);
  const f = norm(folder).replace(/\/$/, "");
  return p.startsWith(`${f}/`) ? p.slice(f.length + 1) : p;
}
