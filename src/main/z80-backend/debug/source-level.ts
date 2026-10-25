import type {
  CallableDebugInfo,
  CallableKind,
  ListFileItem,
  SourceFileEntry,
  SourceLevelDebugInfo,
  StatementDebugInfo
} from "@abstractions/CompilerInfo";
import type {
  CallableFrameInfo,
  CallSiteDebugInfo,
  CodebankDebugInfo,
  ErrorStopInfo,
  VariableDebugInfo
} from "@abstractions/SourceDebugInfo";
import type { EmittedProgram } from "../emit/emit";
import type { CallSite, MFunction, MModule, MType, Span, VariableDescriptor } from "../mir/mir";
import { representationOf } from "../mir/representations";
import type { StatementAddresses } from "./builder";
import type { SourceFiles } from "./sources";

/**
 * The source-level tables (`.docs/z80-backend-debug-builder.md` §4): `SourceLevelDebugInfo` and its
 * extensions (plan §8.4), which source stepping, the call stack and the Variables panel read. It
 * reads the MIR, the emitted program, the assembler's listing and the front end's descriptors only:
 * no language's symbols or types (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.3).
 *
 * The user's statements and the language library's are statements here; a fragment's code (Klive
 * BASIC's DATA items, which READ calls) counts as runtime. Library files come after the user's and
 * are listed in `libraryFiles`: Just My Code (plan §10.12) runs through their statements unless it is
 * turned off. Library routines are callables flagged `library`.
 */
export type SourceLevelInput = {
  mir: MModule;
  emitted: EmittedProgram;
  /** The assembler's list items; those of the generated program have `programFileIndex`. */
  listFileItems: ListFileItem[];
  programFileIndex: number;
  sources: SourceFiles;
  addresses: StatementAddresses[];
  /** An assembler symbol's address (`_main`, `_f`, `core.ProgramSP`), or undefined. */
  symbol: (name: string) => number | undefined;
  runtimeSymbols: { name: string; address: number }[];
  /** The source language (`SourceLevelDebugInfo.language`): the debugger's plugin for it. */
  language: string;
  /** A source file (by index) of the language's own library. */
  isLibraryFile: (fileIndex: number) => boolean;
  /** A reported file name of the language's own library. */
  isLibraryFileName: (name: string) => boolean;
  /** The language's run-time error stop: the routine its errors go through, by symbol, and how they are named. */
  errorStop?: { symbol: string; code: ErrorStopInfo["code"]; reports: ErrorStopInfo["reports"] };
  /** The prefix of the labels the language gives its source labels and line numbers (`_label.` in Klive BASIC). */
  sourceLabelPrefix?: string;
  optimizationLevel: number;
  /** CODEBANK: the 8K page a list item's code lives in (undefined: resident), and the far-call runtime. */
  partitionOf?: (item: ListFileItem) => number | undefined;
  codebank?: CodebankDebugInfo;
};

export function buildSourceLevel(input: SourceLevelInput): SourceLevelDebugInfo {
  const { mir, emitted, sources } = input;
  const text = emitted.text.split("\n");
  const byLine = new Map<number, ListFileItem>();
  for (const item of input.listFileItems) {
    if (item.fileIndex === input.programFileIndex && (item.codeLength ?? 0) > 0) byLine.set(item.lineNumber, item);
  }
  const codeAfter = (line: number, end: number): ListFileItem | undefined => {
    for (let n = line + 1; n < end; n++) {
      const item = byLine.get(n);
      if (item) return item;
    }
    return undefined;
  };

  // --- Files: the user's in the order the classic tables list them (same indices), then the library's
  const files: string[] = [];
  const fileIndex = (name: string) => {
    let i = files.indexOf(name);
    if (i < 0) {
      i = files.length;
      files.push(name);
    }
    return i;
  };
  const statementOf = new Map(mir.statements.map((s) => [s.sid, s]));
  const userStatement = (sid: number) => {
    const s = statementOf.get(sid);
    return !!s && mir.functions[s.functionIndex].kind !== "fragment" && !input.isLibraryFile(s.span.file);
  };
  const debuggableStatement = (sid: number) => {
    const s = statementOf.get(sid);
    return !!s && mir.functions[s.functionIndex].kind !== "fragment";
  };
  for (const a of input.addresses) {
    if (!a.elided && userStatement(a.sid)) fileIndex(locate(sources, statementOf.get(a.sid)!.span.start, statementOf.get(a.sid)!.span.file).fileName);
  }
  const at = (span: Span) => {
    const start = locate(sources, span.start, span.file);
    const end = locate(sources, Math.max(span.start, span.end), span.file);
    return { fileIndex: fileIndex(start.fileName), start, end };
  };

  // --- Callables: every function but fragments
  const callableOf = new Map<number, number>();
  const functions: { fn: MFunction; index: number }[] = [];
  mir.functions.forEach((fn, index) => {
    if (fn.kind === "fragment" || fn.removed) return;
    callableOf.set(index, functions.length);
    functions.push({ fn, index });
  });
  const calleeByName = new Map(functions.map((f, i) => [f.fn.name, i]));

  // --- Statements, sorted by entry address
  const sidToIndex = new Map<number, number>();
  const rows = input.addresses
    .filter((a) => !a.elided && debuggableStatement(a.sid))
    .sort((x, y) => x.start - y.start || (x.partition ?? -1) - (y.partition ?? -1))
    .map((a, index) => {
      sidToIndex.set(a.sid, index);
      return { a, index };
    });

  // --- Call sites: every line with a call-site record (one the front end marks `runtime` is not the user's)
  const callSites: CallSiteDebugInfo[] = [];
  const callTargets = new Map<number, number[]>();
  emitted.lines.forEach((info, i) => {
    const site = info.site;
    if (!site || site.kind === "runtime") return;
    const item = byLine.get(i + 1);
    // --- The calling routine: the statement's, or for shared code (-2: the rest of a statement an
    // --- inlined call split, level 3) the routine whose lines hold the call
    const functionIndex = statementOf.get(info.sid)?.functionIndex ?? emitted.functionLines.findIndex((r) => r && i + 1 >= r.start && i + 1 < r.end);
    if (!item || functionIndex < 0) return;
    const caller = { functionIndex };
    const calleeIndex = site.callee !== undefined && site.kind === "routine" ? calleeByName.get(site.callee) : undefined;
    const statementIndex = sidToIndex.get(info.sid) ?? -1;
    const partition = input.partitionOf?.(item);
    callSites.push({
      returnAddress: item.address + (item.codeLength ?? 0),
      ...(partition !== undefined ? { partition } : {}),
      statementIndex,
      callerIndex: callableOf.get(caller.functionIndex) ?? 0,
      ...callSiteKind(site),
      ...(calleeIndex !== undefined ? { calleeIndex } : {}),
      moreCallsFollow: site.moreCallsFollow,
      order: site.order
    });
    if (statementIndex >= 0 && calleeIndex !== undefined) {
      const list = callTargets.get(statementIndex) ?? [];
      if (!list.includes(calleeIndex)) list.push(calleeIndex);
      callTargets.set(statementIndex, list);
    }
  });
  callSites.sort((x, y) => x.returnAddress - y.returnAddress);

  const statements: StatementDebugInfo[] = rows.map(({ a, index }) => {
    const s = statementOf.get(a.sid)!;
    const { fileIndex: f, start, end } = at(s.span);
    const targets = callTargets.get(index);
    return {
      index,
      fileIndex: f,
      startLine: start.line,
      startColumn: start.column,
      endLine: end.line,
      endColumn: end.column,
      startAddress: a.start,
      endAddress: a.end,
      ...(a.partition !== undefined ? { partition: a.partition } : {}),
      kind: s.kind,
      callableIndex: callableOf.get(s.functionIndex) ?? 0,
      ...(targets ? { callTargets: targets } : {})
    };
  });

  // --- Callables and their frames
  const callables: CallableDebugInfo[] = [];
  const frames: CallableFrameInfo[] = [];
  functions.forEach(({ fn, index: fnIndex }, index) => {
    const range = emitted.functionLines[fnIndex];
    const items: ListFileItem[] = [];
    for (let n = range.start; n < range.end; n++) {
      const item = byLine.get(n);
      if (item) items.push(item);
    }
    const first = items[0]?.address ?? input.symbol(fn.label) ?? 0;
    const endAddress = items.reduce((m, item) => Math.max(m, item.address + (item.codeLength ?? 0)), first);
    const markerCode = (marker: "prologue.end" | "epilogue.begin") => {
      for (let n = range.start; n < range.end; n++) {
        if (emitted.lines[n - 1].marker === marker) return codeAfter(n, range.end)?.address;
      }
      return undefined;
    };
    const bodyStart = fn.kind === "entry" ? first : (markerCode("prologue.end") ?? first);
    const epilogueStart = fn.kind === "entry" ? endAddress : (markerCode("epilogue.begin") ?? endAddress);
    const exitAddresses: number[] = [];
    for (let n = range.start; n < range.end; n++) {
      const item = byLine.get(n);
      if (item && /^\s+ret\s*$/.test(text[n - 1] ?? "")) exitAddresses.push(item.address);
    }
    const own = statements.filter((s) => s.callableIndex === index);
    const library = fn.span !== undefined && input.isLibraryFile(fn.span.file);
    let fileIdx = own[0]?.fileIndex ?? 0;
    let startLine = own[0]?.startLine ?? 1;
    let endLine = own.reduce((m, s) => Math.max(m, s.endLine), startLine);
    if (fn.span) {
      const { fileIndex: f, start, end } = at(fn.span);
      fileIdx = f;
      startLine = start.line;
      endLine = end.line;
    }
    const kind: CallableKind = fn.kind === "entry" ? "entrypoint" : fn.returnType ? "function" : "subroutine";
    const partition = items[0] ? input.partitionOf?.(items[0]) : undefined;
    const inPartition = partition !== undefined ? { partition } : {};
    callables.push({
      index,
      name: fn.name,
      kind,
      ...inPartition,
      fileIndex: fileIdx,
      startLine,
      endLine,
      entryAddress: bodyStart,
      exitAddresses,
      firstStatementIndex: own.length ? own[0].index : -1,
      lastStatementIndex: own.length ? own[own.length - 1].index : -1
    });
    frames.push({
      callableIndex: index,
      convention: fn.kind === "entry" ? "entrypoint" : "frame",
      ...(fn.kind === "entry" ? {} : { returnSlotOffset: fn.naked ? 0 : 2 * Math.ceil(fn.frameSize / 2) + 2, argBytes: fn.argBytes }),
      startAddress: first,
      bodyStart,
      epilogueStart,
      endAddress,
      ...inPartition,
      ...(fn.returnType ? { returns: returnsOf(fn.returnType, fn.returnLabel) } : {}),
      ...(library ? { library: true } : {})
    });
  });

  // --- Every code byte: the statements' ranges, everything else runtime or glue (-1). Resident code
  // --- in addressToStatement, each CODEBANK page's in its own map (banks share the window's addresses)
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
  const addressToStatement = addressMap(statements.filter((s) => s.partition === undefined));
  const partitions = [...new Set(statements.flatMap((s) => (s.partition !== undefined ? [s.partition] : [])))].sort((a, b) => a - b);
  const banking = partitions.length
    ? {
        usesBanking: true,
        partitionedAddressMap: partitions.map((partition) => ({
          partition,
          addressToStatement: addressMap(statements.filter((s) => s.partition === partition))
        }))
      }
    : {};

  const variables = buildVariables(input, functions, at);
  const errorEntry = input.errorStop ? input.symbol(input.errorStop.symbol) : undefined;
  // --- Source labels, from their definitions in the generated text (`<prefix><name>:`)
  const prefix = input.sourceLabelPrefix;
  const labels = prefix
    ? text
        .flatMap((line) => {
          if (!line.startsWith(prefix)) return [];
          const m = /^([^\s:]+):/.exec(line.slice(prefix.length));
          const address = m ? input.symbol(`${prefix}${m[1]}`) : undefined;
          return m && address !== undefined ? [{ name: m[1], address }] : [];
        })
        .sort((a, b) => a.address - b.address)
    : [];
  return {
    language: input.language,
    files: [...files.map((filename, index): SourceFileEntry => ({ index, filename }))],
    statements,
    callables,
    addressToStatement,
    ...banking,
    extensions: {
      variables,
      callSites,
      frames,
      mainBaselineSymbol: input.symbol("core.ProgramSP") ?? 0,
      labels,
      libraryFiles: files.flatMap((name, index) => (input.isLibraryFileName(name) ? [index] : [])),
      runtimeSymbols: input.runtimeSymbols,
      ...(errorEntry !== undefined && input.errorStop ? { errorStop: { entry: errorEntry, code: input.errorStop.code, reports: input.errorStop.reports } } : {}),
      ...(input.codebank ? { codebank: input.codebank } : {}),
      optimizationLevel: input.optimizationLevel
    }
  };
}

function locate(sources: SourceFiles, offset: number, file: number) {
  return sources.get(file).location(offset);
}

// =================================================================================================
// Variables

type At = (span: Span) => { fileIndex: number; start: { line: number; column: number } };

/** The front end's descriptors as the debugger's variable table: storage becomes a location. */
function buildVariables(input: SourceLevelInput, functions: { fn: MFunction }[], at: At): VariableDebugInfo[] {
  const out: VariableDebugInfo[] = [];
  const declaredAt = (span: Span) => {
    const { fileIndex, start } = at(span);
    return { fileIndex, line: start.line, column: start.column };
  };
  const describe = (d: VariableDescriptor, scope: VariableDebugInfo["scope"]): VariableDebugInfo | undefined => {
    let location: VariableDebugInfo["location"];
    if ("constant" in d.storage) location = { at: "constant", value: d.storage.constant };
    else if ("frameOffset" in d.storage) location = { at: "frame", ixOffset: d.storage.frameOffset };
    else {
      // --- A label the assembler did not define is a variable the program does not keep
      const base = "address" in d.storage ? d.storage.address : input.symbol(d.storage.label);
      if (base === undefined) return undefined;
      const address = (base + ("offset" in d.storage ? (d.storage.offset ?? 0) : 0)) & 0xffff;
      location = { at: "absolute", address, ...bankPartition(input.codebank, d.bank, address) };
    }
    return {
      name: d.name,
      displayName: d.displayName,
      type: d.type,
      typeLabel: d.typeLabel,
      kind: d.kind,
      ...(d.byRef ? { byRef: true } : {}),
      location,
      ...(d.array ? { array: d.array } : {}),
      scope,
      declaredAt: declaredAt(d.declaredAt),
      ...(d.bank && scope === "global" ? { bank: d.bank } : {})
    };
  };
  for (const d of input.mir.globals ?? []) {
    const v = describe(d, "global");
    if (v) out.push(v);
  }
  functions.forEach(({ fn }, callableIndex) => {
    for (const d of fn.vars ?? []) {
      const v = describe(d, { callableIndex });
      if (v) out.push(v);
    }
  });
  return out;
}

/** CODEBANK: the 8K page holding a bank-local variable's first byte (`{}` for resident data). */
function bankPartition(codebank: CodebankDebugInfo | undefined, bank: number | undefined, address: number): { partition?: number } {
  const pages = bank ? codebank?.banks.find((b) => b.bank === bank)?.pages : undefined;
  const offset = codebank ? address - codebank.window : -1;
  if (!pages || !codebank || offset < 0 || offset >= codebank.windowSize) return {};
  return { partition: pages[offset >> 13] };
}

/** A result: the representation the debugger decodes, the language's name for its type, and the registers it is returned in. */
function returnsOf(type: MType, typeLabel: string | undefined): NonNullable<CallableFrameInfo["returns"]> {
  const repr = representationOf(type);
  return { type: repr.debug, typeLabel: typeLabel ?? repr.debug, in: repr.returnsIn };
}

/** A MIR call site in the debugger's vocabulary (a `local` call runs in its caller's activation). */
function callSiteKind(site: CallSite): Pick<CallSiteDebugInfo, "kind" | "dispatch" | "returnsValue"> {
  if (site.kind === "local") return { kind: "local", ...(site.dispatch ? { dispatch: true } : {}) };
  return { kind: "routine", ...(site.returnsValue ? { returnsValue: true } : {}) };
}
