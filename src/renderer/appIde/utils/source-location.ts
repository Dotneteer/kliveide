import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { SourceStopInfo } from "@abstractions/SourceDebugInfo";

import { hasSourceLevelDebug, isDebuggableCompilerOutput } from "./compiler-utils";

/**
 * Where a paused program stands in its source (plan §10.4, §10.5): the file, the statement's lines
 * and columns (1-based lines, 0-based columns, end exclusive), and whether it is a return point.
 */
export type SourceLocation = {
  fileIndex: number;
  filename: string;
  line: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  /**
   * `returnPoint`: control came back from a call in the middle of this statement (§10.2.6);
   * `error`: this statement raised a runtime error, and the machine stopped before the report.
   */
  kind: "statement" | "returnPoint" | "error" | "other";
  /** A return point: the routine that returned. */
  returnedFrom?: string;
  /** An error stop: the ROM report (`3 Subscript wrong`). */
  error?: string;
  /** Whether the location comes from source-level debug info (statement columns are exact). */
  sourceLevel: boolean;
};

/**
 * The source location of the execution point. With source-level debug info, the emulator's report
 * of the last stop decides (it knows about return points, whose PC is not a statement entry);
 * otherwise the classic `sourceMap` entry at PC. `partition` qualifies banked code (the classic
 * tables are not banked; source-level info with banking comes with CODEBANK).
 */
export function locateSource(
  result: KliveCompilerOutput | undefined,
  pc: number,
  stop?: SourceStopInfo,
  _partition?: number
): SourceLocation | undefined {
  if (!isDebuggableCompilerOutput(result)) return undefined;
  if (hasSourceLevelDebug(result) && stop) {
    const info = result.sourceLevelDebug;
    // --- An error stop is in the runtime: it shows the user statement that raised the error
    const statementIndex = stop.kind === "error" ? (stop.userStatementIndex ?? -1) : stop.statementIndex;
    const s = statementIndex >= 0 ? info.statements[statementIndex] : undefined;
    if (s) {
      const filename = info.files[s.fileIndex]?.filename ?? result.sourceFileList[s.fileIndex]?.filename;
      if (filename === undefined) return undefined;
      const from = stop.returnedFromGosub ? "GOSUB" : stop.returnedFrom !== undefined ? info.callables[stop.returnedFrom]?.name : undefined;
      return {
        fileIndex: s.fileIndex,
        filename,
        line: s.startLine,
        endLine: s.endLine,
        startColumn: s.startColumn,
        endColumn: s.endColumn,
        kind: stop.kind,
        ...(from !== undefined ? { returnedFrom: from } : {}),
        ...(stop.error ? { error: stop.error.report } : {}),
        sourceLevel: true
      };
    }
  }
  const fileLine = result.sourceMap[pc];
  if (!fileLine) return undefined;
  const filename = result.sourceFileList[fileLine.fileIndex]?.filename;
  if (filename === undefined) return undefined;
  return {
    fileIndex: fileLine.fileIndex,
    filename,
    line: fileLine.line,
    endLine: fileLine.line,
    ...(fileLine.startColumn !== undefined ? { startColumn: fileLine.startColumn } : {}),
    ...(fileLine.endColumn !== undefined ? { endColumn: fileLine.endColumn } : {}),
    kind: "statement",
    sourceLevel: false
  };
}
