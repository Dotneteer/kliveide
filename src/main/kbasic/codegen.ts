import { t as tr } from "@common/i18n/i18n";

import type { DiagnosticBag, Span } from "./diagnostics";
import { lowerProgram } from "./ir/lower";
import type { KBasicOptions } from "./options/options";
import { kbasicPackage } from "./runtime/generated/kbasic-package";
import type { BindResult } from "./semantics/binder";
import { isLibraryPath } from "./stdlib";
import type { SourceSet } from "./syntax/source";
import { compileModule, type CompiledModule } from "../z80-backend/link/compile-module";
import type { BackendOptions } from "../z80-backend/options";
import type { BackendProblem } from "../z80-backend/problems";

export type GeneratedProgram = CompiledModule;

/**
 * Code generation (plan §3.1): the typed program becomes MIR (`ir/lower.ts`), and the shared Z80
 * back end (`src/main/z80-backend/link/compile-module.ts`) makes it a program — optimised, assembled
 * with the runtime modules it calls, with its debug tables. Problems in the user's program are
 * reported to `diagnostics`, in Klive BASIC's codes; undefined means there was one.
 */
export async function generateProgram(
  bound: BindResult,
  sources: SourceSet,
  options: KBasicOptions,
  programName: string,
  diagnostics: DiagnosticBag
): Promise<GeneratedProgram | undefined> {
  const isLibraryFile = (file: number) => isLibraryPath(sources.get(file).name);
  const mir = lowerProgram(bound.program, bound.globals, diagnostics, isLibraryFile, {
    bounds: options.checkBounds,
    breakKey: options.breakKey,
    sources
  });
  if (diagnostics.hasErrors) return undefined;

  const result = await compileModule(mir, backendOptions(options), {
    language: "basic",
    packages: [kbasicPackage],
    sources,
    isLibraryFile,
    isLibraryFileName: isLibraryPath,
    programName,
    programFile: `${programName}.kbasic.asm`,
    // --- The runtime's RaiseError takes the ROM's ERR_NR code in A
    errorStop: { symbol: "core.RaiseError", code: { register: "a" }, reports: "zx-rom" },
    sourceLabelPrefix: "_label."
  });
  if ("problems" in result) {
    for (const p of result.problems) report(p, diagnostics);
    return undefined;
  }
  return result.compiled;
}

/** Klive BASIC's options in the back end's terms. */
function backendOptions(options: KBasicOptions): BackendOptions {
  return {
    target: options.target as BackendOptions["target"],
    optimize: options.optimize,
    origin: options.origin,
    headerless: options.headerless,
    heapSize: options.heapSize,
    ...(options.heapAddress !== undefined ? { heapAddress: options.heapAddress } : {}),
    checkMemory: options.checkMemory,
    z80n: options.zxnext,
    codebank: {
      window: options.codebankWindow,
      windowSize: options.codebankWindowSize === "16k" ? "16k" : "8k",
      firstPage: options.codebankFirstPage,
      ...(options.codebankPages ? { pages: options.codebankPages } : {}),
      depth: options.codebankDepth
    },
    nex: {
      core: options.nexCore,
      ...(options.nexStack !== undefined ? { stack: options.nexStack } : {}),
      ...(options.nexEntry !== undefined ? { entry: options.nexEntry } : {})
    }
  };
}

const NOWHERE: Span = { file: 0, start: 0, end: 0 };
const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;

/** A back-end problem as Klive BASIC's diagnostic (the codes and words it always had). */
function report(p: BackendProblem, diagnostics: DiagnosticBag): void {
  switch (p.kind) {
    case "invalid-mir":
      return diagnostics.error("E599", tr("compiler.basic.E599.invalidMir", { problems: p.problems.slice(0, 3).join("; ") }), NOWHERE);
    case "internal":
      return diagnostics.error("E599", tr("compiler.basic.E599.internal", { reason: p.reason }), NOWHERE);
    case "banking-needs-next":
      return diagnostics.error("E458", tr(p.why === "banks" ? "compiler.basic.E458.codebank" : "compiler.basic.E458.farMemory"), p.span ?? NOWHERE);
    case "bank-window": {
      const text =
        p.detail === "boundary"
          ? tr("compiler.basic.E457.boundary", { window: hex(p.window) })
          : tr("compiler.basic.E457.pastEnd", { size: String(p.sizeK), window: hex(p.window) });
      return diagnostics.error("E457", text, p.span ?? NOWHERE);
    }
    case "bank-page":
      return diagnostics.error(
        "E457",
        tr(p.detail === "page" ? "compiler.basic.E457.page" : "compiler.basic.E457.oddPage", { bank: String(p.bank), page: String(p.page) }),
        p.span ?? NOWHERE
      );
    case "bank-overflow": {
      const values = { bank: String(p.bank), size: String(p.sizeK) };
      const text = p.contents.length
        ? tr(p.sizeK === 8 ? "compiler.basic.E455.holds8k" : "compiler.basic.E455.holds", { ...values, names: p.contents.slice(0, 12).join(", ") })
        : tr(p.sizeK === 8 ? "compiler.basic.E455.empty8k" : "compiler.basic.E455.empty", values);
      return diagnostics.error("E455", text, p.span ?? NOWHERE);
    }
    case "window-clash":
      return diagnostics.error(
        "E456",
        tr("compiler.basic.E456", { low: hex(p.low), high: hex(p.high), start: hex(p.start), end: hex(p.end) }),
        p.span ?? NOWHERE
      );
    case "inline-asm":
      return diagnostics.error("E503", tr("compiler.basic.E503", { message: p.message }), p.span);
    case "does-not-assemble":
      return diagnostics.error("E599", tr("compiler.basic.E599.doesNotAssemble", { file: p.file, line: String(p.line), message: p.message }), NOWHERE);
    case "branch-shaping":
      return diagnostics.error("E599", tr("compiler.basic.E599.branchShaping", { file: p.file, line: String(p.line), message: p.message }), NOWHERE);
  }
}
