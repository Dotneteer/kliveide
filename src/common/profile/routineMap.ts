import type { DebuggableOutput, KliveCompilerOutput, ProcedureInfo } from "@abstractions/CompilerInfo";
import { resolvedPartitionFor } from "@common/utils/source-breakpoint-partition";
import { profileLocationOf, type ProfileLayout } from "./layouts/profileLayout";
import { isProfileRootKey, PROFILE_KEY_UNMAPPED, type ProfileEdge } from "./profileTypes";

/*
 * The profiler's routines (`.plans/PROFILER_PLAN.md` D6, §4.1): what a profile offset's time rolls
 * up into. Pure, so the IDE, the CLI (G5.6) and KSX share it.
 *
 * A routine comes from the best debug info available, in this order: Klive BASIC callables, the
 * Klive assembler's `.proc` extents, non-local labels (each up to the next), call targets the
 * call tracker saw, and - for whatever none of them covers - the bare 256-byte block. A higher
 * source claims its ranges first; a lower one only fills the gaps it leaves (the BASIC runtime
 * between callables is named by its runtime symbols, for instance).
 *
 * Routines live in (partition, CPU address) space - the compilation's - and the profile in profile
 * offsets. `offsetOf` joins them: for a banked routine through its partition, for an unbanked one
 * through whatever is paged at its address now (an unbanked line runs in whatever is paged, as an
 * unbanked breakpoint fires there).
 */

export type RoutineSource = "kbasic" | "proc" | "labels" | "annotations" | "callTargets" | "blocks";

export type Routine = {
  /** Unique within the map */
  key: string;
  name: string;
  source: RoutineSource;
  /** The partition its code lives in; undefined for unbanked code or a fixed-map machine */
  partition?: number;
  /** Its entry's CPU address (for a block, its first address) */
  entry: number;
  /** One past its last byte, as a CPU address: "up to the next label" for labels (T7) */
  end: number;
  /** Its entry's profile offset, when anything backs it */
  entryOffset?: number;
  /** Where it is defined */
  file?: string;
  fileIndex?: number;
  line?: number;
};

export type RoutineMap = {
  /** The best source that named any routine: the table header says it (D6) */
  source: RoutineSource;
  /** The compiler behind the symbols, when known ("sjasmplus", "Klive asm", "Klive BASIC") */
  compiler?: string;
  /** Every named routine (blocks are made on demand and are not listed) */
  routines: Routine[];
  /** The routine a profile offset rolls up into: a named one, else its 256-byte block */
  routineAt(offset: number): Routine;
  /** The routine whose entry is at a profile offset, when one is */
  routineByEntry(offset: number): Routine | undefined;
};

/** What the table header says about a source */
export function routineSourceLabel(map: Pick<RoutineMap, "source" | "compiler">): string {
  const by: Record<RoutineSource, string> = {
    kbasic: "Routines from Klive BASIC SUBs and FUNCTIONs",
    proc: "Routines from .proc blocks",
    labels: "Routines from labels",
    annotations: "Routines from annotation labels",
    callTargets: "Routines from call targets (no symbols)",
    blocks: "256-byte blocks (no symbols)"
  };
  return map.compiler && map.source !== "blocks" && map.source !== "callTargets"
    ? `${by[map.source]} (${map.compiler})`
    : by[map.source];
}

export type RoutineMapInput = {
  /** The IDE's compilation, if any */
  compilation?: KliveCompilerOutput;
  layout: ProfileLayout;
  /**
   * The profile offset of a CPU address in a partition; undefined partition: whatever is paged there
   * now (`resolveProfileOffsets`)
   */
  offsetOf: (partition: number | undefined, address: number) => number | undefined;
  /** The machine (the Next's partitions are 8K pages: `resolvedPartitionFor`) */
  machineId?: string;
  /** The call graph's edges: their callees are routines when no symbols exist (D6 (4)) */
  edges?: readonly ProfileEdge[];
  /** A partition's display name (`getPartitionLabels`), for blocks and call targets */
  partitionLabel?: (partition: number) => string;
  /**
   * The labels of the active annotation set and the ROM's annotations (D6 (3b),
   * `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.4): routines between the compilation's
   * labels and the call targets, each up to the next one in its partition or the end of its 16K slot.
   */
  annotationLabels?: readonly RoutineLabel[];
};

/** A routine as the compilation names it, before its offsets are known */
type Candidate = Omit<Routine, "key" | "entryOffset">;

const BLOCK = 0x100;
const OWNER_PAGE = 0x2000;

export function buildRoutineMap(input: RoutineMapInput): RoutineMap {
  const { layout } = input;
  const compilation = input.compilation as Partial<DebuggableOutput> & { symbols?: Record<string, unknown> } | undefined;
  const files = (compilation?.sourceFileList ?? []).map((f) => f.filename);
  const kbasic = compilation?.sourceLevelDebug;
  const compiler = kbasic
    ? "Klive BASIC"
    : compilation?.sourceType === "sjasmp"
      ? "sjasmplus"
      : Array.isArray(compilation?.procedures)
        ? "Klive asm"
        : undefined;

  const routines: Routine[] = [];
  const byEntry = new Map<number, Routine>();
  let best: RoutineSource | undefined;
  // --- Who owns each profile offset: the routine's index + 1, per 8K page, made on first claim
  const owners = new Map<number, Int32Array>();
  const ownerPage = (offset: number): Int32Array => {
    const page = Math.floor(offset / OWNER_PAGE);
    let owner = owners.get(page);
    if (!owner) owners.set(page, (owner = new Int32Array(OWNER_PAGE)));
    return owner;
  };

  /** Claims the offsets from..to nobody owns yet for the routine; true when it got any */
  const claimRun = (from: number, to: number, index: number): boolean => {
    let claimed = false;
    for (let offset = Math.max(0, from); offset < Math.min(to, layout.flagBytes); offset++) {
      const owner = ownerPage(offset);
      const i = offset % OWNER_PAGE;
      if (owner[i] === 0) {
        owner[i] = index + 1;
        claimed = true;
      }
    }
    return claimed;
  };

  const add = (routine: Routine, pieces: readonly { from: number; to: number }[]): boolean => {
    const index = routines.length;
    let claimed = false;
    for (const piece of pieces) claimed = claimRun(piece.from, piece.to, index) || claimed;
    if (!claimed) return false;
    routines.push(routine);
    if (routine.entryOffset !== undefined && !byEntry.has(routine.entryOffset)) byEntry.set(routine.entryOffset, routine);
    best ??= routine.source;
    return true;
  };

  /** Claims a compilation routine's offsets not claimed yet */
  const claim = (candidate: Candidate): boolean =>
    add(
      {
        ...candidate,
        key: `${candidate.source}:${candidate.partition ?? "*"}:${candidate.entry}:${routines.length}`,
        entryOffset: input.offsetOf(candidate.partition, candidate.entry)
      },
      offsetPieces(candidate, layout, input.offsetOf)
    );

  // --- (1) Klive BASIC callables, and the runtime's symbols between them
  if (kbasic) {
    for (const c of kbasicRoutines(kbasic, files)) claim(c);
    const runtime = kbasic.extensions?.runtimeSymbols ?? [];
    for (const c of labelRuns(runtime.map((r) => ({ name: r.name, address: r.address })), "labels", compilation)) claim(c);
  }
  // --- (2) .proc extents
  for (const c of procRoutines(compilation?.procedures ?? [], compilation, input.machineId, files)) claim(c);
  // --- (3) Non-local labels, each up to the next
  for (const c of labelRuns(compilationLabels(compilation, input.machineId, files), "labels", compilation)) claim(c);
  // --- (3b) Annotation and ROM labels: what the user (or the ROM's sidecar) named
  for (const c of labelRuns(input.annotationLabels ?? [], "annotations", undefined, (address) => (address & 0xc000) + 0x4000)) {
    claim(c);
  }
  // --- (4) Call targets, when nothing above named a routine
  if (!best && input.edges?.length) {
    // --- A call target is already a profile offset: it claims up to the next target in its region
    for (const c of callTargetRoutines(input.edges, layout, input.partitionLabel)) add(c.routine, [c]);
  }

  const blocks = new Map<number, Routine>();
  const blockAt = (offset: number): Routine => {
    const base = offset - (offset % BLOCK);
    let block = blocks.get(base);
    if (!block) {
      const location = profileLocationOf(layout, base);
      const address = location?.address ?? base;
      const prefix =
        location?.partition !== undefined ? `${input.partitionLabel?.(location.partition) ?? location.partition}:` : "";
      block = {
        key: `blocks:${base}`,
        name: `${prefix}$${hex4(address)}-$${hex4(address + BLOCK - 1)}`,
        source: "blocks",
        partition: location?.partition,
        entry: address,
        end: address + BLOCK,
        entryOffset: base
      };
      blocks.set(base, block);
    }
    return block;
  };

  return {
    source: best ?? "blocks",
    compiler,
    routines,
    routineAt(offset: number): Routine {
      const owner = owners.get(Math.floor(offset / OWNER_PAGE))?.[offset % OWNER_PAGE] ?? 0;
      return owner ? routines[owner - 1] : blockAt(offset);
    },
    routineByEntry(offset: number): Routine | undefined {
      return byEntry.get(offset);
    }
  };
}

/**
 * A routine's CPU range as runs of profile offsets: split where the CPU address crosses a
 * partition-sized slot, since the next slot may hold anything
 */
function offsetPieces(
  candidate: Candidate,
  layout: ProfileLayout,
  offsetOf: RoutineMapInput["offsetOf"]
): { from: number; to: number }[] {
  const pieces: { from: number; to: number }[] = [];
  const end = Math.min(0x10000, Math.max(candidate.end, candidate.entry + 1));
  let address = candidate.entry;
  while (address < end) {
    const slotEnd = Math.min(end, (Math.floor(address / layout.partitionSize) + 1) * layout.partitionSize);
    const from = offsetOf(candidate.partition, address);
    if (from !== undefined) pieces.push({ from, to: from + (slotEnd - address) });
    address = slotEnd;
  }
  return pieces;
}

/** Klive BASIC's SUBs, FUNCTIONs and main program: their frames' exact extents (D6 (1)) */
function kbasicRoutines(debug: NonNullable<DebuggableOutput["sourceLevelDebug"]>, files: string[]): Candidate[] {
  const frames = debug.extensions?.frames ?? [];
  const result: Candidate[] = [];
  for (const callable of debug.callables) {
    const frame = frames.find((f) => f.callableIndex === callable.index);
    let entry = frame?.startAddress;
    let end = frame?.endAddress;
    if (entry === undefined || end === undefined) {
      // --- No frame info: the span of the callable's statements
      const statements = debug.statements.slice(callable.firstStatementIndex, callable.lastStatementIndex + 1);
      if (!statements.length) continue;
      entry = Math.min(callable.entryAddress, ...statements.map((s) => s.startAddress));
      end = Math.max(...statements.map((s) => s.endAddress));
    }
    if (end <= entry) continue;
    const fileName = debug.files.find((f) => f.index === callable.fileIndex)?.filename ?? files[callable.fileIndex];
    result.push({
      name: callable.name,
      source: "kbasic",
      partition: frame?.partition ?? callable.partition,
      entry,
      end,
      file: fileName,
      fileIndex: callable.fileIndex,
      line: callable.startLine
    });
  }
  return result;
}

/** The `.proc` extents (D6 (2), D7): the partition from the segment's bank */
function procRoutines(
  procedures: readonly ProcedureInfo[],
  compilation: Partial<DebuggableOutput> | undefined,
  machineId: string | undefined,
  files: string[]
): Candidate[] {
  // --- Inner procs first: an outer proc's extent covers its inner ones, which claim theirs first
  const sorted = [...procedures].sort((a, b) => a.endAddress - a.startAddress - (b.endAddress - b.startAddress));
  return sorted.map((p) => ({
    name: p.name,
    source: "proc" as const,
    partition: resolvedPartitionFor(compilation?.segments?.[p.segmentIndex], p.startAddress, machineId),
    entry: p.startAddress,
    end: p.endAddress,
    file: files[p.fileIndex],
    fileIndex: p.fileIndex,
    line: p.startLine
  }));
}

/** A label that may start a routine */
export type RoutineLabel = {
  name: string;
  address: number;
  partition?: number;
  fileIndex?: number;
  file?: string;
  line?: number;
};

/**
 * The compilation's non-local labels (D6 (3)): the Klive assembler's module-level and nested-module
 * labels, and sjasmplus's labels without a local part. Each label's partition comes from the symbol
 * (sjasmplus's page, D8b) or from the list item on its definition line (the Klive assembler's segment
 * bank).
 */
export function compilationLabels(
  compilation: (Partial<DebuggableOutput> & { symbols?: Record<string, unknown> }) | undefined,
  machineId: string | undefined,
  files: string[] = []
): RoutineLabel[] {
  if (!compilation?.symbols) return [];
  const labels: RoutineLabel[] = [];
  // --- The Klive assembler's line -> partition, from its list items' segments, and the line's text:
  // --- a case-insensitive build keeps its symbols lower-case, the source as written
  const linePartition = new Map<string, number | undefined>();
  const lineText = new Map<string, string>();
  for (const item of compilation.listFileItems ?? []) {
    const key = `${item.fileIndex}:${item.lineNumber}`;
    if (linePartition.has(key)) continue;
    const segment = item.segmentIndex !== undefined ? compilation.segments?.[item.segmentIndex] : undefined;
    linePartition.set(key, item.partition ?? resolvedPartitionFor(segment, item.address, machineId));
    if (item.sourceText) lineText.set(key, item.sourceText);
  }
  const asWritten = (name: string, fileIndex?: number, line?: number): string => {
    const text = fileIndex !== undefined && line !== undefined ? lineText.get(`${fileIndex}:${line}`) : undefined;
    const written = text?.match(/^\s*\.?([A-Za-z_@`][\w@`!?.]*)/)?.[1];
    return written && written.toLowerCase() === name.toLowerCase() ? written : name;
  };
  const visit = (symbols: Record<string, unknown>, prefix: string, modules: Record<string, unknown> | undefined) => {
    for (const [key, info] of Object.entries(symbols)) {
      // --- A `.module`'s name is a label at its start: the module's own labels name that code
      if (modules && key in modules) continue;
      const s = info as {
        name?: string;
        type?: number;
        isLocal?: boolean;
        isShortTerm?: boolean;
        partition?: number;
        writtenName?: string;
        definitionFileIndex?: number;
        definitionLine?: number;
        value?: { _value?: unknown };
      };
      const value = s?.value?._value;
      // --- SymbolType.Label, a code address, not a local or temporary label
      if (s?.type !== 1 || typeof value !== "number" || value < 0 || value > 0xffff) continue;
      const name = s.name ?? key;
      if (s.isLocal || s.isShortTerm || name.startsWith("`")) continue;
      const partition =
        s.partition ??
        (s.definitionFileIndex !== undefined && s.definitionLine !== undefined
          ? linePartition.get(`${s.definitionFileIndex}:${s.definitionLine}`)
          : undefined);
      const shown = s.writtenName ?? asWritten(name, s.definitionFileIndex, s.definitionLine);
      labels.push({
        name: prefix ? `${prefix}.${shown}` : shown,
        address: value,
        partition,
        fileIndex: s.definitionFileIndex,
        file: s.definitionFileIndex !== undefined ? files[s.definitionFileIndex] : undefined,
        line: s.definitionLine
      });
    }
  };
  visit(compilation.symbols, "", (compilation as { nestedModules?: Record<string, unknown> }).nestedModules);
  // --- The Klive assembler's nested modules
  const walk = (module: { nestedModules?: Record<string, unknown> } | undefined, path: string) => {
    for (const [name, nested] of Object.entries(module?.nestedModules ?? {})) {
      const m = nested as { symbols?: Record<string, unknown>; nestedModules?: Record<string, unknown> };
      const fullPath = path ? `${path}.${name}` : name;
      if (m?.symbols) visit(m.symbols, fullPath, m.nestedModules);
      walk(m, fullPath);
    }
  };
  walk(compilation as { nestedModules?: Record<string, unknown> }, "");
  return labels;
}

/**
 * Labels as routines (T7): each runs up to the next label in its partition, the last one to the end
 * of its code segment (or 256 bytes, when no segment holds it). Of several labels at one address,
 * the first is the routine's name.
 */
function labelRuns(
  labels: readonly RoutineLabel[],
  source: RoutineSource,
  compilation: Partial<DebuggableOutput> | undefined,
  lastEnd?: (address: number) => number
): Candidate[] {
  const byPartition = new Map<string, RoutineLabel[]>();
  for (const l of labels) {
    const key = String(l.partition ?? "*");
    let list = byPartition.get(key);
    if (!list) byPartition.set(key, (list = []));
    list.push(l);
  }
  const segments = compilation?.segments ?? [];
  const segmentEnd = (address: number): number => {
    for (const s of segments) {
      const end = s.startAddress + (s.emittedCode?.length ?? 0);
      if (address >= s.startAddress && address < end) return end;
    }
    return Math.min(0x10000, lastEnd ? lastEnd(address) : address + BLOCK);
  };
  const result: Candidate[] = [];
  for (const list of byPartition.values()) {
    list.sort((a, b) => a.address - b.address);
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      if (i > 0 && list[i - 1].address === l.address) continue;
      let next = i + 1;
      while (next < list.length && list[next].address === l.address) next++;
      const end = Math.min(next < list.length ? list[next].address : 0x10000, segmentEnd(l.address));
      result.push({
        name: l.name,
        source,
        partition: l.partition,
        entry: l.address,
        end: Math.max(end, l.address + 1),
        file: l.file,
        fileIndex: l.fileIndex,
        line: l.line
      });
    }
  }
  return result;
}

/** Call targets as routines (D6 (4)): each up to the next target in the same layout region */
function callTargetRoutines(
  edges: readonly ProfileEdge[],
  layout: ProfileLayout,
  partitionLabel?: (partition: number) => string
): { routine: Routine; from: number; to: number }[] {
  const targets = [
    ...new Set(edges.map((e) => e.callee).filter((c) => !isProfileRootKey(c) && (c & PROFILE_KEY_UNMAPPED) === 0))
  ].sort((a, b) => a - b);
  const regionEnd = (offset: number): number => {
    for (const r of layout.regions) {
      const size = r.size ?? layout.partitionSize;
      if (offset >= r.start && offset < r.start + size) return r.start + size;
    }
    return layout.flagBytes;
  };
  return targets.map((offset, i) => {
    const location = profileLocationOf(layout, offset);
    const address = location?.address ?? offset;
    const end = Math.min(i + 1 < targets.length ? targets[i + 1] : layout.flagBytes, regionEnd(offset));
    const prefix = location?.partition !== undefined ? `${partitionLabel?.(location.partition) ?? location.partition}:` : "";
    return {
      from: offset,
      to: end,
      routine: {
        key: `callTargets:${offset}`,
        name: `sub_${prefix}${hex4(address)}`,
        source: "callTargets" as const,
        partition: location?.partition,
        entry: address,
        end: address + (end - offset),
        entryOffset: offset
      }
    };
  });
}

function hex4(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
