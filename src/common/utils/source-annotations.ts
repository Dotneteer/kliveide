import type {
  AssemblerErrorInfo,
  DebuggableOutput,
  KliveCompilerOutput,
  SourceAnnotation
} from "@abstractions/CompilerInfo";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { compileLogTemplate } from "./breakpoint-condition/logpoint-template";
import { integerSymbolsOf } from "./breakpoint-condition/integer-symbols";

/*
 * DeZog-style source annotations (`.plans/LOGPOINTS_PLAN.md` §4.7): the `LOGPOINT` comments a build
 * finds, checked into build warnings, and turned into the logpoints the build owns.
 *
 * Kind-tagged throughout, so G1.5 (`ASSERTION`, `WPMEM`) adds its kinds here and nothing else.
 * No renderer or main-process imports: the main process checks a build's annotations, the IDE
 * installs them.
 */

/** The annotation keywords, case-sensitive as in sjasmplus's `SLDOPT COMMENT` (§1.2). */
export const ANNOTATION_KEYWORDS = ["LOGPOINT"] as const;

const LOGPOINT_PATTERN = /(?:^|[^A-Za-z0-9_.])LOGPOINT(?![A-Za-z0-9_])(.*)$/s;

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

/**
 * Check a build's `LOGPOINT` annotations (L13): one that does not compile is dropped and reported as
 * a build warning with its file and line; one naming an unknown label stays (it is inactive until a
 * build defines the label, C14) and is reported too. Never an error: a debugging aid must not
 * break a build. The machine facts are not known here, so the emulator compiles the template again
 * when it arms it.
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
    const result = compileLogTemplate(annotation.text, "dezog", { accessKind: "exec", symbols });
    const filename = debuggable.sourceFileList?.[annotation.fileIndex]?.filename ?? "";
    const warn = (message: string) =>
      warnings.push({
        errorCode: LOGPOINT_WARNING_CODE,
        filename,
        line: annotation.line,
        startPosition: 0,
        endPosition: null,
        startColumn: 0,
        endColumn: null,
        message,
        isWarning: true
      });
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
 * The logpoints a build's `LOGPOINT` comments stand for, owned by the build (L10). Their source
 * location is kept for display and click-to-source; each fires at its own address (§4.1).
 *
 * @param output The build's output
 * @param resourceOf The project-relative resource of a source file (what source breakpoints use)
 * @param partitionOf The partition of an annotation the build did not place in one, from its segment
 */
export function annotationLogpoints(
  output: KliveCompilerOutput | undefined,
  resourceOf: (filename: string) => string,
  partitionOf?: (annotation: SourceAnnotation) => number | undefined
): BreakpointInfo[] {
  const debuggable = output as unknown as DebuggableOutput;
  const result: BreakpointInfo[] = [];
  for (const annotation of debuggable?.debugAnnotations ?? []) {
    if (annotation.kind !== "LOGPOINT") continue;
    const filename = debuggable.sourceFileList?.[annotation.fileIndex]?.filename;
    if (!filename) continue;
    const partition = annotation.partition ?? partitionOf?.(annotation);
    result.push({
      owner: { kind: "annotation" },
      address: annotation.address & 0xffff,
      ...(partition !== undefined ? { partition } : {}),
      exec: true,
      resource: resourceOf(filename),
      line: annotation.line,
      logMessage: annotation.text,
      logDialect: "dezog"
    });
  }
  return result;
}
