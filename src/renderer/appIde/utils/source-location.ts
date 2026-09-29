import type { KliveCompilerOutput, ListFileItem } from "@abstractions/CompilerInfo";
import { resolvedPartitionFor } from "@common/utils/source-breakpoint-partition";
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
 * otherwise the list item at PC — in PC's partition when several banked sources share the address
 * (plan §10.4), the line's columns from `sourceMap`.
 */
export function locateSource(
  result: KliveCompilerOutput | undefined,
  pc: number,
  stop?: SourceStopInfo,
  where: PcPartition = {}
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
  // --- `sourceMap` has one entry per address: when banked sources share PC, it may name another
  // --- bank's line. Then the list item at PC in PC's partition decides the line.
  const candidates = listItemsAtPc(result, pc, where).filter((li) => !li.isMacroInvocation);
  // --- Code at PC exists only in other partitions: nothing of this program is running here
  if (!candidates.length && where.partition !== undefined && listItemsAtPc(result, pc).some((li) => !li.isMacroInvocation)) return undefined;
  const mapped = !!fileLine && (candidates.length === 0 || candidates.some((li) => li.fileIndex === fileLine.fileIndex && li.lineNumber === fileLine.line));
  const item = mapped ? undefined : candidates[0];
  const fileIndex = item?.fileIndex ?? fileLine?.fileIndex;
  const line = item?.lineNumber ?? fileLine?.line;
  if (fileIndex === undefined || line === undefined) return undefined;
  const filename = result.sourceFileList[fileIndex]?.filename;
  if (filename === undefined) return undefined;
  const columns = fileLine && fileLine.fileIndex === fileIndex && fileLine.line === line ? fileLine : undefined;
  return {
    fileIndex,
    filename,
    line,
    endLine: line,
    ...(columns?.startColumn !== undefined ? { startColumn: columns.startColumn } : {}),
    ...(columns?.endColumn !== undefined ? { endColumn: columns.endColumn } : {}),
    kind: "statement",
    sourceLevel: false
  };
}

/** Where PC is: the partition it is in, and the machine that decides what a segment's bank means. */
export type PcPartition = { partition?: number; machineId?: string };

/**
 * The list items whose code starts at PC (`fileIndex` narrows to one file). Banked sources share
 * addresses (`.bank`, `.page`): with PC's partition known, an item of a banked segment counts only
 * when its partition is PC's, so the other bank's line is never shown for this one's code (§10.4).
 * Unbanked items always count.
 */
export function listItemsAtPc(
  result: KliveCompilerOutput | undefined,
  pc: number,
  where: PcPartition = {},
  fileIndex?: number
): ListFileItem[] {
  if (!isDebuggableCompilerOutput(result)) return [];
  const items = result.listFileItems.filter((li) => li.address === pc && (fileIndex === undefined || li.fileIndex === fileIndex));
  if (where.partition === undefined) return items;
  return items.filter((li) => {
    const segment = li.segmentIndex !== undefined ? result.segments?.[li.segmentIndex] : undefined;
    const partition = resolvedPartitionFor(segment, li.address, where.machineId);
    return partition === undefined || partition === where.partition;
  });
}
