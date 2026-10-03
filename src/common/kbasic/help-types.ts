/**
 * The shape of Klive BASIC's static help data (`help-data.generated.ts`, written by
 * `npm run kbasic:help` from the language spec and the documented library API;
 * `.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` §4.4). Hover, completion and signature help read it.
 */

export type BasicHelpKind =
  | "statement"
  | "function"
  | "operator"
  | "modifier"
  | "type"
  | "declaration"
  | "misc"
  | "directive";

export type BasicHelpEntry = {
  /** The keyword (upper case; `CHR$` keeps its `$`), or `#name` for a directive. */
  readonly name: string;
  readonly kind: BasicHelpKind;
  /** Readable syntax lines, derived from the spec's EBNF (`BORDER expr`, `ABS(expr)`). */
  readonly display: readonly string[];
  /** One line saying what it does. */
  readonly summary: string;
  /** A built-in function's parameters, for signature help. */
  readonly params?: readonly string[];
};

export type BasicPragmaHelp = {
  readonly name: string;
  readonly type: string;
  readonly default: string;
  readonly effect: string;
};

export type BasicLibraryHelp = {
  /** The file name, e.g. `attr.bas`. */
  readonly name: string;
  /** The line that includes it, e.g. `#include <attr.bas>`. */
  readonly include: string;
  readonly provides: readonly string[];
  readonly summary: string;
  /** Klive BASIC's standard library has the file (the others are only documented upstream). */
  readonly available: boolean;
};

export type BasicLibraryRoutineHelp = {
  readonly name: string;
  readonly kind: "function" | "sub" | "other";
  /** The library file, e.g. `attr.bas`. */
  readonly library: string;
  readonly include: string;
  readonly syntax: readonly string[];
  readonly returns?: string;
  readonly params: readonly { readonly name: string; readonly type: string; readonly notes?: string }[];
  readonly summary: string;
  readonly available: boolean;
};
