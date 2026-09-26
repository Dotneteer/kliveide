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
  /** The generated program's text, one entry per line table entry (for the branch checks). */
  text: string[];
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

  validate(input, byLine, addresses, problems);
  return { classic: classicTables(input, addresses), addresses, problems };
}

// =================================================================================================
// The validator (§7): the static checks

const LABEL_LINE = /^([A-Za-z_][\w.]*):$/;
const BRANCH = /^\s+(jp|jr|djnz|call)\s+(?:(?:nz|z|nc|c|po|pe|p|m),\s*)?([A-Za-z_][\w.]*)\s*$/;

function validate(input: DebugBuildInput, byLine: Map<number, ListFileItem>, addresses: StatementAddresses[], problems: string[]): void {
  const lineCount = input.lines.length;
  const codeAt = (from: number): ListFileItem | undefined => {
    for (let n = from; n <= lineCount; n++) {
      const item = byLine.get(n);
      if (item) return item;
    }
    return undefined;
  };

  // --- G1 (levels 0-1): after its first run, a statement has no more code
  const ranges = addresses.filter((a) => !a.elided);
  const bySid = new Map(ranges.map((a) => [a.sid, a]));
  input.lines.forEach((info, i) => {
    const item = byLine.get(i + 1);
    const range = bySid.get(info.sid);
    if (item && range && (item.address < range.start || item.address >= range.end)) {
      problems.push(`G1: statement ${info.sid} has code outside its run at line ${i + 1}`);
    }
  });

  // --- Statement ranges must not overlap: every code byte belongs to one statement at most
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k].start < sorted[k - 1].end) problems.push(`G1: statements ${sorted[k - 1].sid} and ${sorted[k].sid} overlap`);
  }
  const statementAt = (address: number) => sorted.find((a) => address >= a.start && address < a.end);

  // --- G2: a branch from outside a statement lands on its entry; G5: every user call is a call site
  const labels = new Map<string, number>();
  input.text.forEach((line, i) => {
    const m = LABEL_LINE.exec(line);
    const item = m ? codeAt(i + 2) : undefined;
    if (m && item) labels.set(m[1], item.address);
  });
  input.text.forEach((line, i) => {
    const m = BRANCH.exec(line);
    if (!m) return;
    const [, op, target] = m;
    const info = input.lines[i];
    if (op === "call" && !target.startsWith("core.") && !info.site) problems.push(`G5: the call to ${target} at line ${i + 1} has no call-site record`);
    const address = labels.get(target);
    if (address === undefined) return;
    const into = statementAt(address);
    if (into && into.sid !== info.sid && address !== into.start) {
      problems.push(`G2: ${op} ${target} at line ${i + 1} branches into the middle of statement ${into.sid}`);
    }
  });

  // --- Spans: inside their file, not empty, not starting or ending with a separator, and statements
  // --- sharing a line do not overlap
  const onLine = new Map<string, { start: number; end: number; sid: number }[]>();
  for (const s of input.statements) {
    const file = input.sources.get(s.span.file);
    const text = file.text.slice(s.span.start, s.span.end);
    if (s.span.end <= s.span.start || text.trim() !== text || text.startsWith(":") || text.endsWith(":")) {
      problems.push(`span: statement ${s.sid} has the span ${JSON.stringify(text)}`);
    }
    const key = `${s.span.file}:${file.location(s.span.start).line}`;
    const list = onLine.get(key) ?? [];
    for (const other of list) {
      if (s.span.start < other.end && other.start < s.span.end && !nested(s.span, other)) {
        problems.push(`span: statements ${other.sid} and ${s.sid} overlap`);
      }
    }
    list.push({ start: s.span.start, end: s.span.end, sid: s.sid });
    onLine.set(key, list);
  }
}

/**
 * A block statement's parts can share a line with the statements they contain (`IF a THEN PRINT 1`:
 * the IF header's span holds only `IF a THEN`), so an overlap is a problem only between two spans
 * neither of which contains the other.
 */
function nested(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return (a.start <= b.start && b.end <= a.end) || (b.start <= a.start && a.end <= b.end);
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
