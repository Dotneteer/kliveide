import fs from "fs";
import path from "path";

import type {
  CallableDebugInfo,
  CallableKind,
  SourceLevelDebugInfo,
  StatementDebugInfo
} from "@abstractions/CompilerInfo";
import type {
  CallSiteDebugInfo,
  CallableFrameInfo,
  SourceValueType,
  VariableDebugInfo
} from "@abstractions/SourceDebugInfo";

import { mapValue, unescapeMapName, type Z88dkLineDebug, type Z88dkMapSymbol } from "./z88dk-map";

/*
 * Map + CDB records + image → `SourceLevelDebugInfo` with `language: "c"` (`.plans/Z88DK_INTEGRATION_PLAN.md`
 * §8, phase Z5). Everything comes from zcc's output, as `.ai/z88dk/cdb-records.md` records it:
 *
 * - statements: one per address the line records give (the lowest line at a shared address);
 * - callables: the startup code (the entry point, no statements) and each C function of the project;
 * - frames: sccz80's debug frame pointer is the word `__debug_framepointer`, with an IX frame's layout
 *   (`framePointerAddress`); a function's frame is up from its first instruction's end
 *   (`call l_debug_push_frame`) to its `call l_debug_pop_frame`;
 * - call sites: the `call` instructions to the project's functions, found by decoding each function's
 *   code, plus the startup code's `call _main`;
 * - variables: the CDB `S` records - globals at their map address, parameters and locals at their
 *   frame offset - for the scalar types (char, int, long, signed and unsigned) and pointers.
 *
 * Banked functions, floats, structs and arrays are not described (the problems list says so): their
 * lines still take breakpoints through the list items.
 */

export type Z88dkDebugAdapterInput = {
  symbols: Z88dkMapSymbol[];
  lineDebug: Z88dkLineDebug;
  cwd: string;
  isProjectFile: (absolutePath: string) => boolean;
  partitionOf: (bank: number, address: number) => number;
  image: Uint8Array;
  origin: number;
  /** Reads a source file (for the statements' end columns); the file system by default. */
  readFile?: (file: string) => string | undefined;
};

export type Z88dkDebugAdapterOutput = {
  sourceLevelDebug: SourceLevelDebugInfo;
  /** What the data leaves out (undecoded variables, banked functions): notes for the build output. */
  problems: string[];
  /** Structural checks the data failed (`validateZ88dkSourceLevel`): stepping may stop in the wrong place. */
  invalid: string[];
};

/** A function the adapter describes. */
type CFunction = {
  name: string;
  /** Its first code byte (its label). */
  start: number;
  end: number;
  kind: CallableKind;
  fileIndex: number;
  bodyStart: number;
  epilogueStart: number;
  exits: number[];
  callableIndex: number;
};

export function adaptZ88dkDebugInfo(input: Z88dkDebugAdapterInput): Z88dkDebugAdapterOutput | undefined {
  const { symbols, lineDebug, image, origin } = input;
  const problems: string[] = [];
  const pushFrame = mapValue(symbols, "l_debug_push_frame");
  const popFrame = mapValue(symbols, "l_debug_pop_frame");
  const framePointer = mapValue(symbols, "__debug_framepointer");
  // --- Without sccz80's debug frames (an SDCC build, a build without -debug) there is nothing to read
  if (pushFrame === undefined || popFrame === undefined || framePointer === undefined) return undefined;
  if (lineDebug.listFileItems.some((item) => item.partition !== undefined)) {
    problems.push("banked functions are not described at source level; their lines take breakpoints");
  }

  const byte = (address: number) => image[(address - origin) & 0xffff] ?? 0;
  const inImage = (address: number) => address >= origin && address < origin + image.length;
  const records = cdbRecords(symbols);
  const fileIndexOf = (file: string) => lineDebug.sourceFileList.findIndex((f) => f.filename === file);

  // ─── Functions: the project's C function symbols in the image, in address order ──────────────
  const codeTail = mapValue(symbols, "__code_compiler_tail");
  const candidates = symbols
    .filter((s) => s.kind === "addr" && /^_[A-Za-z_]\w*$/.test(s.name) && s.section.startsWith("code_compiler") && s.value <= 0xffff)
    .map((s) => ({ symbol: s, location: parseFunctionLocation(s.location) }))
    .filter((c) => c.location && c.location.func === c.symbol.name.slice(1))
    .map((c) => ({ ...c, file: path.resolve(input.cwd, c.location!.file).replaceAll("\\", "/") }))
    .filter((c) => input.isProjectFile(c.file) && inImage(c.symbol.value))
    .sort((a, b) => a.symbol.value - b.symbol.value);
  if (candidates.length === 0) return undefined;

  const functions: CFunction[] = candidates.map((c, i) => {
    const start = c.symbol.value;
    const next = candidates[i + 1]?.symbol.value;
    const end = Math.min(next ?? codeTail ?? origin + image.length, origin + image.length);
    const name = c.symbol.name.slice(1);
    const pops = callsTo(byte, start, end, popFrame);
    const record = records.functions.get(name);
    return {
      name,
      start,
      end,
      kind: record?.returnsVoid ? "subroutine" : "function",
      fileIndex: Math.max(0, fileIndexOf(c.file)),
      // --- `call l_debug_push_frame` is the first instruction; the frame is up after it
      bodyStart: byte(start) === 0xcd && word(byte, start + 1) === pushFrame ? start + 3 : start,
      epilogueStart: pops.length ? pops[pops.length - 1] : end,
      // --- The `ret` after each `call l_debug_pop_frame`
      exits: pops.map((p) => p + 3).filter((p) => byte(p) === 0xc9),
      callableIndex: i + 1
    };
  });
  const functionAt = (address: number) => functions.find((f) => address >= f.start && address < f.end);
  const functionByName = new Map(functions.map((f) => [f.name, f]));

  // ─── Statements: one per recorded address in a function (lowest line first), address order ───
  const readFile = input.readFile ?? defaultReadFile;
  const lineLengths = new Map<number, string[]>();
  const lineLength = (fileIndex: number, line: number) => {
    if (!lineLengths.has(fileIndex)) {
      lineLengths.set(fileIndex, (readFile(lineDebug.sourceFileList[fileIndex]?.filename ?? "") ?? "").split(/\r?\n/));
    }
    return lineLengths.get(fileIndex)![line - 1]?.length ?? 0;
  };
  const byAddress = new Map<number, { fileIndex: number; line: number }>();
  for (const item of lineDebug.listFileItems) {
    // --- A function's opening line sits at its label, before `call l_debug_push_frame`: a statement
    // --- starts where the frame is up, so stepping into a function lands where its locals are readable
    const fn = item.partition === undefined ? functionAt(item.address) : undefined;
    if (!fn || item.address < fn.bodyStart) continue;
    const known = byAddress.get(item.address);
    if (!known || item.lineNumber < known.line) byAddress.set(item.address, { fileIndex: item.fileIndex, line: item.lineNumber });
  }
  const addresses = [...byAddress.keys()].sort((a, b) => a - b);
  const statements: StatementDebugInfo[] = addresses.map((address, index) => {
    const at = byAddress.get(address)!;
    const fn = functionAt(address)!;
    const nextAddress = addresses[index + 1];
    const endAddress = nextAddress !== undefined && nextAddress < fn.end ? nextAddress : fn.end;
    return {
      index,
      fileIndex: at.fileIndex,
      startLine: at.line,
      startColumn: 0,
      endLine: at.line,
      endColumn: lineLength(at.fileIndex, at.line),
      startAddress: address,
      endAddress,
      kind: "other",
      callableIndex: fn.callableIndex
    };
  });
  const statementAt = (address: number) => {
    let found = -1;
    for (const s of statements) {
      if (s.startAddress <= address && address < s.endAddress) found = s.index;
      if (s.startAddress > address) break;
    }
    return found;
  };

  // ─── Callables: the startup code, then the functions ──────────────────────────────────────────
  const callables: CallableDebugInfo[] = [
    {
      index: 0,
      name: "(startup)",
      kind: "entrypoint",
      fileIndex: 0,
      startLine: 1,
      endLine: 1,
      entryAddress: origin,
      exitAddresses: [],
      firstStatementIndex: 0,
      lastStatementIndex: -1
    },
    ...functions.map((f) => {
      const own = statements.filter((s) => s.callableIndex === f.callableIndex);
      return {
        index: f.callableIndex,
        name: f.name,
        kind: f.kind,
        fileIndex: f.fileIndex,
        startLine: own[0]?.startLine ?? 1,
        endLine: own[own.length - 1]?.endLine ?? 1,
        entryAddress: f.bodyStart,
        exitAddresses: f.exits,
        firstStatementIndex: own[0]?.index ?? 0,
        lastStatementIndex: own.length ? own[own.length - 1].index : -1
      } as CallableDebugInfo;
    })
  ];

  // ─── Call sites: calls of the project's functions, and the startup code's call of main ───────
  const callSites: CallSiteDebugInfo[] = [];
  for (const f of functions) {
    const calls = decodeCalls(byte, f.start, f.end).filter((c) => functions.some((g) => g.start === c.target));
    const perStatement = new Map<number, number>();
    for (const call of calls) {
      const statementIndex = statementAt(call.address);
      const order = perStatement.get(statementIndex) ?? 0;
      perStatement.set(statementIndex, order + 1);
      const callee = functions.find((g) => g.start === call.target)!;
      callSites.push({
        returnAddress: call.address + call.length,
        statementIndex,
        callerIndex: f.callableIndex,
        kind: "routine",
        ...(callee.kind === "subroutine" ? {} : { returnsValue: true as const }),
        calleeIndex: callee.callableIndex,
        moreCallsFollow: false,
        order
      });
    }
  }
  // --- A later call in the same statement makes the earlier one's return a return point
  for (const site of callSites) {
    site.moreCallsFollow = callSites.some((o) => o !== site && o.statementIndex === site.statementIndex && o.statementIndex >= 0 && o.order > site.order);
  }
  const main = functionByName.get("main");
  if (main) {
    const startupCall = decodeCalls(byte, origin, functions[0].start).find((c) => c.target === main.start);
    if (startupCall) {
      callSites.push({
        returnAddress: startupCall.address + startupCall.length,
        statementIndex: -1,
        callerIndex: 0,
        kind: "routine",
        ...(main.kind === "subroutine" ? {} : { returnsValue: true as const }),
        calleeIndex: main.callableIndex,
        moreCallsFollow: false,
        order: 0
      });
    } else {
      problems.push("the startup code's call of main was not found: the call stack ends at main");
    }
  }
  callSites.sort((a, b) => a.returnAddress - b.returnAddress);

  // ─── Variables ────────────────────────────────────────────────────────────────────────────────
  const variables: VariableDebugInfo[] = [];
  const localBytes = new Map<number, number>();
  for (const v of records.variables) {
    const type = cType(v.typeChain);
    if (!type) {
      problems.push(`${v.name}: ${v.typeChain} is not shown (floats, structs and arrays are not decoded)`);
      continue;
    }
    if (v.scope === "global" || v.scope === "file") {
      const address = symbols.find((s) => s.name === `_${v.name}` && s.kind === "addr" && s.value <= 0xffff)?.value;
      if (address === undefined) continue;
      variables.push({
        name: v.name,
        displayName: v.name,
        type: type.type,
        typeLabel: type.label,
        kind: "global",
        location: { at: "absolute", address },
        scope: "global",
        declaredAt: { fileIndex: 0, line: 1, column: 0 }
      });
      continue;
    }
    const fn = functionByName.get(v.func!);
    if (!fn || v.space !== "B") continue;
    if (v.offset < 0) localBytes.set(fn.callableIndex, Math.max(localBytes.get(fn.callableIndex) ?? 0, -v.offset));
    variables.push({
      name: v.name,
      displayName: v.name,
      type: type.type,
      typeLabel: type.label,
      kind: v.offset > 0 ? "parameter" : "local",
      location: { at: "frame", ixOffset: v.offset },
      scope: { callableIndex: fn.callableIndex },
      declaredAt: { fileIndex: fn.fileIndex, line: callables[fn.callableIndex].startLine, column: 0 }
    });
  }

  // ─── Frames ───────────────────────────────────────────────────────────────────────────────────
  const restoreSp = mapValue(symbols, "__restore_sp_onexit");
  const frames: CallableFrameInfo[] = [
    { callableIndex: 0, convention: "entrypoint", startAddress: origin, bodyStart: origin, epilogueStart: origin, endAddress: functions[0].start, library: true },
    ...functions.map((f) => ({
      callableIndex: f.callableIndex,
      convention: "frame" as const,
      // --- Statement entries' SP: below the saved frame pointer and every local the function declares
      returnSlotOffset: 2 + (localBytes.get(f.callableIndex) ?? 0),
      // --- sccz80's callers remove the arguments (`pop bc` after the call)
      argBytes: 0,
      startAddress: f.start,
      bodyStart: f.bodyStart,
      epilogueStart: f.epilogueStart,
      endAddress: f.end
    }))
  ];
  if (restoreSp === undefined) problems.push("the startup code keeps no entry SP (__restore_sp_onexit): the call stack ends at the innermost function");

  // ─── The address map: statements, and -1 for everything else ─────────────────────────────────
  const addressToStatement: [number, number][] = [[0, -1]];
  for (const f of functions) {
    for (const s of statements.filter((x) => x.callableIndex === f.callableIndex)) addressToStatement.push([s.startAddress, s.index]);
    addressToStatement.push([f.end, -1]);
  }
  addressToStatement.sort((a, b) => a[0] - b[0]);
  const deduped = addressToStatement.filter((pair, i, all) => i === all.length - 1 || all[i + 1][0] !== pair[0]);

  const sourceLevelDebug: SourceLevelDebugInfo = {
      language: "c",
      files: lineDebug.sourceFileList.map((f, index) => ({ index, filename: f.filename })),
      statements,
      callables,
      addressToStatement: deduped,
      extensions: {
        variables,
        callSites,
        frames,
        // --- The crt0 stores its entry SP into its own `ld sp,nn` (`.ai/z88dk/targets.md`)
        mainBaselineSymbol: restoreSp !== undefined ? restoreSp + 1 : 0,
        framePointerAddress: framePointer,
        runtimeSymbols: [],
        optimizationLevel: 0
      }
  };
  return { sourceLevelDebug, problems, invalid: validateZ88dkSourceLevel(sourceLevelDebug) };
}

/**
 * The structural checks the adapted data must pass, as Boriel's adapter checks its own: indexes that
 * point somewhere, sorted, non-overlapping statements inside their function's body, a frame per
 * callable, call sites naming real statements (or -1, the startup code's call of main) and callables.
 */
export function validateZ88dkSourceLevel(sld: SourceLevelDebugInfo): string[] {
  const problems: string[] = [];
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
  const { statements, callables } = sld;
  const ext = sld.extensions;
  statements.forEach((s, i) => {
    if (s.index !== i) problems.push(`statement ${i} has index ${s.index}`);
    if (s.endAddress <= s.startAddress) problems.push(`statement ${i} is empty ($${hex(s.startAddress)})`);
    if (!sld.files[s.fileIndex]) problems.push(`statement ${i} names file ${s.fileIndex}`);
    if (!callables[s.callableIndex]) problems.push(`statement ${i} names function ${s.callableIndex}`);
    const prev = statements[i - 1];
    if (prev && prev.startAddress >= s.startAddress) problems.push(`statements ${i - 1} and ${i} are out of order`);
    if (prev && prev.endAddress > s.startAddress) problems.push(`statements ${i - 1} and ${i} overlap`);
    const frame = ext?.frames[s.callableIndex];
    if (frame && frame.convention === "frame" && (s.startAddress < frame.bodyStart || s.endAddress > frame.endAddress)) {
      problems.push(`statement ${i} ($${hex(s.startAddress)}) lies outside function ${callables[s.callableIndex]?.name}`);
    }
  });
  callables.forEach((c, i) => {
    if (c.index !== i) problems.push(`function ${i} has index ${c.index}`);
  });
  if (ext) {
    if (ext.frames.length !== callables.length) problems.push(`${ext.frames.length} frames for ${callables.length} functions`);
    ext.callSites.forEach((site) => {
      if (site.statementIndex !== -1 && !statements[site.statementIndex]) {
        problems.push(`call site $${hex(site.returnAddress)} names statement ${site.statementIndex}`);
      }
      if (site.calleeIndex !== undefined && !callables[site.calleeIndex]) problems.push(`call site $${hex(site.returnAddress)} names function ${site.calleeIndex}`);
      if (!callables[site.callerIndex]) problems.push(`call site $${hex(site.returnAddress)} has caller ${site.callerIndex}`);
    });
  }
  return problems;
}

// ─── CDB records ──────────────────────────────────────────────────────────────────────────────

type CdbVariable = {
  scope: "global" | "file" | "local";
  file?: string;
  func?: string;
  name: string;
  typeChain: string;
  space: string;
  offset: number;
};

/** The `__CDBINFO__` records (`.ai/z88dk/cdb-records.md`): functions by name, and variables. */
export function cdbRecords(symbols: Z88dkMapSymbol[]): { functions: Map<string, { returnsVoid: boolean }>; variables: CdbVariable[] } {
  const functions = new Map<string, { returnsVoid: boolean }>();
  const variables: CdbVariable[] = [];
  for (const symbol of symbols) {
    if (!symbol.name.startsWith("__CDBINFO__")) continue;
    const text = unescapeMapName(symbol.name.slice("__CDBINFO__".length));
    const fn = /^F:(?:G|F[^$]*)\$([^$]+)\$\d+_\d+\$\d+\(\{\d+\}DF,([^)]*)\)/.exec(text);
    if (fn) {
      functions.set(fn[1], { returnsVoid: /^SV:/.test(fn[2]) });
      continue;
    }
    const v = /^S:(G|F([^$]*)|L([^$]*))\$([^$]+)\$\d+_\d+\$\d+\(\{\d+\}([^)]*)\),(\w),(\d+),(-?\d+)/.exec(text);
    if (!v) continue;
    const [, scopeTag, fileStatic, local, name, typeChain, space, , offset] = v;
    if (local !== undefined) {
      const dot = local.lastIndexOf(".");
      variables.push({ scope: "local", file: local.slice(0, dot), func: local.slice(dot + 1), name, typeChain, space, offset: Number(offset) });
    } else {
      variables.push({ scope: scopeTag === "G" ? "global" : "file", file: fileStatic, name, typeChain, space, offset: Number(offset) });
    }
  }
  return { functions, variables };
}

/** A CDB type chain as a value type and its C spelling; undefined for what Klive does not decode. */
export function cType(chain: string): { type: SourceValueType; label: string } | undefined {
  const parts = chain.split(",");
  if (parts[0] === "DG") {
    const target = parts.slice(1).join(",");
    return { type: "ptr16", label: `${baseLabel(target) ?? "void"} *` };
  }
  const m = /^S([CILV])(?:[^:]*)?:([SU])$/.exec(chain);
  if (!m) return undefined;
  const unsigned = m[2] === "U";
  switch (m[1]) {
    case "C":
      return unsigned ? { type: "u8", label: "unsigned char" } : { type: "char8", label: "char" };
    case "I":
      return unsigned ? { type: "u16", label: "unsigned int" } : { type: "i16", label: "int" };
    case "L":
      return unsigned ? { type: "u32", label: "unsigned long" } : { type: "i32", label: "long" };
    default:
      return undefined;
  }
}

function baseLabel(chain: string): string | undefined {
  if (chain.startsWith("DG,")) return `${baseLabel(chain.slice(3)) ?? "void"} *`;
  const st = /^ST(\w+):/.exec(chain);
  if (st) return `struct ${st[1]}`;
  if (/^SV:/.test(chain)) return "void";
  if (/^SF:/.test(chain)) return "float";
  return cType(chain)?.label;
}

function parseFunctionLocation(location: string): { file: string; func: string } | undefined {
  const m = /^(.*?)::([^:]*)::\d+::\d+:\d+$/.exec(location ?? "");
  return m ? { file: m[1], func: m[2] } : undefined;
}

// ─── Code decoding ────────────────────────────────────────────────────────────────────────────

function word(byte: (a: number) => number, address: number): number {
  return byte(address) | (byte(address + 1) << 8);
}

/** The addresses of `call target` instructions in [start, end). */
function callsTo(byte: (a: number) => number, start: number, end: number, target: number): number[] {
  return decodeCalls(byte, start, end).filter((c) => c.target === target).map((c) => c.address);
}

/**
 * The `call nn` and `call cc,nn` instructions of a code range, found by walking it instruction by
 * instruction (so an operand byte is never taken for an opcode).
 */
export function decodeCalls(byte: (a: number) => number, start: number, end: number): { address: number; length: number; target: number }[] {
  const calls: { address: number; length: number; target: number }[] = [];
  for (let pc = start; pc < end; ) {
    const op = byte(pc);
    if (op === 0xcd || (op & 0xc7) === 0xc4) calls.push({ address: pc, length: 3, target: word(byte, pc + 1) });
    pc += z80InstructionLength(byte, pc);
  }
  return calls;
}

/** The length of the Z80 instruction at `pc` (documented and undocumented opcodes). */
export function z80InstructionLength(byte: (a: number) => number, pc: number): number {
  const op = byte(pc);
  if (op === 0xcb) return 2;
  if (op === 0xed) {
    const e = byte(pc + 1);
    // --- ld (nn),rr / ld rr,(nn)
    return (e & 0xc7) === 0x43 ? 4 : 2;
  }
  if (op === 0xdd || op === 0xfd) {
    const x = byte(pc + 1);
    if (x === 0xcb) return 4;
    if (x === 0xdd || x === 0xfd || x === 0xed) return 1;
    if (x === 0x21 || x === 0x22 || x === 0x2a) return 4;
    if (x === 0x36) return 4;
    if (x === 0x34 || x === 0x35 || ((x & 0xc0) === 0x40 && (x & 0x07) === 0x06 && x !== 0x76) || ((x & 0xf8) === 0x70 && x !== 0x76) || ((x & 0xc0) === 0x80 && (x & 0x07) === 0x06)) {
      return 3;
    }
    return 1 + mainLength(x);
  }
  return mainLength(op);
}

/** The length of an unprefixed instruction. */
function mainLength(op: number): number {
  // --- 3 bytes: 16-bit immediates and addresses
  if ((op & 0xcf) === 0x01 || op === 0x22 || op === 0x2a || op === 0x32 || op === 0x3a) return 3;
  if ((op & 0xc7) === 0xc2 || op === 0xc3 || (op & 0xc7) === 0xc4 || op === 0xcd) return 3;
  // --- 2 bytes: 8-bit immediates, relative jumps, I/O ports
  if ((op & 0xc7) === 0x06 || (op & 0xc7) === 0xc6) return 2;
  if (op === 0x10 || op === 0x18 || op === 0x20 || op === 0x28 || op === 0x30 || op === 0x38) return 2;
  if (op === 0xd3 || op === 0xdb) return 2;
  return 1;
}

function defaultReadFile(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}
