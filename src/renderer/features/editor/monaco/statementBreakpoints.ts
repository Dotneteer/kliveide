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

/**
 * Where statements start on a line of BASIC (0-based columns), read from its text: the first
 * non-blank character, and after each `:` and each THEN or ELSE outside a string. A comment (`'`
 * or REM) ends the scan. An approximation of the parser's statement boundaries that needs no
 * compile, for re-anchoring breakpoints while the user types (plan §10.3); a leading line number
 * or label belongs to the first statement's column.
 */
export function statementStartsOf(lineText: string): number[] {
  const starts: number[] = [];
  const skipBlanks = (i: number) => {
    while (i < lineText.length && /\s/.test(lineText[i])) i++;
    return i;
  };
  const push = (i: number) => {
    const at = skipBlanks(i);
    if (at < lineText.length && lineText[at] !== "'" && !/^REM\b/i.test(lineText.slice(at))) starts.push(at);
    return at;
  };
  let i = push(0);
  while (i < lineText.length) {
    const c = lineText[i];
    if (c === '"') {
      i++;
      while (i < lineText.length && !(lineText[i] === '"' && lineText[i + 1] !== '"')) i += lineText[i] === '"' ? 2 : 1;
      i++;
      continue;
    }
    if (c === "'" || (/^REM\b/i.test(lineText.slice(i)) && (i === 0 || !/\w/.test(lineText[i - 1])))) break;
    if (c === ":") {
      i = push(i + 1);
      continue;
    }
    const word = /^(THEN|ELSE)\b/i.exec(lineText.slice(i));
    if (word && (i === 0 || !/\w/.test(lineText[i - 1]))) {
      i = push(i + word[0].length);
      continue;
    }
    i++;
  }
  return starts;
}

/**
 * The column a statement breakpoint moves to after an edit inside its line (plan §10.3). The edit
 * replaced `[startColumn, endColumn)` of the old line with `text`. An edit before the statement
 * moves it by the length difference; an edit over its start re-anchors it to the statement that now
 * starts nearest the old column. Undefined when no statement other than the line's first is left:
 * the breakpoint loses its column and becomes the line's.
 */
export function reanchorColumn(
  column: number,
  edit: { startColumn: number; endColumn: number; text: string },
  newLineText: string
): number | undefined {
  const starts = statementStartsOf(newLineText);
  const further = starts.slice(1);
  if (!further.length) return undefined;
  let wanted = column;
  if (edit.endColumn <= column) wanted = column + edit.text.length - (edit.endColumn - edit.startColumn);
  else if (edit.startColumn < column || (edit.startColumn === column && edit.endColumn > column)) wanted = edit.startColumn;
  if (further.includes(wanted)) return wanted;
  return further.reduce((best, s) => (Math.abs(s - wanted) < Math.abs(best - wanted) ? s : best), further[0]);
}
