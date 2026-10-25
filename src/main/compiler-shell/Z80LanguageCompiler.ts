import fs from "fs";

import type { AssemblerErrorInfo, CompileProfile, DebuggableOutput, IKliveCompiler, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

import type { CompiledModule } from "../z80-backend/link/compile-module";
import type { BackendTarget } from "../z80-backend/options";
import { emittedFiles, type EmitRequest } from "./emit-files";

/**
 * The IDE side of every language the shared Z80 back end compiles (`.plans/SHARED_Z80_BACKEND_PLAN.md`
 * §5, Phase 6): an `IKliveCompiler` whose subclass supplies the front end — reading the source, its
 * options, its diagnostics, lowering to MIR and calling the back end — and gets here what every such
 * compiler does the same way: the artefacts written beside the source, and the compiled program as
 * the IDE's `DebuggableOutput` (segments, the NEX, the classic and source-level debug tables).
 */
export abstract class Z80LanguageCompiler implements IKliveCompiler {
  abstract readonly id: string;
  abstract readonly language: string;
  readonly providesKliveOutput = true;
  /** The compiler's product name: the trace output and the profiler name it. */
  abstract readonly productName: string;
  /** The tag of the artefacts' names (`<name>.<tag>.asm`). */
  abstract readonly artefactTag: string;

  protected state: AppState | undefined;

  setAppState(state: AppState): void {
    this.state = state;
  }

  abstract compileFile(filename: string, options?: Record<string, unknown>, profile?: CompileProfile): Promise<KliveCompilerOutput>;

  abstract lineCanHaveBreakpoint(line: string): Promise<boolean>;

  /**
   * Writes the artefacts a build asks for beside its source (a failed write is a trace line, not a
   * failed build), and says what it wrote in `trace`.
   */
  protected writeArtefacts(filename: string, compiled: CompiledModule, request: EmitRequest, trace: string[]): void {
    const name = programName(filename);
    const folder = folderOf(filename);
    for (const file of emittedFiles(compiled, request, name, this.artefactTag)) {
      const target = folder ? `${folder}/${name}${file.suffix}` : `${name}${file.suffix}`;
      try {
        fs.writeFileSync(target, file.content);
        trace.push(`${this.productName}: wrote ${target}`);
      } catch (err) {
        trace.push(`${this.productName}: could not write ${target}: ${(err as Error).message}`);
      }
    }
  }

  /** A compiled program as the IDE's output: what it injects, exports, debugs and profiles. */
  protected programOutput(compiled: CompiledModule, target: BackendTarget, errors: AssemblerErrorInfo[], traceOutput: string[]): DebuggableOutput {
    const model = targetModel(target)!;
    const classic = compiled.debug.classic;
    return {
      errors,
      traceOutput,
      segments: compiled.output.segments.map((s) => ({
        startAddress: s.startAddress,
        emittedCode: s.emittedCode,
        ...(s.bank !== undefined ? { bank: s.bank, bankOffset: s.bankOffset } : {})
      })),
      // --- The Next: the IDE exports a NEX (unbanked code goes into bank 2) and launches it with .nexload
      ...(model === SpectrumModelType.Next
        ? {
            nexConfig: compiled.output.nexConfig,
            unbankedSegments: compiled.output.segments
              .filter((s) => s.bank === undefined)
              .map((s) => ({ startAddress: s.startAddress, emittedCode: s.emittedCode }))
          }
        : {}),
      injectOptions: { subroutine: true },
      sourceFileList: classic.sourceFileList,
      sourceMap: classic.sourceMap,
      listFileItems: classic.listFileItems,
      sourceLevelDebug: compiled.debug.sourceLevel,
      compilerName: this.productName,
      modelType: model,
      entryAddress: compiled.entryAddress
    } as DebuggableOutput & { modelType: number; entryAddress: number };
  }
}

/** The Spectrum model a target builds for; undefined for a target the back end does not generate code for. */
export function targetModel(target: string): SpectrumModelType | undefined {
  return {
    zx48k: SpectrumModelType.Spectrum48,
    zx128k: SpectrumModelType.Spectrum128,
    zxplus3: SpectrumModelType.SpectrumP3,
    next: SpectrumModelType.Next
  }[target as "zx48k"];
}

/** A file's name without folder and extension: the generated program's name. */
export function programName(path: string): string {
  const base = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  return base.replace(/\.[^.]*$/, "") || "program";
}

export function folderOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i < 0 ? "" : path.slice(0, i);
}
