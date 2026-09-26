import { DiagnosticBag } from "@main/kbasic/diagnostics";
import { parseProgram } from "@main/kbasic/front-end";
import { defaultOptions, type KBasicOptions } from "@main/kbasic/options/options";
import { bind, type BindResult } from "@main/kbasic/semantics/binder";
import type { BoundExpr, BoundStatement } from "@main/kbasic/semantics/bound";
import type { Symbol } from "@main/kbasic/semantics/symbols";

export type Bound = BindResult & {
  diagnostics: DiagnosticBag;
  /** Codes of every diagnostic, in order. */
  codes: string[];
  /** The binder's diagnostics only (the parser's must be empty for a test to mean anything). */
  semantic: { code: string; message: string; text: string }[];
  source: string;
};

/** Parses and binds a program; throws when the parser already reports an error. */
export function bindText(source: string, options: Partial<KBasicOptions> = {}): Bound {
  const diagnostics = new DiagnosticBag();
  const front = parseProgram("/test/main.bas", source, { read: () => undefined }, {}, diagnostics);
  const syntaxErrors = diagnostics.items.filter((d) => d.severity === "error");
  if (syntaxErrors.length) {
    throw new Error(`Syntax errors in the test program: ${syntaxErrors.map((d) => `${d.code} ${d.message}`).join("; ")}`);
  }
  const before = diagnostics.items.length;
  const result = bind(front.program, { ...defaultOptions(), ...options }, diagnostics);
  const text = front.sources.get(0).text;
  return {
    ...result,
    diagnostics,
    codes: diagnostics.items.map((d) => d.code),
    semantic: diagnostics.items.slice(before).map((d) => ({ code: d.code, message: d.message, text: text.slice(d.span.start, d.span.end) })),
    source
  };
}

/** The codes the binder reported. */
export function codesOf(source: string, options: Partial<KBasicOptions> = {}): string[] {
  return bindText(source, options).semantic.map((d) => d.code);
}

/** A global symbol by name. */
export function globalSymbol(b: Bound, name: string): Symbol | undefined {
  return b.globals.lookup(name, false);
}

/** The bound statements of the main program, without labels. */
export function statements(b: Bound): BoundStatement[] {
  return b.program.statements.filter((s) => s.kind !== "label");
}

/** The first expression-carrying part of a statement: an assignment's value, a PRINT's first item. */
export function valueOf(s: BoundStatement): BoundExpr {
  if (s.kind === "assign") return s.value;
  if (s.kind === "print") {
    const item = s.items.find((i) => i.kind === "expr");
    if (item?.kind === "expr") return item.value;
  }
  throw new Error(`No value in a ${s.kind} statement`);
}
