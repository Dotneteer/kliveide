import type { KliveCompilerOutput, SourceLevelDebugInfo, StatementDebugInfo } from "@abstractions/CompilerInfo";

import { statementAtColumn } from "@common/utils/breakpoints";
import { hasSourceLevelDebug, isDebuggableCompilerOutput } from "@renderer/appIde/utils/compiler-utils";

/**
 * Statement breakpoints in the editor (plan §10.3): the rules, kept apart from `MonacoEditor.tsx`
 * so they can be tested without an editor. A gutter click still sets a *line* breakpoint (the
 * line's first statement); each further statement of a line that has more than one gets an inline
 * marker, and clicking it sets a breakpoint on that statement only (`BreakpointInfo.column`).
 */

/** The source-level file index of an editor resource (`/path/in/project.bas`), or -1. */
export function sourceFileIndex(info: SourceLevelDebugInfo, resourceName: string, isWindows: boolean): number {
  const sep = isWindows ? "\\" : "/";
  return info.files.findIndex((f) => f.filename.replaceAll(sep, "/").endsWith(resourceName));
}

/** Where the inline statement markers go: every statement but the first of a line with several. */
export function statementMarkers(info: SourceLevelDebugInfo, fileIndex: number): StatementDebugInfo[] {
  const byLine = new Map<number, StatementDebugInfo[]>();
  for (const s of info.statements) {
    if (s.fileIndex !== fileIndex || s.endAddress <= s.startAddress) continue;
    const list = byLine.get(s.startLine) ?? [];
    list.push(s);
    byLine.set(s.startLine, list);
  }
  const out: StatementDebugInfo[] = [];
  for (const list of byLine.values()) {
    if (list.length < 2) continue;
    // --- Statements nested in a one-line IF share its line: each one's own start is what counts
    const starts = [...new Map(list.map((s) => [s.startColumn, s])).values()].sort((a, b) => a.startColumn - b.startColumn);
    out.push(...starts.slice(1));
  }
  return out.sort((a, b) => a.startLine - b.startLine || a.startColumn - b.startColumn);
}

/**
 * The code address Run to Cursor should stop at for the cursor's line and column (0-based): the
 * statement under the cursor with source-level info, otherwise the line's first list-file item.
 */
export function runToCursorAddress(
  result: KliveCompilerOutput | undefined,
  resourceName: string,
  isWindows: boolean,
  line: number,
  column: number
): number | undefined {
  if (!isDebuggableCompilerOutput(result)) return undefined;
  if (hasSourceLevelDebug(result)) {
    const fileIndex = sourceFileIndex(result.sourceLevelDebug, resourceName, isWindows);
    if (fileIndex >= 0) {
      const statement = statementAtColumn(result.sourceLevelDebug, fileIndex, line, column);
      if (statement) return statement.startAddress;
    }
  }
  const sep = isWindows ? "\\" : "/";
  const fileIndex = result.sourceFileList.findIndex((f) => f.filename.replaceAll(sep, "/").endsWith(resourceName));
  if (fileIndex < 0) return undefined;
  return result.listFileItems.find((li) => li.fileIndex === fileIndex && li.lineNumber === line && !li.isMacroInvocation)?.address;
}
