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
import { lowerProgram } from "./ir/lower";
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
  debug: DebugBuild;
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
  const mir = lowerProgram(bound.program, bound.globals, diagnostics, (file) => isLibraryPath(sources.get(file).name));
  if (diagnostics.hasErrors) return undefined;

  // --- Instruction selection adds the runtime routines it calls (multiply, divide, ...)
  const runtime = new Set(mir.runtime);
  const functions: LirLine[][] = [];
  try {
    for (const fn of mir.functions) functions.push(selectFunction(fn, runtime));
  } catch (e) {
    if (!(e instanceof CodegenError)) throw e;
    diagnostics.error("E599", `Internal code generator error: ${e.message}`, { file: 0, start: 0, end: 0 });
    return undefined;
  }

  const modules = resolveRuntimeModules(runtime, ["program"]);
  const emitted = emitProgram({
    header: [`    .model ${MODEL_NAMES[options.target] ?? "Spectrum48"}`, `    .org ${options.origin}`, "__kbasic_start:", ...prologueSource(runtimeInitialisers(modules)).split("\n")],
    functions,
    data: mir.data
  });

  const assemblerOptions = assemblerOptionsFor(options);
  const assembler = new Z80Assembler();
  const programFile = `${programName}.kbasic.asm`;
  const programUnit = await assembler.parseSourceUnit(programFile, emitted.text, assemblerOptions);
  const units = [programUnit, ...(await runtimeUnits(modules, assemblerOptions, { heapSize: options.heapSize, ...(options.heapAddress !== undefined ? { heapAddress: options.heapAddress } : {}) }))];
  const output = await new Z80Assembler().compileProgram(units, assemblerOptions);
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) {
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

  const debug = buildDebugInfo({
    statements: mir.statements,
    lines: emitted.lines,
    text: emitted.text.split("\n"),
    listFileItems: output.listFileItems,
    programFileIndex: 0,
    sources
  });
  return { mir, emitted, output, debug, entryAddress: options.origin };
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
const MODEL_NAMES: Record<string, string> = { zx48k: "Spectrum48", zx128k: "Spectrum128", zxplus3: "SpectrumP3" };

function assemblerOptionsFor(options: KBasicOptions): AssemblerOptionsType {
  const a = new AssemblerOptions();
  a.currentModel = { zx128k: SpectrumModelType.Spectrum128, zxplus3: SpectrumModelType.SpectrumP3 }[options.target as "zx128k"] ?? SpectrumModelType.Spectrum48;
  // --- BASIC identifiers are case-sensitive, so their labels must be too
  a.useCaseSensitiveSymbols = true;
  if (options.checkMemory) a.predefinedSymbols["KB_CHECK_MEMORY"] = new ExpressionValue(true);
  return a;
}
