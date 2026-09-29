/** A range of a source file's text: character offsets, end exclusive. */
export type Span = {
  file: number;
  start: number;
  end: number;
};

export type Severity = "error" | "warning" | "info";

/**
 * A problem found while compiling. Warnings use the spec's codes (W100...); errors, which have no
 * codes upstream, use Klive's: E0xx options, E1xx lexer, E2xx preprocessor, E3xx parser.
 */
export type Diagnostic = {
  code: string;
  severity: Severity;
  message: string;
  span: Span;
};

/** Collects the diagnostics of one compilation. */
export class DiagnosticBag {
  readonly items: Diagnostic[] = [];

  error(code: string, message: string, span: Span): void {
    this.items.push({ code, severity: "error", message, span });
  }

  warning(code: string, message: string, span: Span): void {
    this.items.push({ code, severity: "warning", message, span });
  }

  info(code: string, message: string, span: Span): void {
    this.items.push({ code, severity: "info", message, span });
  }

  get hasErrors(): boolean {
    return this.items.some((d) => d.severity === "error");
  }
}
