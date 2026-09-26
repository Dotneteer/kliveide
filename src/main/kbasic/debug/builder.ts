import type { FileLine, ListFileItem } from "@abstractions/CompilerInfo";
import type { StatementEntry } from "../ir/mir";
import type { LineInfo } from "../backend/emit";
import type { SourceSet } from "../syntax/source";

/**
 * The debug-info builder (`.docs/kbasic-debug-builder.md`): joins the generated program's line
 * table with the assembler's list items and turns statement ids into the classic tables the IDE's
 * breakpoint and execution-point code reads (§5), plus each statement's address range.
 */
export type StatementAddresses = {
  sid: number;
  /** Entry: the first code byte after the statement's marker. */
  start: number;
  /** One past the end of the first run of the statement's code; `start` for an elided statement. */
  end: number;
  elided: boolean;
};

export type ClassicTables = {
  sourceFileList: { filename: string; includes: [] }[];
  listFileItems: ListFileItem[];
  sourceMap: Record<number, FileLine>;
};

export type DebugBuildInput = {
  statements: StatementEntry[];
  lines: LineInfo[];
  /** The assembler's list items; those of the generated program have `programFileIndex`. */
  listFileItems: ListFileItem[];
  programFileIndex: number;
  sources: SourceSet;
};

export type DebugBuild = {
  classic: ClassicTables;
  addresses: StatementAddresses[];
  /** Problems the validator found (§7); a test fails on any. */
  problems: string[];
};

export function buildDebugInfo(input: DebugBuildInput): DebugBuild {
  const problems: string[] = [];
  const items = input.listFileItems
    .filter((i) => i.fileIndex === input.programFileIndex && (i.codeLength ?? 0) > 0)
    .sort((a, b) => a.lineNumber - b.lineNumber);
  const byLine = new Map<number, ListFileItem>();
  for (const item of items) byLine.set(item.lineNumber, item);

  // --- Entries: for each marker line, the first code line after it
  const addresses: StatementAddresses[] = [];
  const markerLines = new Map<number, number>();
  input.lines.forEach((info, i) => {
    if (info.marker === "stmt") {
      if (markerLines.has(info.sid)) problems.push(`G1: statement ${info.sid} has more than one entry marker`);
      markerLines.set(info.sid, i + 1);
    }
  });
  const itemAfter = (line: number): ListFileItem | undefined => {
    for (let n = line + 1; n <= input.lines.length; n++) {
      const item = byLine.get(n);
      if (item) return item;
    }
    return undefined;
  };
  for (const s of input.statements) {
    const markerLine = markerLines.get(s.sid);
    if (markerLine === undefined) {
      problems.push(`G1: statement ${s.sid} has no entry marker`);
      continue;
    }
    const first = itemAfter(markerLine);
    if (!first) continue;
    const elided = input.lines[first.lineNumber - 1]?.sid !== s.sid;
    let end = first.address;
    if (!elided) {
      // --- The first run: consecutive code lines of this statement
      for (let n = first.lineNumber; n <= input.lines.length; n++) {
        const info = input.lines[n - 1];
        if (info.marker === "stmt" && info.sid !== s.sid) break;
        const item = byLine.get(n);
        if (!item) continue;
        if (info.sid !== s.sid) break;
        end = item.address + (item.codeLength ?? 0);
      }
    }
    addresses.push({ sid: s.sid, start: first.address, end, elided });
  }

  return { classic: classicTables(input, addresses), addresses, problems };
}

/** §5: one list item per statement, the BASIC files only, statement entry → line and columns. */
function classicTables(input: DebugBuildInput, addresses: StatementAddresses[]): ClassicTables {
  const files: string[] = [];
  const fileIndex = (name: string) => {
    let i = files.indexOf(name);
    if (i < 0) {
      i = files.length;
      files.push(name);
    }
    return i;
  };
  const listFileItems: ListFileItem[] = [];
  const sourceMap: Record<number, FileLine> = {};
  const bySid = new Map(input.statements.map((s) => [s.sid, s]));
  for (const a of addresses) {
    if (a.elided) continue;
    const s = bySid.get(a.sid)!;
    const file = input.sources.get(s.span.file);
    const start = file.location(s.span.start);
    const end = file.location(Math.max(s.span.start, s.span.end));
    const index = fileIndex(start.fileName);
    const endColumn = end.line === start.line ? end.column : undefined;
    listFileItems.push({ fileIndex: index, address: a.start, lineNumber: start.line, segmentIndex: 0, codeLength: a.end - a.start });
    if (sourceMap[a.start] === undefined) {
      sourceMap[a.start] = { fileIndex: index, line: start.line, startColumn: start.column, ...(endColumn !== undefined ? { endColumn } : {}) };
    }
  }
  listFileItems.sort((x, y) => x.fileIndex - y.fileIndex || x.lineNumber - y.lineNumber || x.address - y.address);
  return { sourceFileList: files.map((filename) => ({ filename, includes: [] as [] })), listFileItems, sourceMap };
}
