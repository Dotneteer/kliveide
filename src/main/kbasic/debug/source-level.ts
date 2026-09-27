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
  SourceValueType,
  VariableDebugInfo,
  VariableDebugLocation
} from "@abstractions/SourceDebugInfo";
import type { EmittedProgram } from "../backend/emit";
import type { MFunction, MModule, MType } from "../ir/mir";
import { globalName } from "../ir/lower";
import * as f40 from "../semantics/float40";
import type { ArraySymbol, ConstSymbol, Scope, Symbol as KSymbol, VariableSymbol } from "../semantics/symbols";
import type { KType } from "../semantics/types";
import type { Span } from "../diagnostics";
import type { SourceSet } from "../syntax/source";
import type { StatementAddresses } from "./builder";
import { isLibraryPath } from "../stdlib";

/**
 * The source-level tables (`.docs/kbasic-debug-builder.md` §4): `SourceLevelDebugInfo` and its
 * extensions (plan §8.4), which source stepping, the call stack and the Variables panel read.
 *
 * The user's statements and the standard library's are statements here; the DATA table's code
 * (which READ calls) counts as runtime. Library files come after the user's and are listed in
 * `libraryFiles`: Just My Code (plan §10.12) runs through their statements unless it is turned off.
 * Library routines are callables flagged `library`.
 */
export type SourceLevelInput = {
  mir: MModule;
  emitted: EmittedProgram;
  /** The assembler's list items; those of the generated program have `programFileIndex`. */
  listFileItems: ListFileItem[];
  programFileIndex: number;
  sources: SourceSet;
  addresses: StatementAddresses[];
  /** An assembler symbol's address (`_main`, `_f`, `core.ProgramSP`), or undefined. */
  symbol: (name: string) => number | undefined;
  runtimeSymbols: { name: string; address: number }[];
  globals: Scope;
  isLibraryFile: (fileIndex: number) => boolean;
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
    return !!s && mir.functions[s.functionIndex].kind !== "data" && !input.isLibraryFile(s.span.file);
  };
  const debuggableStatement = (sid: number) => {
    const s = statementOf.get(sid);
    return !!s && mir.functions[s.functionIndex].kind !== "data";
  };
  for (const a of input.addresses) {
    if (!a.elided && userStatement(a.sid)) fileIndex(locate(sources, statementOf.get(a.sid)!.span.start, statementOf.get(a.sid)!.span.file).fileName);
  }
  const at = (span: Span) => {
    const start = locate(sources, span.start, span.file);
    const end = locate(sources, Math.max(span.start, span.end), span.file);
    return { fileIndex: fileIndex(start.fileName), start, end };
  };

  // --- Callables: every function but the DATA table's
  const callableOf = new Map<number, number>();
  const functions: { fn: MFunction; index: number }[] = [];
  mir.functions.forEach((fn, index) => {
    if (fn.kind === "data" || fn.removed) return;
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

  // --- Call sites: every line with a call-site record (READ's call of the DATA table is runtime)
  const callSites: CallSiteDebugInfo[] = [];
  const callTargets = new Map<number, number[]>();
  emitted.lines.forEach((info, i) => {
    const site = info.site;
    if (!site || site.kind === "read") return;
    const item = byLine.get(i + 1);
    // --- The calling routine: the statement's, or for shared code (-2: the rest of a statement an
    // --- inlined call split, level 3) the routine whose lines hold the call
    const functionIndex = statementOf.get(info.sid)?.functionIndex ?? emitted.functionLines.findIndex((r) => r && i + 1 >= r.start && i + 1 < r.end);
    if (!item || functionIndex < 0) return;
    const caller = { functionIndex };
    const calleeIndex = site.callee !== undefined && (site.kind === "sub" || site.kind === "function") ? calleeByName.get(site.callee) : undefined;
    const statementIndex = sidToIndex.get(info.sid) ?? -1;
    const partition = input.partitionOf?.(item);
    callSites.push({
      returnAddress: item.address + (item.codeLength ?? 0),
      ...(partition !== undefined ? { partition } : {}),
      statementIndex,
      callerIndex: callableOf.get(caller.functionIndex) ?? 0,
      kind: site.kind,
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
    const bodyStart = fn.kind === "main" ? first : (markerCode("prologue.end") ?? first);
    const epilogueStart = fn.kind === "main" ? endAddress : (markerCode("epilogue.begin") ?? endAddress);
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
    const kind: CallableKind = fn.kind === "main" ? "entrypoint" : fn.kind === "function" ? "function" : "subroutine";
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
      convention: fn.kind === "main" ? "entrypoint" : "frame",
      ...(fn.kind === "main" ? {} : { returnSlotOffset: 2 * Math.ceil(fn.frameSize / 2) + 2, argBytes: fn.argBytes }),
      startAddress: first,
      bodyStart,
      epilogueStart,
      endAddress,
      ...inPartition,
      ...(fn.returnType ? { returnType: valueTypeOfMType(fn.returnType) } : {}),
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
  const errorEntry = input.symbol("core.RaiseError");
  // --- Labels, from their definitions in the generated text (`_label.<name>:`)
  const labels = text
    .flatMap((line) => {
      const m = /^_label\.([^\s:]+):/.exec(line);
      const address = m ? input.symbol(`_label.${m[1]}`) : undefined;
      return m && address !== undefined ? [{ name: m[1], address }] : [];
    })
    .sort((a, b) => a.address - b.address);
  return {
    language: "basic",
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
      libraryFiles: files.flatMap((name, index) => (isLibraryPath(name) ? [index] : [])),
      runtimeSymbols: input.runtimeSymbols,
      ...(errorEntry !== undefined ? { errorEntry } : {}),
      ...(input.codebank ? { codebank: input.codebank } : {}),
      optimizationLevel: input.optimizationLevel
    }
  };
}

function locate(sources: SourceSet, offset: number, file: number) {
  return sources.get(file).location(offset);
}

// =================================================================================================
// Variables

type At = (span: Span) => { fileIndex: number; start: { line: number; column: number } };

function buildVariables(input: SourceLevelInput, functions: { fn: MFunction }[], at: At): VariableDebugInfo[] {
  const out: VariableDebugInfo[] = [];
  const declaredAt = (span: Span) => {
    const { fileIndex, start } = at(span);
    return { fileIndex, line: start.line, column: start.column };
  };
  const displayName = (symbol: KSymbol) => {
    const text = input.sources.get(symbol.span.file).text.slice(symbol.span.start, symbol.span.end);
    return /^[A-Za-z_]\w*[$%]$/.test(text) && text.slice(0, -1) === symbol.name ? text : symbol.name;
  };

  for (const symbol of input.globals.symbols) {
    if (input.isLibraryFile(symbol.span.file)) continue;
    if (symbol.kind === "const") {
      const value = constantValue(symbol);
      if (value === undefined) continue;
      out.push({
        name: symbol.name,
        displayName: displayName(symbol),
        type: valueTypeOf(symbol.type),
        kind: "constant",
        location: { at: "constant", value },
        scope: "global",
        declaredAt: declaredAt(symbol.span)
      });
      continue;
    }
    if (symbol.kind !== "variable" && symbol.kind !== "array") continue;
    if (symbol.storage !== "global") continue;
    const address = globalAddress(input, symbol);
    if (address === undefined) continue;
    out.push({
      name: symbol.name,
      displayName: displayName(symbol),
      type: valueTypeOf(symbol.kind === "array" ? symbol.elementType : symbol.type),
      kind: "global",
      location: { at: "absolute", address, ...bankPartition(input.codebank, symbol.bank, address) },
      ...(symbol.kind === "array" ? { array: arrayInfo(symbol) } : {}),
      scope: "global",
      declaredAt: declaredAt(symbol.span),
      ...(symbol.bank ? { bank: symbol.bank } : {})
    });
  }

  functions.forEach(({ fn }, callableIndex) => {
    for (const v of fn.vars ?? []) {
      const { symbol } = v;
      const location: VariableDebugLocation = { at: "frame", ixOffset: v.offset };
      out.push({
        name: symbol.name,
        displayName: displayName(symbol),
        type: valueTypeOf(symbol.kind === "array" ? symbol.elementType : symbol.type),
        kind: v.param ? "parameter" : "local",
        ...(v.byref ? { byRef: true } : {}),
        location,
        ...(symbol.kind === "array" ? { array: arrayInfo(symbol) } : {}),
        scope: { callableIndex },
        declaredAt: declaredAt(symbol.span)
      });
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

function globalAddress(input: SourceLevelInput, symbol: VariableSymbol | ArraySymbol): number | undefined {
  const at = symbol.at?.value;
  if (at?.kind === "int") return Number(at.value) & 0xffff;
  if (at?.kind === "address") {
    const base = input.symbol(at.symbol.startsWith("array:") ? `${globalName(at.symbol.slice(6))}.data` : globalName(at.symbol));
    return base === undefined ? undefined : (base + at.offset) & 0xffff;
  }
  return input.symbol(globalName(symbol.name));
}

function arrayInfo(symbol: ArraySymbol): NonNullable<VariableDebugInfo["array"]> {
  return {
    elementType: valueTypeOf(symbol.elementType),
    ...(symbol.bounds.length ? { dimensions: symbol.bounds.map((b) => ({ lower: b.lower, upper: b.upper })) } : {})
  };
}

function constantValue(symbol: ConstSymbol): number | string | undefined {
  const v = symbol.value.value;
  switch (v.kind) {
    case "int":
      return Number(v.value);
    case "fixed":
      return v.raw / 65536;
    case "float":
      return f40.toNumber(v.value);
    case "string":
      return v.value;
    default:
      return undefined;
  }
}

const VALUE_TYPES: Partial<Record<KType, SourceValueType>> = {
  Byte: "byte",
  UByte: "ubyte",
  Integer: "integer",
  UInteger: "uinteger",
  Long: "long",
  ULong: "ulong",
  Fixed: "fixed",
  Float: "float",
  String: "string",
  Boolean: "boolean"
};

function valueTypeOf(type: KType): SourceValueType {
  return VALUE_TYPES[type] ?? "float";
}

function valueTypeOfMType(type: MType): SourceValueType {
  const map: Record<MType, SourceValueType> = {
    i8: "byte",
    u8: "ubyte",
    i16: "integer",
    u16: "uinteger",
    i32: "long",
    u32: "ulong",
    fix: "fixed",
    flt: "float",
    str: "string",
    bool: "boolean",
    ptr: "uinteger"
  };
  return map[type];
}
