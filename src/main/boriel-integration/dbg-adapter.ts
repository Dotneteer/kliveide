import path from "path";

import type {
  CallableDebugInfo,
  CallableKind,
  FileLine,
  ListFileItem,
  SourceLevelDebugInfo,
  StatementDebugInfo
} from "@abstractions/CompilerInfo";
import type {
  CallableFrameInfo,
  CallSiteDebugInfo,
  CodebankDebugInfo,
  SourceValueType,
  VariableDebugInfo
} from "@abstractions/SourceDebugInfo";
import { defaultReturnRegisters, upgradeCallSiteKind, upgradeValueType, zxbcFarRecords } from "@common/utils/source-debug-upgrade";
import { mapSymbols, type MapEntry } from "./boriel-map";

/*
 * Boriel BASIC's `.dbg` (format "zx-source-debug" v1) → Klive's source-level debug model and the
 * classic tables (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §5). Pure but for the injected file reader.
 *
 * The format began as Klive's proposal, so most fields carry over; what zxbc writes differently is
 * corrected here, each correction observed in Phase B0 (`.ai/boriel/dbg-observed.md`):
 *   - statements are unsorted and their indexes have gaps (removed statements): re-indexed densely;
 *   - an `endAddress` runs into the next routine: clamped to the owning routine's epilogue or the
 *     next routine's start, so prologues, epilogues and a dynamic DIM's code map to glue (-1);
 *   - an indented assignment starts at column 0; a multi-item PRINT ends after its first item;
 *   - FASTCALL parameters carry a frame location they do not have: dropped, as are dynamic local
 *     arrays (a pointer to a heap block of unknown shape) and entries of an unknown type;
 *   - a callable's `entryAddress` is where the call lands; Klive's is the first address after the
 *     prologue (`bodyStart`);
 *   - a Next partition is the window's first 8K page: Klive's are 8K pages, so `+ (address - window) / 8K`;
 *   - a FUNCTION call site's `returnAddress` is one past the real one (zxbc records the address after
 *     the PUSH that follows the CALL): checked against the code image and moved back.
 */

export type DbgAdapterInput = {
  /** The parsed `.dbg`. */
  dbg: any;
  /** The `-M` map's entries. */
  map: MapEntry[];
  /** zxbc's `--arch` (zx48k, zx128k, zxnext). */
  arch: string;
  /** The folder relative file names are resolved against (zxbc reports them as given). */
  baseFolder: string;
  /** Files under this folder (the installation's `lib/`) are the standard library: Just My Code steps over them. */
  libraryFolder?: string;
  optimizationLevel: number;
  /** A source file's text, for the column corrections; undefined when it cannot be read. */
  readFile: (path: string) => string | undefined;
  /** The unbanked code image and its address, to check call sites' return addresses against. */
  image?: { bytes: Uint8Array | number[]; origin: number };
  /** A banked build's banks, by the `.dbg`'s partition (16K bank; Next: first 8K page), for the same check. */
  bankImages?: { partition: number; bytes: Uint8Array | number[]; origin: number }[];
};

export type ClassicDebugTables = {
  sourceFileList: { filename: string; includes: [] }[];
  sourceMap: Record<number, FileLine>;
  listFileItems: ListFileItem[];
};

export type DbgAdapterOutput = ClassicDebugTables & {
  sourceLevelDebug: SourceLevelDebugInfo;
  /** What the validator found (B4: a debug build with problems steps statement by statement only). */
  problems: string[];
  /** Records left out, with the reason (for the build output). */
  dropped: string[];
};

/** zxbc's `.dbg` speaks version 1 of the debug model: its type names read through the upgrade's table. */
const VALUE_TYPES: Record<string, { type: SourceValueType; typeLabel: string }> = Object.fromEntries(
  ["byte", "ubyte", "integer", "uinteger", "long", "ulong", "fixed", "float", "string", "boolean", "bool"].map((t) => [t, upgradeValueType(t)])
);

const CALLABLE_KINDS: Record<string, CallableKind> = {
  entrypoint: "entrypoint",
  subroutine: "subroutine",
  sub: "subroutine",
  function: "function"
};

/** The 16K window banked code runs in (128K and Next alike, `codebank.window`). */
const WINDOW = 0xc000;

/** The 128K's `BANKM` system variable: zxbc's far call saves it, and keeps the bank in its low bits. */
const BANKM = 0x5b5c;

/**
 * zxbc's far calls (`--split-modules`) in Klive's CODEBANK model, so the call stack walks through
 * bank switches (`.ai/boriel/dbg-observed.md`, "Far calls"). A call site runs the `callFar` template,
 * which ends `CALL helper`; the helper replaces the return slot with its own return path (its
 * `LD HL,nn` at helper + 4) and pushes the real return and the caller's paging onto a shadow stack
 * whose pointer is `core.PAGE_STACK`. Undefined, with a note, when the build is not banked or the
 * helper does not have that shape.
 */
function adaptCodebank(
  raw: any,
  arch: string,
  map: MapEntry[],
  image: DbgAdapterInput["image"],
  dropped: string[]
): CodebankDebugInfo | undefined {
  const template: number[] | undefined = raw?.callFar?.bytes;
  if (!Array.isArray(template)) return undefined;
  const n = template.length;
  const helper = n >= 3 && template[n - 3] === 0xcd ? template[n - 2] | (template[n - 1] << 8) : undefined;
  const byteAt = (a: number) => (image && a >= image.origin && a < image.origin + image.bytes.length ? image.bytes[a - image.origin] : undefined);
  const farReturn =
    helper !== undefined && byteAt(helper + 4) === 0x21 ? (byteAt(helper + 5) ?? 0) | ((byteAt(helper + 6) ?? 0) << 8) : undefined;
  const pageStack = map.find((e) => e.name === "core.PAGE_STACK")?.address;
  if (helper === undefined || farReturn === undefined || pageStack === undefined) {
    dropped.push("far calls: the far-call helper was not recognised, so the call stack stops at a bank switch");
    return undefined;
  }
  const next = arch === "zxnext";
  return {
    window: raw.window?.start ?? WINDOW,
    windowSize: raw.window?.length ?? 0x4000,
    farCall: helper,
    farReturn,
    // --- Klive BASIC's current-bank byte; the Next pages through NextRegs and has none
    currentBank: next ? 0 : BANKM,
    shadowStackPointer: pageStack,
    shadowStack: pageStack,
    // --- A logical bank is the `.dbg`'s partition: the 16K bank on the 128K (whose partitions are
    // --- 16K, so both halves of the window name it), the first 8K page on the Next
    banks: (raw.banks ?? []).map((b: any) => ({ bank: b.id, pages: next ? [b.id, b.id + 1] : [b.id, b.id] })),
    // --- The 128K saves BANKM (bank in bits 0-2); the Next saves the page MMU slot 6 held
    records: zxbcFarRecords(next ? 0xff : 0x07)
  };
}

export function adaptBorielDebugInfo(input: DbgAdapterInput): DbgAdapterOutput {
  const { dbg } = input;
  if (dbg?.format !== "zx-source-debug" || dbg?.version !== 1) {
    throw new Error(`Unsupported debug file format (${dbg?.format} version ${dbg?.version}).`);
  }
  const sld = dbg.sourceLevelDebug ?? {};
  const ext = sld.extensions ?? {};
  const dropped: string[] = [];
  const partitionOf = (partition: number | undefined, address: number): number | undefined => {
    if (partition === undefined || partition === null) return undefined;
    return input.arch === "zxnext" && address >= WINDOW ? partition + ((address - WINDOW) >> 13) : partition;
  };

  // --- Files, absolute
  const files: string[] = (sld.files ?? [])
    .slice()
    .sort((a: any, b: any) => a.index - b.index)
    .map((f: any) => (path.isAbsolute(f.filename) ? f.filename : path.resolve(input.baseFolder, f.filename)));
  const isLibrary = (fileIndex: number) => {
    const lib = input.libraryFolder ? path.resolve(input.libraryFolder) + path.sep : undefined;
    return !!lib && !!files[fileIndex] && files[fileIndex].startsWith(lib);
  };
  const texts = new Map<number, string[] | undefined>();
  const linesOf = (fileIndex: number) => {
    if (!texts.has(fileIndex)) texts.set(fileIndex, input.readFile(files[fileIndex])?.replace(/\r\n?/g, "\n").split("\n"));
    return texts.get(fileIndex);
  };

  // --- Frames by callable, and every routine's start (statement ends are clamped against them)
  const rawCallables: any[] = sld.callables ?? [];
  const rawFrames = new Map<number, any>((ext.frames ?? []).map((f: any) => [f.callableIndex, f]));
  const routineStarts = rawCallables
    .map((c) => ({ start: rawFrames.get(c.index)?.startAddress ?? c.entryAddress, partition: partitionOf(c.partition, c.entryAddress) }))
    .sort((a, b) => a.start - b.start);

  // --- Statements: sorted by address, re-indexed densely, ends clamped, columns corrected
  const raw: any[] = (sld.statements ?? []).slice().sort(
    (a: any, b: any) => a.startAddress - b.startAddress || (a.partition ?? -1) - (b.partition ?? -1)
  );
  const indexOf = new Map<number, number>();
  raw.forEach((s, i) => indexOf.set(s.index, i));
  // --- A modular build (`USE`) records every statement as the main program's: the routine whose
  // --- frame holds the statement's address, in the same bank, is its owner (`dbg-observed.md` 15)
  const mainRaw = entrypointIndex(rawCallables);
  const routineRanges = rawCallables
    .filter((c) => c.index !== mainRaw)
    .map((c) => {
      const f = rawFrames.get(c.index);
      const start = f?.startAddress ?? c.entryAddress;
      const end = Math.max(f?.endAddress ?? 0, (f?.epilogueStart ?? start) + 1, ...(c.exitAddresses ?? []).map((a: number) => a + 1));
      return { index: c.index, start, end, partition: c.partition ?? undefined };
    });
  const ownerOf = (s: any): number => {
    const recorded = s.callableIndex >= 0 ? s.callableIndex : mainRaw;
    if (recorded !== mainRaw) return recorded;
    const range = routineRanges.find(
      (r) => r.partition === (s.partition ?? undefined) && s.startAddress >= r.start && s.startAddress < r.end
    );
    return range?.index ?? recorded;
  };
  const statements: StatementDebugInfo[] = raw.map((s, i) => {
    const partition = partitionOf(s.partition, s.startAddress);
    const owner = ownerOf(s);
    const frame = rawFrames.get(owner);
    // --- The next statement in the same partition, and the first routine starting after this one
    const next = raw.slice(i + 1).find((o) => partitionOf(o.partition, o.startAddress) === partition && o.startAddress > s.startAddress);
    const nextRoutine = routineStarts.find((r) => r.partition === partition && r.start > s.startAddress)?.start;
    let end = s.endAddress > s.startAddress ? s.endAddress : (next?.startAddress ?? s.startAddress);
    if (frame && frame.convention !== "entrypoint" && s.startAddress < frame.epilogueStart) end = Math.min(end, frame.epilogueStart);
    if (frame?.convention === "entrypoint" && s.startAddress < frame.epilogueStart) end = Math.min(end, frame.epilogueStart);
    if (nextRoutine !== undefined) end = Math.min(end, nextRoutine);
    if (end <= s.startAddress) end = s.startAddress + 1;
    const columns = correctColumns(s, linesOf(s.fileIndex));
    return {
      index: i,
      fileIndex: s.fileIndex,
      startLine: s.startLine,
      startColumn: columns.start,
      endLine: s.endLine,
      endColumn: columns.end,
      startAddress: s.startAddress,
      endAddress: end,
      ...(partition !== undefined ? { partition } : {}),
      kind: "other",
      callableIndex: owner
    };
  });

  // --- Callables (same order and indexes as zxbc's: frames and call sites point at them)
  const callables: CallableDebugInfo[] = rawCallables
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((c) => {
      const own = statements.filter((s) => s.callableIndex === c.index);
      const frame = rawFrames.get(c.index);
      const partition = partitionOf(c.partition, c.entryAddress);
      return {
        index: c.index,
        name: c.name,
        kind: CALLABLE_KINDS[c.kind] ?? "subroutine",
        fileIndex: c.fileIndex ?? own[0]?.fileIndex ?? 0,
        startLine: c.line ?? own[0]?.startLine ?? 1,
        endLine: own.reduce((m, s) => Math.max(m, s.endLine), c.line ?? 1),
        // --- Klive's entry is the body's first address, after the prologue
        entryAddress: frame?.bodyStart ?? c.entryAddress,
        exitAddresses: c.exitAddresses ?? [],
        ...(partition !== undefined ? { partition } : {}),
        firstStatementIndex: own.length ? own[0].index : -1,
        lastStatementIndex: own.length ? own[own.length - 1].index : -1
      };
    });
  const mainIndex = entrypointIndex(rawCallables);

  // --- Frames, one per callable in callable order
  const frames: CallableFrameInfo[] = callables.map((c) => {
    const f = rawFrames.get(c.index);
    const convention: CallableFrameInfo["convention"] =
      f?.convention === "entrypoint" || c.kind === "entrypoint" ? "entrypoint" : f?.convention === "fastcall" ? "fastcall" : "frame";
    const startAddress = f?.startAddress ?? c.entryAddress;
    const epilogueStart = f?.epilogueStart ?? startAddress;
    const endAddress = Math.max(f?.endAddress ?? epilogueStart, epilogueStart, ...(c.exitAddresses.map((a) => a + 1)));
    const returnType = f?.returnType ? VALUE_TYPES[f.returnType] : undefined;
    const returns = returnType ? { ...returnType, in: defaultReturnRegisters(returnType.type) } : undefined;
    return {
      callableIndex: c.index,
      convention,
      ...(convention === "entrypoint" ? {} : { returnSlotOffset: f?.returnSlotOffset ?? 2, argBytes: f?.argBytes ?? 0 }),
      startAddress,
      bodyStart: f?.bodyStart ?? startAddress,
      epilogueStart,
      endAddress,
      ...(c.partition !== undefined ? { partition: c.partition } : {}),
      ...(returns ? { returns } : {}),
      ...(isLibrary(c.fileIndex) ? { library: true } : {})
    };
  });

  // --- Call sites: statement indexes remapped; a top-level call's caller is the entrypoint
  const callSites: CallSiteDebugInfo[] = [];
  for (const site of ext.callSites ?? []) {
    const statementIndex = site.statementIndex !== undefined ? indexOf.get(site.statementIndex) : undefined;
    if (statementIndex === undefined) {
      dropped.push(`call site returning to $${hex(site.returnAddress)}: no statement`);
      continue;
    }
    const partition = partitionOf(site.partition, site.returnAddress);
    callSites.push({
      returnAddress: correctReturnAddress(
        site.returnAddress,
        site.partition === undefined || site.partition === null
          ? input.image
          : input.bankImages?.find((b) => b.partition === site.partition)
      ),
      ...(partition !== undefined ? { partition } : {}),
      statementIndex,
      callerIndex: site.callerIndex ?? statements[statementIndex]?.callableIndex ?? mainIndex,
      ...upgradeCallSiteKind(site.kind),
      ...(site.calleeIndex !== undefined ? { calleeIndex: site.calleeIndex } : {}),
      moreCallsFollow: !!site.moreCallsFollow,
      order: site.order ?? 0
    });
  }
  callSites.sort((a, b) => a.returnAddress - b.returnAddress);

  const variables = adaptVariables(ext.variables ?? [], frames, partitionOf, dropped);
  const symbols = mapSymbols(input.map);
  const codebank = adaptCodebank(ext.codebank, input.arch, input.map, input.image, dropped);

  // --- Address maps: every byte a statement's or glue (-1), resident and per partition
  const addressMap = (list: StatementDebugInfo[]) => {
    const map: [number, number][] = [];
    const push = (address: number, index: number) => {
      const last = map[map.length - 1];
      if (last && last[0] === address) last[1] = index;
      else if (!last || last[1] !== index) map.push([address, index]);
    };
    push(0, -1);
    for (const s of list) {
      push(s.startAddress, s.index);
      push(s.endAddress, -1);
    }
    return map;
  };
  const partitions = [...new Set(statements.flatMap((s) => (s.partition !== undefined ? [s.partition] : [])))].sort((a, b) => a - b);
  const libraryFiles = files.flatMap((_, i) => (isLibrary(i) ? [i] : []));

  const sourceLevelDebug: SourceLevelDebugInfo = {
    language: "basic",
    files: files.map((filename, index) => ({ index, filename })),
    statements,
    callables,
    addressToStatement: addressMap(statements.filter((s) => s.partition === undefined)),
    ...(partitions.length
      ? {
          usesBanking: true,
          partitionedAddressMap: partitions.map((partition) => ({
            partition,
            addressToStatement: addressMap(statements.filter((s) => s.partition === partition))
          }))
        }
      : {}),
    extensions: {
      variables,
      callSites,
      frames,
      mainBaselineSymbol: ext.mainBaselineSymbol ?? 0,
      labels: symbols.labels,
      libraryFiles,
      runtimeSymbols: symbols.runtimeSymbols,
      ...(symbols.errorEntry !== undefined
        ? { errorStop: { entry: symbols.errorEntry, code: { register: "a" as const }, reports: "zx-rom" as const } }
        : {}),
      ...(codebank ? { codebank } : {}),
      optimizationLevel: input.optimizationLevel
    }
  };
  return {
    ...classicTables(sourceLevelDebug, libraryFiles),
    sourceLevelDebug,
    problems: validateSourceLevel(sourceLevelDebug),
    dropped
  };
}

/**
 * The classic tables, from the statements: one list item per statement and a source map entry at
 * its start, for the user's files (the library's code is treated like the runtime's). Breakpoints
 * and the execution point work from these even without source stepping.
 */
export function classicTables(sld: SourceLevelDebugInfo, libraryFiles: number[]): ClassicDebugTables {
  const library = new Set(libraryFiles);
  const fileOrder: number[] = [];
  const classicIndex = (fileIndex: number) => {
    let i = fileOrder.indexOf(fileIndex);
    if (i < 0) {
      i = fileOrder.length;
      fileOrder.push(fileIndex);
    }
    return i;
  };
  const listFileItems: ListFileItem[] = [];
  const sourceMap: Record<number, FileLine> = {};
  for (const s of sld.statements) {
    if (library.has(s.fileIndex)) continue;
    const fileIndex = classicIndex(s.fileIndex);
    listFileItems.push({
      fileIndex,
      address: s.startAddress,
      lineNumber: s.startLine,
      segmentIndex: 0,
      codeLength: s.endAddress - s.startAddress,
      ...(s.partition !== undefined ? { partition: s.partition } : {})
    });
    if (sourceMap[s.startAddress] === undefined) {
      sourceMap[s.startAddress] = {
        fileIndex,
        line: s.startLine,
        startColumn: s.startColumn,
        ...(s.endLine === s.startLine ? { endColumn: s.endColumn } : {})
      };
    }
  }
  listFileItems.sort((a, b) => a.fileIndex - b.fileIndex || a.lineNumber - b.lineNumber || a.address - b.address);
  return {
    sourceFileList: fileOrder.map((i) => ({ filename: sld.files[i].filename, includes: [] as [] })),
    sourceMap,
    listFileItems
  };
}

/**
 * The structural checks the converted data must pass (plan §5): sorted, non-overlapping statements
 * inside their routines, and every index pointing somewhere. A non-empty answer means stepping over
 * and out could go wrong (B4 then falls back to stopping at every statement).
 */
export function validateSourceLevel(sld: SourceLevelDebugInfo): string[] {
  const problems: string[] = [];
  const { statements, callables } = sld;
  const ext = sld.extensions;
  statements.forEach((s, i) => {
    if (s.index !== i) problems.push(`statement ${i} has index ${s.index}`);
    if (s.endAddress <= s.startAddress) problems.push(`statement ${i} is empty ($${hex(s.startAddress)})`);
    if (!sld.files[s.fileIndex]) problems.push(`statement ${i} names file ${s.fileIndex}`);
    if (!callables[s.callableIndex]) problems.push(`statement ${i} names routine ${s.callableIndex}`);
    const prev = statements[i - 1];
    if (prev && prev.partition === s.partition) {
      if (prev.startAddress > s.startAddress) problems.push(`statements ${i - 1} and ${i} are out of order`);
      if (prev.endAddress > s.startAddress) problems.push(`statements ${i - 1} and ${i} overlap`);
    }
    const frame = ext?.frames[s.callableIndex];
    if (frame && frame.convention !== "entrypoint" && (s.startAddress < frame.bodyStart || s.startAddress >= frame.endAddress)) {
      problems.push(`statement ${i} ($${hex(s.startAddress)}) lies outside routine ${callables[s.callableIndex]?.name}`);
    }
  });
  callables.forEach((c, i) => {
    if (c.index !== i) problems.push(`routine ${i} has index ${c.index}`);
  });
  if (ext) {
    if (ext.frames.length !== callables.length) problems.push(`${ext.frames.length} frames for ${callables.length} routines`);
    ext.callSites.forEach((site) => {
      if (!statements[site.statementIndex]) problems.push(`call site $${hex(site.returnAddress)} names statement ${site.statementIndex}`);
      if (site.calleeIndex !== undefined && !callables[site.calleeIndex]) problems.push(`call site $${hex(site.returnAddress)} names routine ${site.calleeIndex}`);
      if (!callables[site.callerIndex]) problems.push(`call site $${hex(site.returnAddress)} has caller ${site.callerIndex}`);
    });
    if (!ext.mainBaselineSymbol) problems.push("no main baseline symbol");
  }
  return problems;
}

function adaptVariables(
  raw: any[],
  frames: CallableFrameInfo[],
  partitionOf: (partition: number | undefined, address: number) => number | undefined,
  dropped: string[]
): VariableDebugInfo[] {
  const out: VariableDebugInfo[] = [];
  for (const v of raw) {
    const valueType = VALUE_TYPES[v.type ?? v.array?.elementType];
    if (!valueType) {
      dropped.push(`variable ${v.displayName ?? v.name}: unknown type ${v.type}`);
      continue;
    }
    const scope = v.scope === "global" || v.scope === undefined ? ("global" as const) : { callableIndex: v.scope.callableIndex };
    const frame = scope === "global" ? undefined : frames[scope.callableIndex];
    let location: VariableDebugInfo["location"];
    if (v.location?.at === "absolute") {
      const partition = partitionOf(v.bank, v.location.address);
      location = { at: "absolute", address: v.location.address, ...(partition !== undefined ? { partition } : {}) };
    } else if (v.location?.at === "frame") {
      // --- A FASTCALL routine has no frame: its parameter's IX offset reads the caller's frame (B0, V6)
      if (frame?.convention !== "frame") {
        dropped.push(`variable ${v.displayName ?? v.name}: in a routine without a frame`);
        continue;
      }
      location = { at: "frame", ixOffset: v.location.ixOffset };
    } else {
      dropped.push(`variable ${v.displayName ?? v.name}: unknown location`);
      continue;
    }
    let array: VariableDebugInfo["array"];
    if (v.array) {
      const dimensions = Array.isArray(v.array.dimensions)
        ? v.array.dimensions.map(([lower, upper]: [number, number]) => ({ lower, upper }))
        : undefined;
      // --- A local array with no constant bounds is dynamic: its slot points to a heap block of unknown shape
      if (!dimensions && v.kind !== "parameter") {
        dropped.push(`variable ${v.displayName ?? v.name}: a dynamic array`);
        continue;
      }
      const element = VALUE_TYPES[v.array.elementType] ?? valueType;
      array = { elementType: element.type, elementLabel: element.typeLabel, layout: "descriptor", ...(dimensions ? { dimensions } : {}) };
    }
    out.push({
      name: v.name,
      displayName: v.displayName ?? v.name,
      ...valueType,
      kind: v.kind === "parameter" || v.kind === "local" ? v.kind : "global",
      ...(v.byRef ? { byRef: true } : {}),
      location,
      ...(array ? { array } : {}),
      scope,
      declaredAt: { fileIndex: v.declaredAt?.fileIndex ?? 0, line: v.declaredAt?.line ?? 1, column: 0 }
    });
  }
  return out;
}

/**
 * Column fixes (B0): an indented statement starts at its first non-blank; a PRINT ends where its
 * text does (before the next top-level `:`, a comment or the line's end), not after its first item.
 */
function correctColumns(s: any, lines: string[] | undefined): { start: number; end: number } {
  const line = lines?.[s.startLine - 1];
  if (line === undefined) return { start: s.startColumn, end: s.endColumn };
  let start = s.startColumn;
  while (start < line.length && (line[start] === " " || line[start] === "\t")) start++;
  let end = s.endColumn;
  if (s.endLine === s.startLine && /^print\b/i.test(line.slice(start))) {
    end = Math.max(end, segmentEnd(line, start));
  }
  if (s.endLine === s.startLine && end <= start) end = segmentEnd(line, start);
  return { start, end };
}

/** Where the statement starting at `from` ends: the next `:` or `'` outside a string, or the trimmed line end. */
function segmentEnd(line: string, from: number): number {
  let inString = false;
  let end = line.length;
  for (let i = from; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inString = !inString;
    else if (!inString && (ch === ":" || ch === "'")) {
      end = i;
      break;
    }
  }
  while (end > from && /\s/.test(line[end - 1])) end--;
  return end;
}

/** The opcodes of CALL nn and CALL cc,nn. */
const CALL_OPCODES = new Set([0xcd, 0xc4, 0xcc, 0xd4, 0xdc, 0xe4, 0xec, 0xf4, 0xfc]);

/**
 * A return address is the address after a CALL. When the image shows no CALL ending at `address`
 * but one ending a byte earlier, zxbc's off-by-one (FUNCTION calls, B3) is corrected.
 */
function correctReturnAddress(address: number, image: DbgAdapterInput["image"]): number {
  if (!image) return address;
  const byteAt = (a: number) => (a >= image.origin && a < image.origin + image.bytes.length ? image.bytes[a - image.origin] : undefined);
  const callAt = (returnAddress: number) => CALL_OPCODES.has(byteAt(returnAddress - 3) ?? -1);
  if (!callAt(address - 1)) return address;
  // --- The defect's own shape: a CALL ending one byte earlier, then the PUSH zxbc counted. An address
  // --- byte of that CALL can look like a CALL opcode itself (`$FC` is CALL M), so the PUSH decides.
  return PUSH_OPCODES.has(byteAt(address - 1) ?? -1) || !callAt(address) ? address - 1 : address;
}

/** `PUSH BC/DE/HL/AF` */
const PUSH_OPCODES = new Set([0xc5, 0xd5, 0xe5, 0xf5]);

function entrypointIndex(callables: any[]): number {
  return callables.find((c) => c.kind === "entrypoint")?.index ?? Math.max(0, callables.length - 1);
}

function hex(n: number): string {
  return (n ?? 0).toString(16).toUpperCase().padStart(4, "0");
}
