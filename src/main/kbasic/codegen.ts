import type { ListFileItem, SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { CodebankDebugInfo } from "@abstractions/SourceDebugInfo";
import { MI_ZXNEXT } from "@common/machines/constants";
import { resolvedPartitionFor } from "@common/utils/source-breakpoint-partition";
import type { AssemblerOptions as AssemblerOptionsType } from "@main/compiler-common/assembler-in-out";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { ExpressionValue } from "@main/compiler-common/expressions";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import type { DiagnosticBag, Span } from "./diagnostics";
import { emitProgram, type EmittedProgram } from "./backend/emit";
import { CodegenError, type LirLine } from "./backend/lir";
import { selectFunction } from "./backend/select0";
import { buildDebugInfo, type DebugBuild } from "./debug/builder";
import { buildSourceLevel } from "./debug/source-level";
import { lowerProgram } from "./ir/lower";
import { optimizeLir, shapeBranches } from "./opt/pipeline";
import { optimizeMir } from "./opt/mir-passes";
import { verifyModule } from "./opt/verify";
import type { MModule } from "./ir/mir";
import type { KBasicOptions } from "./options/options";
import { prologueSource, resolveRuntimeModules, runtimeInitialisers, runtimeUnits } from "./runtime/runtime-linker";
import type { BindResult } from "./semantics/binder";
import { isLibraryPath } from "./stdlib";
import type { SourceSet } from "./syntax/source";

export type GeneratedProgram = {
  mir: MModule;
  emitted: EmittedProgram;
  /** The assembler's output for the program and its runtime closure. */
  output: Awaited<ReturnType<Z80Assembler["compileProgram"]>>;
  debug: DebugBuild & { sourceLevel: SourceLevelDebugInfo };
  entryAddress: number;
};

/**
 * Code generation (plan §3.1, Phase 3): the typed program becomes MIR, then level-0 Z80 code, then
 * a program the assembler builds together with the runtime modules it calls. Problems in the user's
 * program are reported to `diagnostics`; undefined means there was one.
 */
export async function generateProgram(
  bound: BindResult,
  sources: SourceSet,
  options: KBasicOptions,
  programName: string,
  diagnostics: DiagnosticBag
): Promise<GeneratedProgram | undefined> {
  const mir = lowerProgram(bound.program, bound.globals, diagnostics, (file) => isLibraryPath(sources.get(file).name), {
    bounds: options.checkBounds,
    breakKey: options.breakKey
  });
  if (diagnostics.hasErrors) return undefined;

  // --- Instruction selection adds the runtime routines it calls (multiply, divide, ...)
  const runtime = new Set(mir.runtime);
  // --- The level the code is generated at
  const level = effectiveLevel(options.optimize);
  // --- The MIR verifier (.docs/kbasic-optimiser.md §3): an optimised build checks its input first
  if (level >= 1) {
    const problems = verifyModule(mir, level);
    if (problems.length) {
      diagnostics.error("E599", `Internal code generator error: the MIR is invalid (${problems.slice(0, 3).join("; ")})`, { file: 0, start: 0, end: 0 });
      return undefined;
    }
    try {
      optimizeMir(mir, level);
    } catch (e) {
      diagnostics.error("E599", `Internal code generator error: ${(e as Error).message}`, { file: 0, start: 0, end: 0 });
      return undefined;
    }
  }
  let functions: LirLine[][] = [];
  try {
    for (const fn of mir.functions) functions.push(fn.removed ? [] : selectFunction(fn, runtime, level));
    functions = optimizeLir(mir, functions, { level, target: options.target === "next" ? "z80n" : "z80" });
  } catch (e) {
    if (!(e instanceof CodegenError)) throw e;
    diagnostics.error("E599", `Internal code generator error: ${e.message}`, { file: 0, start: 0, end: 0 });
    return undefined;
  }

  // --- CODEBANK (plan §9): where each bank goes, and the far-call runtime's parameters
  const banks = [...new Set([...mir.functions, ...mir.data].flatMap((x) => (x.bank ? [x.bank] : [])))].sort((a, b) => a - b);
  let banking: BankPlan | undefined;
  if (banks.length) {
    const span = mir.codebankSpan ?? { file: 0, start: 0, end: 0 };
    if (options.target !== "next") {
      diagnostics.error("E458", "CODEBANK needs the ZX Spectrum Next target (it pages banks in through the Next's MMU)", span);
      return undefined;
    }
    const plan = planBanks(banks, options);
    if (typeof plan === "string") {
      diagnostics.error("E457", plan, span);
      return undefined;
    }
    banking = plan;
  }

  // --- The Next's start stub reports errors through the errors module, which prints them
  const modules = resolveRuntimeModules(runtime, options.target === "next" ? ["program", "errors", "print"] : ["program"]);
  // --- Far memory (farmem.bas) links the far-call runtime without a bank of the program's own: it
  // --- still needs the window and the page table, and the Next
  if (!banking && modules.some((m) => m.name === "banking")) {
    if (options.target !== "next") {
      diagnostics.error("E458", "Far memory (farmem.bas) needs the ZX Spectrum Next target (it pages banks in through the Next's MMU)", { file: 0, start: 0, end: 0 });
      return undefined;
    }
    const plan = planBanks([], options);
    if (typeof plan === "string") {
      diagnostics.error("E457", plan, { file: 0, start: 0, end: 0 });
      return undefined;
    }
    banking = plan;
  }
  let emitted = emitProgram({
    header: [
      `    .model ${MODEL_NAMES[options.target] ?? "Spectrum48"}`,
      ...nexHeader(options, programName),
      "__kbasic_start:",
      ...prologueSource(runtimeInitialisers(modules)).split("\n")
    ],
    functions,
    data: mir.data,
    ...(banking ? { functionBanks: mir.functions.map((f) => f.bank), bankPlacement: banking.placement } : {})
  });

  const assemblerOptions = assemblerOptionsFor(options);
  const assembler = new Z80Assembler();
  const programFile = `${programName}.kbasic.asm`;
  const programUnit = await assembler.parseSourceUnit(programFile, emitted.text, assemblerOptions);
  const units = [
    programUnit,
    ...(await runtimeUnits(modules, assemblerOptions, {
      heapSize: options.heapSize,
      ...(options.heapAddress !== undefined ? { heapAddress: options.heapAddress } : {}),
      ...(banking ? { codebank: banking.layout } : {})
    }))
  ];
  let output = await new Z80Assembler().compileProgram(units, assemblerOptions);
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) {
    // --- A bank that overflows its page(s): the program's, reported with what the bank holds
    const overflow = banking && errors.find((e) => e.errorCode === "Z0411" && e.filename === programFile);
    if (overflow) {
      const bank = bankAtLine(emitted, overflow.line);
      const names = mir.functions.filter((f) => f.bank === bank && !f.name.startsWith("__")).map((f) => f.name);
      const size = banking!.layout.slots * 8;
      diagnostics.error(
        "E455",
        `CODEBANK ${bank} does not fit its ${size}K window${names.length ? ` (it holds ${names.slice(0, 12).join(", ")})` : ""}: move routines or data to another bank${size === 8 ? " or use a 16K window" : ""}`,
        mir.codebankSpan ?? { file: 0, start: 0, end: 0 }
      );
      return undefined;
    }
    // --- An error in the user's inline asm is theirs, at its BASIC line; any other is the compiler's
    const internal = errors.filter((e) => {
      const span = e.filename === programFile ? asmLineSpan(mir, emitted, e.line) : undefined;
      if (span) diagnostics.error("E503", `Inline assembly: ${e.message}`, span);
      return !span;
    });
    if (internal.length) {
      const e = internal[0];
      diagnostics.error("E599", `Internal code generator error: the generated program does not assemble (${e.filename}:${e.line}: ${e.message})`, { file: 0, start: 0, end: 0 });
    }
    return undefined;
  }

  // --- Branch shaping (.docs/kbasic-optimiser.md §4.4): jp -> jr where the first assembly shows the
  // --- target in reach, then assemble again (every change shortens the code, so the reach holds)
  if (level >= 1) {
    const asmStatements = new Set(mir.statements.filter((st) => st.asmLines?.length).map((st) => st.sid));
    const shaped = shapeBranches(emitted, output.listFileItems, 0, asmStatements);
    if (shaped !== undefined) {
      emitted = { ...emitted, text: shaped };
      const shapedUnit = await new Z80Assembler().parseSourceUnit(programFile, shaped, assemblerOptions);
      output = await new Z80Assembler().compileProgram([shapedUnit, ...units.slice(1)], assemblerOptions);
      const shapedErrors = output.errors.filter((e) => !e.isWarning);
      if (shapedErrors.length) {
        const e = shapedErrors[0];
        diagnostics.error("E599", `Internal code generator error: branch shaping broke the program (${e.filename}:${e.line}: ${e.message})`, { file: 0, start: 0, end: 0 });
        return undefined;
      }
    }
  }

  // --- The window must not hide part of the resident program (codebank-contract.md §3)
  if (banking) {
    const low = options.codebankWindow;
    const high = low + banking.layout.slots * 0x2000;
    const clash = output.segments.find(
      (s) => s.bank === undefined && s.emittedCode.length && s.startAddress < high && s.startAddress + s.emittedCode.length > low
    );
    if (clash) {
      const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;
      diagnostics.error(
        "E456",
        `The CODEBANK window ${hex(low)}-${hex(high - 1)} overlaps the resident program (${hex(clash.startAddress)}-${hex(clash.startAddress + clash.emittedCode.length - 1)}): move the window (codebank-window) or the program (origin)`,
        mir.codebankSpan ?? { file: 0, start: 0, end: 0 }
      );
      return undefined;
    }
  }

  // --- CODEBANK: banked code shares the window's addresses, so its tables carry the 8K page
  const partitionOf = banking
    ? (item: ListFileItem) => resolvedPartitionFor(output.segments[item.segmentIndex ?? -1], item.address, MI_ZXNEXT)
    : undefined;
  const debug = buildDebugInfo({
    statements: mir.statements,
    lines: emitted.lines,
    text: emitted.text.split("\n"),
    listFileItems: output.listFileItems,
    programFileIndex: 0,
    sources,
    ...(partitionOf ? { partitionOf } : {})
  });
  // --- An assembler symbol's address: a dotted runtime name (`core.X`) is in the core module
  const symbol = (name: string): number | undefined => {
    const core = name.startsWith("core.") ? output.getNestedModule("core") : undefined;
    const s = core ? core.getSymbol(name.slice(5)) : output.getSymbol(name);
    return typeof s?.value?.value === "number" ? s.value.value : undefined;
  };
  const runtimeSymbols = modules
    .flatMap((m) => m.exports)
    .flatMap((name) => {
      const address = symbol(`core.${name}`);
      return address === undefined ? [] : [{ name: `core.${name}`, address }];
    })
    .sort((a, b) => a.address - b.address);
  const sourceLevel = buildSourceLevel({
    mir,
    emitted,
    listFileItems: output.listFileItems,
    programFileIndex: 0,
    sources,
    addresses: debug.addresses,
    symbol,
    runtimeSymbols,
    globals: bound.globals,
    isLibraryFile: (file) => isLibraryPath(sources.get(file).name),
    optimizationLevel: options.optimize,
    ...(partitionOf && banking ? { partitionOf, codebank: codebankDebugInfo(banking, options, symbol) } : {})
  });
  return { mir, emitted, output, debug: { ...debug, sourceLevel }, entryAddress: symbol("__kbasic_start") ?? options.origin };
}

/** The BASIC span of an emitted line (1-based) that came from an ASM block, or undefined. */
function asmLineSpan(mir: MModule, emitted: EmittedProgram, line: number): Span | undefined {
  const info = emitted.lines[line - 1];
  const asmLines = info && info.sid >= 0 && !info.marker ? mir.statements[info.sid]?.asmLines : undefined;
  if (!asmLines) return undefined;
  // --- The block's lines are emitted one each, straight after its statement marker
  const first = emitted.lines.findIndex((l) => l.sid === info.sid && !l.marker);
  return asmLines[line - 1 - first];
}

/** The `.model` of each target (the runtime pages the 48K BASIC ROM with `#ifmod` on it). */
const MODEL_NAMES: Record<string, string> = { zx48k: "Spectrum48", zx128k: "Spectrum128", zxplus3: "SpectrumP3", next: "Next" };

/**
 * The origin and, for the Next, what the NEX needs: its header (`.savenex`) and a start stub. A NEX
 * is jumped to, not called, so the stub calls the program with interrupts on (PAUSE needs them) and
 * ERR_SP at a slot holding the runtime's `ReportError` (a report, the ROM's own included, prints and
 * ends the program: NextZXOS's 48K ROM has no original main loop to go back to), then waits; `__kbasic_start`, after it, stays the
 * entry every other way of running the program uses.
 */
function nexHeader(options: KBasicOptions, programName: string): string[] {
  const org = `    .org ${options.origin}`;
  if (options.target !== "next") return [org];
  return [
    // --- The NEX is named after the program (export and `debug` write it; its debug sidecar goes beside it)
    `    .savenex file "${programName.replace(/"/g, "")}.nex"`,
    `    .savenex core "${options.nexCore}"`,
    ...(options.nexStack !== undefined ? [`    .savenex stackaddr ${options.nexStack}`] : []),
    org,
    "__kbNexStart:",
    "    ei",
    "    ld hl,core.ReportError",
    "    push hl",
    "    ld ($5c3d),sp",
    "    call __kbasic_start",
    "__kbNexEnd:",
    "    jr __kbNexEnd",
    `    .savenex entryaddr ${options.nexEntry ?? "__kbNexStart"}`
  ];
}

function assemblerOptionsFor(options: KBasicOptions): AssemblerOptionsType {
  const a = new AssemblerOptions();
  a.currentModel =
    { zx128k: SpectrumModelType.Spectrum128, zxplus3: SpectrumModelType.SpectrumP3, next: SpectrumModelType.Next }[options.target as "zx128k"] ??
    SpectrumModelType.Spectrum48;
  // --- BASIC identifiers are case-sensitive, so their labels must be too
  a.useCaseSensitiveSymbols = true;
  if (options.checkMemory) a.predefinedSymbols["KB_CHECK_MEMORY"] = new ExpressionValue(true);
  a.allowNextInstructions = options.zxnext;
  return a;
}

/** Where CODEBANK's banks go (plan §9.2): each bank's page(s) at the window, and the runtime's table. */
type BankPlan = {
  placement: Map<number, { page: number; address: number; pages: number }>;
  layout: { slot: number; slots: number; depth: number; pages: number[] };
};

/**
 * Places the banks: logical bank n in `codebank-first-page + (n - 1) * slots`, or at the n-th entry
 * of `codebank-pages` (past its end, allocation goes on after its last page). A string is the
 * reason the window or the pages are invalid (E457).
 */
function planBanks(banks: number[], options: KBasicOptions): BankPlan | string {
  const slots = options.codebankWindowSize === "16k" ? 2 : 1;
  const window = options.codebankWindow;
  const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;
  if (window % 0x2000 !== 0) return `The CODEBANK window (${hex(window)}) must start on an 8K boundary`;
  if (window + slots * 0x2000 > 0x10000) return `The ${slots * 8}K CODEBANK window at ${hex(window)} runs past $FFFF`;
  const listed = options.codebankPages ?? [];
  const pageOf = (bank: number) =>
    bank <= listed.length
      ? listed[bank - 1]
      : listed.length
        ? listed[listed.length - 1] + (bank - listed.length) * slots
        : options.codebankFirstPage + (bank - 1) * slots;
  const maxBank = banks.length ? banks[banks.length - 1] : 0;
  const pages = [0];
  for (let bank = 1; bank <= maxBank; bank++) pages.push(pageOf(bank));
  for (const bank of banks) {
    const page = pageOf(bank);
    if (page < 0 || page + slots - 1 > 223) return `CODEBANK ${bank}'s page (${page}) is not an 8K page of the Next (0-223)`;
    if (slots === 2 && page % 2 !== 0) return `A 16K CODEBANK window needs even pages; bank ${bank} would start on page ${page}`;
  }
  return {
    placement: new Map(banks.map((bank) => [bank, { page: pageOf(bank), address: window, pages: slots }])),
    layout: { slot: window >> 13, slots, depth: options.codebankDepth, pages }
  };
}

/** The far-call runtime as the debugger needs it (plan §9.4): the window, the runtime's state, the pages. */
function codebankDebugInfo(banking: BankPlan, options: KBasicOptions, symbol: (name: string) => number | undefined): CodebankDebugInfo {
  const at = (name: string) => symbol(`core.${name}`) ?? 0;
  return {
    window: options.codebankWindow,
    windowSize: banking.layout.slots * 0x2000,
    farCall: at("FarCall"),
    farReturn: at("FarReturn"),
    currentBank: at("FarBank"),
    shadowStackPointer: at("FarSP"),
    shadowStack: at("FarStack"),
    banks: [...banking.placement].map(([bank, place]) => ({
      bank,
      pages: Array.from({ length: place.pages }, (_, i) => place.page + i)
    }))
  };
}

/** The optimisation level code is generated at (0-3). */
export function effectiveLevel(requested: number): number {
  return Math.min(requested, 3);
}

/** The bank whose section holds a line of the generated program (its `__kbBank<n>:` label above it). */
function bankAtLine(emitted: EmittedProgram, line: number): number | undefined {
  const text = emitted.text.split("\n");
  for (let n = Math.min(line, text.length) - 1; n >= 0; n--) {
    const m = /^__kbBank(\d+):/.exec(text[n]);
    if (m) return Number(m[1]);
  }
  return undefined;
}
