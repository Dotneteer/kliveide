import type { ListFileItem, SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { MI_ZXNEXT } from "@common/machines/constants";
import { resolvedPartitionFor } from "@common/utils/source-breakpoint-partition";
import type { AssemblerOptions as AssemblerOptionsType } from "@main/compiler-common/assembler-in-out";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { ExpressionValue } from "@main/compiler-common/expressions";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { buildDebugInfo, type DebugBuild } from "../debug/builder";
import { buildSourceLevel, type SourceLevelInput } from "../debug/source-level";
import type { SourceFiles } from "../debug/sources";
import { emitProgram, USER_HEAP, type EmittedProgram } from "../emit/emit";
import type { MModule, Span } from "../mir/mir";
import { optimizeLir, shapeBranches } from "../opt/pipeline";
import { optimizeMir } from "../opt/mir-passes";
import { moduleSemanticProblems, verifyModule } from "../opt/verify";
import { effectiveLevel, type BackendOptions } from "../options";
import type { BackendProblem } from "../problems";
import { prologueSource, runtimeInitialisers, runtimeLibrary, runtimeUnits } from "../runtime/runtime-linker";
import type { RuntimePackage } from "../runtime/runtime-types";
import { CodegenError, type LirLine } from "../select/lir";
import { selectFunction } from "../select/select0";
import { bankAtLine, codebankDebugInfo, planBanks, type BankPlan } from "./banking";
import { MODEL_NAMES, nexHeader, START_LABEL } from "./nex";

/**
 * The shared Z80 back end's driver (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.1, §4.3): a verified MIR
 * module becomes an assembled program and its debug tables — the MIR passes, instruction selection,
 * the LIR rules, emission, runtime linking, assembly, branch shaping, bank placement and the debug
 * builders. A front end lowers its language to MIR and calls this; nothing here knows which language
 * it was.
 */

/** What the back end needs to know about the front end that produced the MIR. */
export type FrontEndInfo = {
  /** The source language (`SourceLevelDebugInfo.language`, the debugger's plugin for it). */
  language: string;
  /** The language's own runtime packages (the back end's `core` and `zx` are always available). */
  packages: readonly RuntimePackage[];
  /** The front end's source files: spans become file names, lines and columns through them. */
  sources: SourceFiles;
  /** A source file (by index) of the language's own library. */
  isLibraryFile: (fileIndex: number) => boolean;
  /** A reported file name of the language's own library. */
  isLibraryFileName: (name: string) => boolean;
  /** The program's name (the NEX file is named after it). */
  programName: string;
  /** The generated program's file name in the assembler's listing. */
  programFile: string;
  /** The language's run-time error stop: the routine its errors go through, and how they are named. */
  errorStop?: SourceLevelInput["errorStop"];
  /** The prefix of the labels the language gives its source labels and line numbers. */
  sourceLabelPrefix?: string;
};

export type CompiledModule = {
  mir: MModule;
  emitted: EmittedProgram;
  /** The assembler's output for the program and its runtime closure. */
  output: Awaited<ReturnType<Z80Assembler["compileProgram"]>>;
  debug: DebugBuild & { sourceLevel: SourceLevelDebugInfo };
  entryAddress: number;
};

export type BackendResult = { ok: true; compiled: CompiledModule } | { ok: false; problems: BackendProblem[] };

const fail = (...problems: BackendProblem[]): BackendResult => ({ ok: false, problems });

/** Compiles a MIR module to a Z80 program. The module is changed (optimised) in place. */
export async function compileModule(mir: MModule, options: BackendOptions, front: FrontEndInfo): Promise<BackendResult> {
  // --- Instruction selection adds the runtime routines it calls (multiply, divide, ...)
  const runtime = new Set(mir.runtime);
  const level = effectiveLevel(options.optimize);
  const library = runtimeLibrary(front.packages);
  // --- Every build: each operation states a meaning the back end implements (S3)
  const unsupported = moduleSemanticProblems(mir);
  if (unsupported.length) return fail({ kind: "invalid-mir", problems: unsupported });
  // --- The MIR verifier (.docs/z80-backend-optimiser.md §3): an optimised build checks its input first
  if (level >= 1) {
    const problems = verifyModule(mir, level);
    if (problems.length) return fail({ kind: "invalid-mir", problems });
    try {
      optimizeMir(mir, level);
    } catch (e) {
      return fail({ kind: "internal", reason: (e as Error).message });
    }
  }
  let functions: LirLine[][] = [];
  try {
    // --- The register contract of the runtime routines: the linked packages' `@abi` lines
    for (const fn of mir.functions) functions.push(fn.removed ? [] : selectFunction(fn, runtime, level, (r) => library.argumentsOf(r)));
    functions = optimizeLir(mir, functions, { level, target: options.target === "next" ? "z80n" : "z80" });
  } catch (e) {
    if (!(e instanceof CodegenError)) throw e;
    return fail({ kind: "internal", reason: e.message });
  }

  // --- Banked code: where each bank goes, and the far-call runtime's parameters
  const banks = [...new Set([...mir.functions, ...mir.data].flatMap((x) => (x.bank ? [x.bank] : [])))].sort((a, b) => a - b);
  let banking: BankPlan | undefined;
  if (banks.length) {
    const span = mir.codebankSpan;
    if (options.target !== "next") return fail({ kind: "banking-needs-next", why: "banks", ...(span ? { span } : {}) });
    const plan = planBanks(banks, options);
    if ("kind" in plan) return fail({ ...plan, ...(span ? { span } : {}) });
    banking = plan;
  }

  // --- The Next's start stub reports errors through the errors module, which prints them
  const modules = library.resolve(runtime, options.target === "next" ? ["program", "errors", "print"] : ["program"]);
  // --- The far-call runtime linked without a bank of the program's own (Klive BASIC's far memory):
  // --- it still needs the window and the page table, and the Next
  if (!banking && modules.some((m) => m.name === "banking")) {
    if (options.target !== "next") return fail({ kind: "banking-needs-next", why: "far-memory" });
    const plan = planBanks([], options);
    if ("kind" in plan) return fail(plan);
    banking = plan;
  }
  let emitted = emitProgram({
    header: [
      `    .model ${MODEL_NAMES[options.target] ?? "Spectrum48"}`,
      ...nexHeader(options, front.programName),
      `${START_LABEL}:`,
      // --- headerless: none of the start-up (the registers kept for END, the modules' initialisers)
      ...(options.headerless ? [] : prologueSource(runtimeInitialisers(modules)).split("\n"))
    ],
    functions,
    data: mir.data,
    ...(options.heapAddress === undefined ? { heapSize: options.heapSize } : {}),
    ...(banking ? { functionBanks: mir.functions.map((f) => f.bank), bankPlacement: banking.placement } : {})
  });

  const assemblerOptions = assemblerOptionsFor(options);
  const programFile = front.programFile;
  const programUnit = await new Z80Assembler().parseSourceUnit(programFile, emitted.text, assemblerOptions);
  const units = [
    programUnit,
    ...(await runtimeUnits(modules, assemblerOptions, {
      heapSize: options.heapSize,
      ...(options.heapAddress !== undefined ? { heapAddress: options.heapAddress } : { heapLabel: USER_HEAP }),
      ...(banking ? { codebank: banking.layout } : {})
    }))
  ];
  let output = await new Z80Assembler().compileProgram(units, assemblerOptions);
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) {
    // --- A bank that overflows its page(s): the program's, reported with what the bank holds
    const overflow = banking && errors.find((e) => e.errorCode === "Z0411" && e.filename === programFile);
    if (overflow) {
      const bank = bankAtLine(emitted, overflow.line) ?? 0;
      const contents = mir.functions.filter((f) => f.bank === bank && !f.name.startsWith("__")).map((f) => f.name);
      return fail({ kind: "bank-overflow", bank, sizeK: banking!.layout.slots * 8, contents, ...(mir.codebankSpan ? { span: mir.codebankSpan } : {}) });
    }
    // --- An error in the source's inline asm is the user's, at its source line; any other is the back end's
    const problems: BackendProblem[] = [];
    const internal = errors.filter((e) => {
      const span = e.filename === programFile ? asmLineSpan(mir, emitted, e.line) : undefined;
      if (span) problems.push({ kind: "inline-asm", message: e.message, span });
      return !span;
    });
    if (internal.length) {
      const e = internal[0];
      problems.push({ kind: "does-not-assemble", file: e.filename, line: e.line, message: e.message });
    }
    return fail(...problems);
  }

  // --- Branch shaping (.docs/z80-backend-optimiser.md §4.4): jp -> jr where the first assembly shows
  // --- the target in reach, then assemble again (every change shortens the code, so the reach holds)
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
        return fail({ kind: "branch-shaping", file: e.filename, line: e.line, message: e.message });
      }
    }
  }

  // --- The window must not hide part of the resident program (codebank-contract.md §3)
  if (banking) {
    const low = options.codebank.window;
    const high = low + banking.layout.slots * 0x2000;
    const clash = output.segments.find(
      (s) => s.bank === undefined && s.emittedCode.length && s.startAddress < high && s.startAddress + s.emittedCode.length > low
    );
    if (clash) {
      return fail({
        kind: "window-clash",
        low,
        high: high - 1,
        start: clash.startAddress,
        end: clash.startAddress + clash.emittedCode.length - 1,
        ...(mir.codebankSpan ? { span: mir.codebankSpan } : {})
      });
    }
  }

  // --- Banked code shares the window's addresses, so its tables carry the 8K page
  const partitionOf = banking
    ? (item: ListFileItem) => resolvedPartitionFor(output.segments[item.segmentIndex ?? -1], item.address, MI_ZXNEXT)
    : undefined;
  const debug = buildDebugInfo({
    statements: mir.statements,
    lines: emitted.lines,
    text: emitted.text.split("\n"),
    listFileItems: output.listFileItems,
    programFileIndex: 0,
    sources: front.sources,
    isLibraryFileName: front.isLibraryFileName,
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
    sources: front.sources,
    addresses: debug.addresses,
    symbol,
    runtimeSymbols,
    language: front.language,
    isLibraryFile: front.isLibraryFile,
    isLibraryFileName: front.isLibraryFileName,
    ...(front.errorStop ? { errorStop: front.errorStop } : {}),
    ...(front.sourceLabelPrefix ? { sourceLabelPrefix: front.sourceLabelPrefix } : {}),
    optimizationLevel: options.optimize,
    ...(partitionOf && banking ? { partitionOf, codebank: codebankDebugInfo(banking, options, symbol) } : {})
  });
  return {
    ok: true,
    compiled: { mir, emitted, output, debug: { ...debug, sourceLevel }, entryAddress: symbol(START_LABEL) ?? options.origin }
  };
}

/** The source span of an emitted line (1-based) that came from an inline-asm statement, or undefined. */
function asmLineSpan(mir: MModule, emitted: EmittedProgram, line: number): Span | undefined {
  const info = emitted.lines[line - 1];
  const asmLines = info && info.sid >= 0 && !info.marker ? mir.statements[info.sid]?.asmLines : undefined;
  if (!asmLines) return undefined;
  // --- The block's lines are emitted one each, straight after its statement marker
  const first = emitted.lines.findIndex((l) => l.sid === info.sid && !l.marker);
  return asmLines[line - 1 - first];
}

function assemblerOptionsFor(options: BackendOptions): AssemblerOptionsType {
  const a = new AssemblerOptions();
  a.currentModel =
    { zx128k: SpectrumModelType.Spectrum128, zxplus3: SpectrumModelType.SpectrumP3, next: SpectrumModelType.Next }[options.target as "zx128k"] ??
    SpectrumModelType.Spectrum48;
  // --- Labels are case-sensitive: front ends mangle names into them as the source writes them
  a.useCaseSensitiveSymbols = true;
  if (options.checkMemory) a.predefinedSymbols["KB_CHECK_MEMORY"] = new ExpressionValue(true);
  a.allowNextInstructions = !!options.z80n;
  if (options.headerless) a.predefinedSymbols["KB_HEADERLESS"] = new ExpressionValue(true);
  return a;
}
