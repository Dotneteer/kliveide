import { t as tr } from "@common/i18n/i18n";

import type { Span } from "./mir/mir";

/**
 * What can stop the shared Z80 back end (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.1), as data: the
 * front end turns each into a diagnostic of its own (Klive BASIC keeps its E455-E458, E503 and E599),
 * or uses `problemMessage`'s wording. A `span` points into the front end's sources where the problem
 * belongs to a place in them.
 */
export type BackendProblem =
  /** The MIR breaks an invariant, or states a meaning the back end does not implement. */
  | { kind: "invalid-mir"; problems: string[] }
  /** A bug of the back end. */
  | { kind: "internal"; reason: string }
  /** Banked code, or the far-call runtime, on a machine without the Next's MMU. */
  | { kind: "banking-needs-next"; why: "banks" | "far-memory"; span?: Span }
  /** The bank window is invalid: not on an 8K boundary, or past $FFFF. */
  | { kind: "bank-window"; detail: "boundary" | "pastEnd"; window: number; sizeK: number; span?: Span }
  /** A bank's page is invalid: not a page of the Next, or odd for a 16K window. */
  | { kind: "bank-page"; detail: "page" | "oddPage"; bank: number; page: number; span?: Span }
  /** A bank does not fit its window; `contents` names what it holds. */
  | { kind: "bank-overflow"; bank: number; sizeK: number; contents: string[]; span?: Span }
  /** The bank window overlaps the resident program. */
  | { kind: "window-clash"; low: number; high: number; start: number; end: number; span?: Span }
  /** The assembler rejected a line of the source's inline assembly. */
  | { kind: "inline-asm"; message: string; span: Span }
  /** The generated program does not assemble (a bug of the back end). */
  | { kind: "does-not-assemble"; file: string; line: number; message: string }
  /** Branch shaping broke the program (a bug of the back end). */
  | { kind: "branch-shaping"; file: string; line: number; message: string };

const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;

/** A problem in the back end's own words, for a front end that has none of its own. */
export function problemMessage(p: BackendProblem): string {
  switch (p.kind) {
    case "invalid-mir":
      return tr("compiler.backend.invalidMir", { problems: p.problems.slice(0, 3).join("; ") });
    case "internal":
      return tr("compiler.backend.internal", { reason: p.reason });
    case "banking-needs-next":
      return tr("compiler.backend.bankingNeedsNext");
    case "bank-window":
      return p.detail === "boundary"
        ? tr("compiler.backend.bankWindowBoundary", { window: hex(p.window) })
        : tr("compiler.backend.bankWindowPastEnd", { size: String(p.sizeK), window: hex(p.window) });
    case "bank-page":
      return tr(p.detail === "page" ? "compiler.backend.bankPage" : "compiler.backend.bankOddPage", { bank: String(p.bank), page: String(p.page) });
    case "bank-overflow":
      return tr("compiler.backend.bankOverflow", { bank: String(p.bank), size: String(p.sizeK) });
    case "window-clash":
      return tr("compiler.backend.windowClash", { low: hex(p.low), high: hex(p.high), start: hex(p.start), end: hex(p.end) });
    case "inline-asm":
      return tr("compiler.backend.inlineAsm", { message: p.message });
    case "does-not-assemble":
      return tr("compiler.backend.doesNotAssemble", { file: p.file, line: String(p.line), message: p.message });
    case "branch-shaping":
      return tr("compiler.backend.branchShaping", { file: p.file, line: String(p.line), message: p.message });
  }
}
