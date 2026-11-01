import { PF_CODE, PF_EXECUTED, PF_READ, PF_WRITTEN } from "@common/profile/profileTypes";
import type { RawRomSidecar } from "@common/roms/romAnnotationTools";
import type { DecodedTextTable } from "../conventions/convention";
import { conventionsFor } from "../conventions/registry";
import { imageBank, type BinaryImage } from "../image/binaryImage";
import { decodeBank, type DecodedBank } from "./decode";
import { analyseRegisters, type RegisterAnalysis, type RegisterFacts } from "./registers";
import { proposeRegions, type RegionProposal } from "./proposals";
import { buildRoutines, type Routine, type RoutineMap } from "./routines";

/*
 * The preprocessor's analysis of one ROM page (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.1, P2): the
 * stages that P2 builds, run in order on the page's bytes, its sidecar and an optional profile. Pure;
 * `cards.ts` renders the result and `scripts/rom-pipeline.cjs prepare` writes it.
 *
 * P2 takes the code map from the sidecar (its regions and labels). Finding code and data on its own
 * (the walk and the classifier), tables and conventions are later phases (P4, P5).
 */

/** Bumped when the analysis changes what it produces, so `inputs.json` can tell a stale bundle. */
export const PIPELINE_VERSION = 3;

/** A profile run of the page (P3 writes it): per-offset access flags and the call edges seen. */
export type RomPageProfile = {
  page: number;
  /** `PF_*` flags per page offset (`src/common/profile/profileTypes.ts`). */
  flags: number[];
  /** Call edges between page offsets (`-1` for a caller outside the page). */
  edges?: { caller: number; callee: number; calls: number; kind: string }[];
  /** What the run did, for the cards (`48K BASIC: PRINT, CLS, ...`). */
  recipe?: string;
};

export type MemoryFacts = {
  reads: number[];
  writes: number[];
  portsIn: (number | "bc")[];
  portsOut: (number | "bc")[];
  nextRegs: number[];
};

export type Coverage = { profiled: boolean; executed: number; rows: number; dataReadInCode: number[] };

export type WorkLeft = {
  label: boolean;
  synopsis: boolean;
  /** D10 lines a subroutine's synopsis lacks (`Entry:`, `Exit:`, `Changes:`). */
  contractLines: string[];
  uncommented: number;
  unknownFacts: number;
  /** A return with carry or zero set but no `Error:` line. */
  failureExitWithoutError: boolean;
  /** A weight for balancing ranges. */
  weight: number;
};

export type RoutineAnalysis = {
  routine: Routine;
  registers?: RegisterFacts;
  memory: MemoryFacts;
  coverage: Coverage;
  synopsis?: string;
  comments: Map<number, string>;
  work: WorkLeft;
};

export type RomAnalysis = {
  image: BinaryImage;
  bankId: string;
  decoded: DecodedBank;
  routineMap: RoutineMap;
  registers: RegisterAnalysis;
  routines: RoutineAnalysis[];
  /** Routine starts in bottom-up order (callees first), grouped into ranges. */
  ranges: number[][];
  questions: string[];
  labels: Map<number, string>;
  /** Region changes the evidence supports (P4). */
  proposals: RegionProposal[];
  /** The convention plug-ins that applied (P5), with their sources. */
  conventions: { id: string; description: string; source: string }[];
  /** A convention's note for a row (what a restart does). */
  notes: Map<number, string>;
  /** Packed text tables the conventions decoded. */
  texts: DecodedTextTable[];
  /** Hidden entries: a jump into an instruction, and the first instruction found there. */
  hiddenEntries: { offset: number; from: number[]; first: string }[];
};

export type AnalyseOptions = {
  image: BinaryImage;
  bankId: string;
  sidecar?: RawRomSidecar;
  profile?: RomPageProfile;
  /** The work a range should hold (the `weight` sum). */
  rangeWeight?: number;
};

export async function analyseRomPage(options: AnalyseOptions): Promise<RomAnalysis> {
  const { image, bankId } = options;
  const bank = options.sidecar?.banks?.[bankId];
  const labelsList: { name: string; value: number }[] = bank?.localLabels ?? [];
  const labels = new Map(labelsList.map((l) => [l.value, l.name]));
  const decoded = await decodeBank(image, bankId, { regions: bank?.regions, cuts: labelsList.map((l) => l.value) });

  const flags = options.profile?.flags;
  const routineMap = buildRoutines({
    image,
    decoded,
    labels: labelsList,
    wordTables: (bank?.regions ?? []).filter((r: { type: string }) => r.type === "words"),
    // --- Only the starts a run entered, not every executed row: callees of the call edges
    profileEntries: [...new Set((options.profile?.edges ?? []).map((e) => e.callee))].filter((o) => o >= 0 && o < decoded.size)
  });
  const conventions = conventionsFor(image.romKind);
  const registers = analyseRegisters(
    decoded,
    routineMap.routines.map((r) => r.start),
    {
      contractOf: (row) => {
        for (const c of conventions) {
          const contract = c.callContract?.(row);
          if (contract) return contract;
        }
        return undefined;
      }
    }
  );
  const notes = new Map<number, string>();
  for (const row of [...decoded.rows, ...decoded.hidden.values()]) {
    for (const c of conventions) {
      const note = c.explain?.(row, image.romKind);
      if (note) {
        notes.set(row.offset, note);
        break;
      }
    }
  }
  const labelsByName = new Map(labelsList.map((l) => [l.name, l.value]));
  const texts = conventions.flatMap(
    (c) => c.texts?.({ bytes: imageBank(image, bankId).bytes, labels: labelsByName, regions: bank?.regions }) ?? []
  );
  const hiddenEntries = [...new Set(routineMap.midInstructionTargets.map((t) => t.target))]
    .filter((target) => decoded.hidden.has(target))
    .sort((a, b) => a - b)
    .map((target) => ({
      offset: target,
      from: routineMap.midInstructionTargets.filter((t) => t.target === target).map((t) => t.from),
      first: decoded.hidden.get(target)!.text
    }));
  const lines: Record<string, { synopsis?: string; comment?: string }> = bank?.lineAnnotations ?? {};

  const routines = routineMap.routines.map((routine): RoutineAnalysis => {
    const facts = registers.get(routine.start);
    const memory = memoryFacts(routine);
    const coverage = coverageOf(routine, flags);
    const synopsis = lines[String(routine.start)]?.synopsis;
    const comments = new Map<number, string>();
    for (const row of routine.rows) {
      const comment = lines[String(row.offset)]?.comment;
      if (comment !== undefined) comments.set(row.offset, comment);
    }
    return { routine, ...(facts ? { registers: facts } : {}), memory, coverage, ...(synopsis !== undefined ? { synopsis } : {}), comments, work: workLeft(routine, facts, synopsis, comments) };
  });

  const ranges = groupRanges(routines, options.rangeWeight ?? 600);
  const { proposals, conflicts } = await proposeRegions({
    image,
    bankId,
    decoded,
    regions: bank?.regions,
    labels,
    ...(flags ? { flags } : {}),
    profileEntries: (options.profile?.edges ?? []).map((e) => e.callee).filter((o) => o >= 0 && o < decoded.size)
  });
  return {
    image,
    bankId,
    decoded,
    routineMap,
    registers,
    routines,
    ranges,
    questions: [...questionsOf(routineMap, routines), ...conflicts],
    labels,
    proposals,
    conventions: conventions.map((c) => ({ id: c.id, description: c.description, source: c.source })),
    notes,
    texts,
    hiddenEntries
  };
}

function memoryFacts(routine: Routine): MemoryFacts {
  const facts: MemoryFacts = { reads: [], writes: [], portsIn: [], portsOut: [], nextRegs: [] };
  for (const row of routine.rows) {
    const e = row.effects;
    if (e.memRead !== undefined) facts.reads.push(e.memRead);
    if (e.memWrite !== undefined) facts.writes.push(e.memWrite);
    if (e.portIn !== undefined) facts.portsIn.push(e.portIn);
    if (e.portOut !== undefined) facts.portsOut.push(e.portOut);
    if (e.nextReg !== undefined) facts.nextRegs.push(e.nextReg);
  }
  const unique = <T>(values: T[]) => [...new Set(values)].sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : 1));
  return {
    reads: unique(facts.reads),
    writes: unique(facts.writes),
    portsIn: unique(facts.portsIn),
    portsOut: unique(facts.portsOut),
    nextRegs: unique(facts.nextRegs)
  };
}

function coverageOf(routine: Routine, flags: number[] | undefined): Coverage {
  const rows = routine.rows.filter((r) => !r.data);
  if (!flags) return { profiled: false, executed: 0, rows: rows.length, dataReadInCode: [] };
  return {
    profiled: true,
    executed: rows.filter((r) => flags[r.offset] & PF_EXECUTED).length,
    rows: rows.length,
    // --- Bytes of the routine's code a run read or wrote but never fetched: data read as code
    // --- (inline data a custom decoder marks, such as an EXOS call's function byte, is data by design)
    dataReadInCode: rows
      .flatMap((r) => Array.from({ length: r.length }, (_, i) => r.offset + i))
      .filter((o) => flags[o] & (PF_READ | PF_WRITTEN) && !(flags[o] & PF_CODE))
  };
}

function workLeft(routine: Routine, facts: RegisterFacts | undefined, synopsis: string | undefined, comments: Map<number, string>): WorkLeft {
  const contractLines =
    routine.kind === "subroutine"
      ? ["Entry:", "Exit:", "Changes:"].filter((line) => !new RegExp(`^${line}`, "m").test(synopsis ?? ""))
      : [];
  const uncommented = routine.rows.filter((r) => !r.data && !comments.has(r.offset)).length;
  const failureExit = (facts?.exits ?? []).some((e) => e.kind.startsWith("ret") && (e.known.carry === 1 || e.known.zero === 1)) &&
    (facts?.exits ?? []).some((e) => e.kind.startsWith("ret") && (e.known.carry === 0 || e.known.zero === 0));
  const work: WorkLeft = {
    label: !routine.label,
    synopsis: synopsis === undefined,
    contractLines: synopsis === undefined ? [] : contractLines,
    uncommented,
    unknownFacts: facts?.unknowns.length ?? 0,
    failureExitWithoutError: routine.kind === "subroutine" && failureExit && !/^Error:/m.test(synopsis ?? ""),
    weight: 0
  };
  work.weight =
    (work.label ? 4 : 0) + (work.synopsis ? 12 : 0) + work.contractLines.length * 3 + work.uncommented + work.unknownFacts * 2;
  return work;
}

/** Routines in bottom-up order (callees first), cut into ranges of about `weight` work each. */
function groupRanges(routines: RoutineAnalysis[], weight: number): number[][] {
  const byStart = new Map(routines.map((r) => [r.routine.start, r]));
  const order: number[] = [];
  const seen = new Set<number>();
  const visit = (start: number) => {
    if (seen.has(start)) return;
    seen.add(start);
    for (const call of byStart.get(start)?.routine.calls ?? []) if (call.target !== undefined && byStart.has(call.target)) visit(call.target);
    order.push(start);
  };
  for (const r of routines) visit(r.routine.start);
  const ranges: number[][] = [];
  let current: number[] = [];
  let load = 0;
  for (const start of order) {
    const w = byStart.get(start)!.work.weight;
    if (w === 0) continue;
    if (current.length && load + w > weight) {
      ranges.push(current);
      current = [];
      load = 0;
    }
    current.push(start);
    load += w;
  }
  if (current.length) ranges.push(current);
  return ranges;
}

function questionsOf(map: RoutineMap, routines: RoutineAnalysis[]): string[] {
  const questions: string[] = [];
  for (const t of map.midInstructionTargets) {
    questions.push(
      `$${hex(t.target)} (named by $${hex(t.from)}) lies inside an instruction: a hidden entry (its decode is on the card of the routine that owns it), data read as code, or a jump made after a page switch?`
    );
  }
  for (const r of routines) {
    if (r.routine.kind === "unreached") questions.push(`$${hex(r.routine.start)}${r.routine.label ? ` ${r.routine.label}` : ""}: no known way in (no caller, jump or vector)`);
    if (r.coverage.dataReadInCode.length) {
      questions.push(`$${hex(r.routine.start)}: ${r.coverage.dataReadInCode.length} byte(s) of its code were read as data in the run, never fetched: data read as code?`);
    }
  }
  return questions;
}

/** The CPU address of a bank offset. */
export function runAddress(analysis: RomAnalysis, offset: number): number {
  return imageBank(analysis.image, analysis.bankId).origin + offset;
}

function hex(value: number): string {
  return value.toString(16).padStart(4, "0").toUpperCase();
}
