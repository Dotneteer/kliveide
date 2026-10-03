import type {
  AssemblerErrorInfo,
  DebuggableOutput,
  KliveCompilerOutput,
  SourceAnnotation
} from "@abstractions/CompilerInfo";
import type { BreakpointInfo, SourceCommentSwitches } from "@abstractions/BreakpointInfo";
import type { ConditionSymbols } from "./breakpoint-condition/condition-types";

import { compileLogTemplate } from "./breakpoint-condition/logpoint-template";
import { integerSymbolsOf } from "./breakpoint-condition/integer-symbols";
import { compileConditionWith } from "./breakpoint-condition/condition-checker";
import { parseDezogExpression } from "./breakpoint-condition/dezog/dezog-parser";
import { parseWpmemArgs } from "./breakpoint-condition/dezog/wpmem-args";

/*
 * DeZog-style source annotations (`.plans/LOGPOINTS_PLAN.md` §4.7): the `LOGPOINT` comments a build
 * finds, checked into build warnings, and turned into the logpoints the build owns.
 *
 * Kind-tagged throughout, so G1.5 (`ASSERTION`, `WPMEM`) adds its kinds here and nothing else.
 * No renderer or main-process imports: the main process checks a build's annotations, the IDE
 * installs them.
 */

/**
 * The annotation keywords, case-sensitive as in sjasmplus's `SLDOPT COMMENT` (§1.2), in the order
 * the `SLDOPT` line DeZog documents names them.
 */
export const ANNOTATION_KEYWORDS = ["WPMEM", "LOGPOINT", "ASSERTION"] as const;

export type AnnotationKeyword = (typeof ANNOTATION_KEYWORDS)[number];

/** The sjasmplus directive that exports all three kinds to the SLD file (S9). */
export const SLDOPT_ALL_KEYWORDS = "SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION";

const LOGPOINT_PATTERN = /(?:^|[^A-Za-z0-9_.])LOGPOINT(?![A-Za-z0-9_])(.*)$/s;
const KEYWORD_PATTERN = /(?:^|[^A-Za-z0-9_.])(WPMEM|LOGPOINT|ASSERTION)(?![A-Za-z0-9_])/g;

/**
 * Every DeZog keyword in a comment, in order, with its text (G1.5): a `LOGPOINT` takes the rest of
 * the comment, as it always has; an `ASSERTION` or `WPMEM` stops at the next `;`, so a trailing note
 * (`; ASSERTION A < 5 ; why`) is not part of the expression. A keyword inside a `LOGPOINT`'s
 * message is the message's.
 */
export function annotationsInComment(
  comment: string | null | undefined
): { kind: AnnotationKeyword; text: string }[] {
  if (!comment) return [];
  const found: { kind: AnnotationKeyword; text: string }[] = [];
  KEYWORD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = KEYWORD_PATTERN.exec(comment))) {
    const kind = match[1] as AnnotationKeyword;
    const start = match.index + match[0].length;
    if (kind === "LOGPOINT") {
      found.push({ kind, text: comment.substring(start).trim() });
      break;
    }
    const end = comment.indexOf(";", start);
    const stop = end < 0 ? comment.length : end;
    found.push({ kind, text: comment.substring(start, stop).trim() });
    KEYWORD_PATTERN.lastIndex = stop;
  }
  return found;
}

/**
 * The text after the `LOGPOINT` keyword of a comment, trimmed, or `undefined` when the comment has
 * no such keyword. The comment may carry its `;` or `//`.
 */
export function logpointTextOf(comment: string | null | undefined): string | undefined {
  if (!comment) return undefined;
  const match = LOGPOINT_PATTERN.exec(comment);
  return match ? match[1].trim() : undefined;
}

/** The build-warning code of a `LOGPOINT` comment that cannot be used. */
export const LOGPOINT_WARNING_CODE = "LP001";
/** ... of an `ASSERTION` comment (S5). */
export const ASSERTION_WARNING_CODE = "AS001";
/** ... of a `WPMEM` comment (S5). */
export const WPMEM_WARNING_CODE = "WP001";

const WARNING_CODES: Record<AnnotationKeyword, string> = {
  LOGPOINT: LOGPOINT_WARNING_CODE,
  ASSERTION: ASSERTION_WARNING_CODE,
  WPMEM: WPMEM_WARNING_CODE
};

/**
 * Check a build's annotations (L13, S5): one that does not compile is dropped and reported as a
 * build warning with its file and line; one naming an unknown label stays (it is inactive until a
 * build defines the label, C14) and is reported too. Never an error: a debugging aid must not
 * break a build. The machine facts are not known here, so the emulator compiles each expression
 * again when it arms it.
 *
 * - `LOGPOINT`: the message template (DeZog dialect).
 * - `ASSERTION`: the expression, or nothing (a bare `ASSERTION` always stops).
 * - `WPMEM`: the arguments, folded against the build's symbols; an unknown label drops it.
 *
 * Returns the output with the surviving annotations and the warnings appended.
 */
export function checkSourceAnnotations<T extends KliveCompilerOutput>(output: T): T {
  const debuggable = output as unknown as DebuggableOutput;
  const annotations = debuggable?.debugAnnotations;
  if (!annotations?.length) return output;

  const symbols = integerSymbolsOf((output as { symbols?: Record<string, unknown> }).symbols);
  const kept: SourceAnnotation[] = [];
  const warnings: AssemblerErrorInfo[] = [];
  for (const annotation of annotations) {
    const filename = debuggable.sourceFileList?.[annotation.fileIndex]?.filename ?? "";
    const warn = (message: string) =>
      warnings.push({
        errorCode: WARNING_CODES[annotation.kind] ?? LOGPOINT_WARNING_CODE,
        filename,
        line: annotation.line,
        startPosition: 0,
        endPosition: null,
        startColumn: 0,
        endColumn: null,
        message,
        isWarning: true
      });
    if (annotation.kind === "WPMEM") {
      const parsed = parseWpmemArgs(annotation.text, symbols);
      if ("error" in parsed) {
        warn(`WPMEM ignored: ${parsed.error}`);
        continue;
      }
      kept.push(annotation);
      continue;
    }
    if (annotation.kind === "ASSERTION") {
      if (annotation.text) {
        const result = compileConditionWith(
          annotation.text,
          { accessKind: "exec", symbols },
          parseDezogExpression
        );
        if (!result.compiled) {
          const first = result.errors[0];
          warn(`ASSERTION ignored: ${first.message} (column ${first.start + 1} of the expression)`);
          continue;
        }
        for (const warning of result.warnings) warn(`ASSERTION: ${warning.message}`);
      }
      kept.push(annotation);
      continue;
    }
    const result = compileLogTemplate(annotation.text, "dezog", { accessKind: "exec", symbols });
    if (!result.template) {
      const first = result.errors[0];
      warn(`LOGPOINT ignored: ${first.message} (column ${first.start + 1} of the message)`);
      continue;
    }
    for (const warning of result.warnings) warn(`LOGPOINT: ${warning.message}`);
    kept.push(annotation);
  }
  return {
    ...output,
    debugAnnotations: kept,
    errors: [...(output.errors ?? []), ...warnings]
  };
}

/**
 * Which DeZog comment made a build-owned breakpoint: its `annotationKind`, or `LOGPOINT` for an
 * annotation logpoint (which carries none); `undefined` for any other breakpoint. All three kinds'
 * marks behave alike in the IDE (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` Q6).
 */
export function commentKindOf(bp: BreakpointInfo | undefined): AnnotationKeyword | undefined {
  if (bp?.owner?.kind !== "annotation") return undefined;
  return bp.annotationKind ?? "LOGPOINT";
}

/** The session state of a comment-made breakpoint's switch (S3): `resource:line:kind`. */
export function annotationStateKey(resource: string, line: number, kind: AnnotationKeyword): string {
  return `${resource}:${line}:${kind}`;
}

/** What the build step needs besides the output (§4.4). */
export type AnnotationBreakpointOptions = {
  /** The per-project switches (S6); an absent member means on. */
  switches?: SourceCommentSwitches;
  /** A comment the user disabled this session (S3), by `annotationStateKey`. */
  isDisabled?: (key: string) => boolean;
  /** The build's integer symbols, for the `WPMEM` arguments; read from the output when absent. */
  symbols?: ConditionSymbols;
};

/**
 * Every breakpoint a build's DeZog comments stand for - `LOGPOINT`, `ASSERTION` and `WPMEM` alike -
 * so the IDE installs them with **one** `resetBreakpointsTo(list, { kind: "annotation" })` (§4.4):
 * two installs would each delete the other's.
 *
 * - `ASSERTION`: an execution breakpoint at the comment's address that stops when the expression is
 *   **false** (`!(<expr>)`, compiled with the DeZog dialect); a bare one stops every time.
 * - `WPMEM`: one memory breakpoint per access kind (`rw` gives two) over the range (S10); an omitted
 *   address is the comment line's own, in its partition (§2.2).
 *
 * @param output The build's output
 * @param resourceOf The project-relative resource of a source file (what source breakpoints use)
 * @param partitionOf The partition of an annotation the build did not place in one, from its segment
 * @param options The switches and the session's disabled comments
 */
export function annotationBreakpoints(
  output: KliveCompilerOutput | undefined,
  resourceOf: (filename: string) => string,
  partitionOf?: (annotation: SourceAnnotation) => number | undefined,
  options: AnnotationBreakpointOptions = {}
): BreakpointInfo[] {
  const debuggable = output as unknown as DebuggableOutput;
  const symbols =
    options.symbols ?? integerSymbolsOf((output as { symbols?: Record<string, unknown> })?.symbols);
  const assertionsOn = options.switches?.assertion !== false;
  const wpmemOn = options.switches?.wpmem !== false;
  const result: BreakpointInfo[] = [];
  for (const annotation of debuggable?.debugAnnotations ?? []) {
    const filename = debuggable.sourceFileList?.[annotation.fileIndex]?.filename;
    if (!filename) continue;
    const resource = resourceOf(filename);
    const partition = annotation.partition ?? partitionOf?.(annotation);
    const disabled = !!options.isDisabled?.(annotationStateKey(resource, annotation.line, annotation.kind));
    const common: BreakpointInfo = {
      owner: { kind: "annotation" },
      resource,
      line: annotation.line,
      ...(disabled ? { disabled: true } : {})
    };
    switch (annotation.kind) {
      case "LOGPOINT":
        result.push({
          ...common,
          address: annotation.address & 0xffff,
          ...(partition !== undefined ? { partition } : {}),
          exec: true,
          logMessage: annotation.text,
          logDialect: "dezog"
        });
        break;
      case "ASSERTION":
        if (!assertionsOn) break;
        result.push({
          ...common,
          address: annotation.address & 0xffff,
          ...(partition !== undefined ? { partition } : {}),
          exec: true,
          annotationKind: "ASSERTION",
          annotationText: annotation.text,
          ...(annotation.text
            ? { condition: `!(${annotation.text})`, conditionDialect: "dezog" as const }
            : {})
        });
        break;
      case "WPMEM": {
        if (!wpmemOn) break;
        const parsed = parseWpmemArgs(annotation.text, symbols);
        if ("error" in parsed) break;
        const { address, length, access } = parsed.args;
        const at = address ?? annotation.address & 0xffff;
        const place: BreakpointInfo = {
          ...common,
          address: at,
          // --- An explicit address is a 64K address; the line's own is banked (§2.2)
          ...(address === undefined && partition !== undefined ? { partition } : {}),
          ...(length > 1 ? { length } : {}),
          annotationKind: "WPMEM",
          annotationText: annotation.text
        };
        if (access !== "w") result.push({ ...place, memoryRead: true });
        if (access !== "r") result.push({ ...place, memoryWrite: true });
        break;
      }
    }
  }
  return result;
}

/**
 * The logpoints a build's `LOGPOINT` comments stand for, owned by the build (L10): the `LOGPOINT`
 * part of `annotationBreakpoints`.
 */
export function annotationLogpoints(
  output: KliveCompilerOutput | undefined,
  resourceOf: (filename: string) => string,
  partitionOf?: (annotation: SourceAnnotation) => number | undefined
): BreakpointInfo[] {
  return annotationBreakpoints(output, resourceOf, partitionOf).filter(
    (bp) => bp.annotationKind === undefined
  );
}
