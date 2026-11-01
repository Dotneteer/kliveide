import type { Provenance } from "@common/roms/romAnnotationTools";
import { isCpu, type Cpu } from "./image/cpu";

/*
 * The `.ann` format (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §5, D5): the small text the AI writes and
 * the postprocessor compiles into a ROM sidecar. One file covers (part of) one ROM page.
 *
 *   # A comment line (column 0 only)
 *   rom ep-exos21.rom page 0 cpu z80      the header: required, first
 *   default observed                       the provenance of every entry not listed below
 *
 *   code 0000-0B3C                         regions: code, bytes, words, text, fill, defc;
 *   bytes 0B3D-0B40 rows=1 radix=binary    bytes take rows=<n> and radix=binary
 *
 *   @0B40 SEG1_SERVICE                     a block: the offset and its label (optional)
 *     A synopsis line, two spaces in       the synopsis, one line per line
 *     .0B41 A' = service number            an end-of-line comment (indent optional)
 *
 *   manual 0B40:label 0B41:line            provenance exceptions: observed / manual / derived,
 *   delete 0C00:synopsis                   then <offset>:label|line|region; delete removes a
 *   question 0C40 Needs a run              base entry (label, synopsis, comment, line)
 *   feedback missing 0B40 Card lacked ...  notes for the session (D11), not the sidecar
 *
 * Escapes: a comment's (or note's) newline is `\n` and its backslash `\\`. A synopsis line that
 * starts with `\` or looks like a comment line is written with one more `\` in front, which the
 * parser drops; `\` alone is an empty line. Offsets are four hex digits, `$` optional.
 */

/** The region kinds of the format, and the sidecar region each stands for. */
export const ANN_REGION_KINDS = ["code", "bytes", "words", "text", "fill", "defc"] as const;
export type AnnRegionKind = (typeof ANN_REGION_KINDS)[number];

export const ANN_FEEDBACK_KINDS = ["missing", "wrong", "pattern", "listing"] as const;
export type AnnFeedbackKind = (typeof ANN_FEEDBACK_KINDS)[number];

export const ANN_DELETE_KINDS = ["label", "synopsis", "comment", "line"] as const;
export type AnnDeleteKind = (typeof ANN_DELETE_KINDS)[number];

/** What a provenance key names: the sidecar's `<page>:<offset>:<kind>` without the page. */
export type AnnProvenanceKind = "label" | "line" | "region";

const PROVENANCES: readonly Provenance[] = ["observed", "manual", "derived"];

export type AnnHeader = { rom: string; page: number; cpu: Cpu };

/** Every entry remembers its source line, so a problem can point at it. */
type Located = { line: number };

export type AnnLabel = Located & { offset: number; name: string };
export type AnnText = Located & { offset: number; text: string };
export type AnnRegion = Located & {
  start: number;
  end: number;
  kind: AnnRegionKind;
  rowBytes?: number;
  radix?: "binary";
};
export type AnnProvenanceMark = Located & { offset: number; kind: AnnProvenanceKind; provenance: Provenance };
export type AnnDelete = Located & { offset: number; kind: AnnDeleteKind };
export type AnnQuestion = Located & { offset: number; text: string };
export type AnnFeedback = Located & { kind: AnnFeedbackKind; from: number; to: number; text: string };

export type AnnDocument = {
  header?: AnnHeader;
  defaultProvenance: Provenance;
  regions: AnnRegion[];
  labels: AnnLabel[];
  synopses: AnnText[];
  comments: AnnText[];
  provenance: AnnProvenanceMark[];
  deletes: AnnDelete[];
  questions: AnnQuestion[];
  feedback: AnnFeedback[];
};

export type AnnProblem = { file: string; line: number; message: string };

export function emptyAnnDocument(): AnnDocument {
  return {
    defaultProvenance: "observed",
    regions: [],
    labels: [],
    synopses: [],
    comments: [],
    provenance: [],
    deletes: [],
    questions: [],
    feedback: []
  };
}

// ------------------------------------------------------------------------------------------------
// Parsing

const OFFSET = /^\$?([0-9a-f]{4})$/i;
const RANGE = /^\$?([0-9a-f]{4})-\$?([0-9a-f]{4})$/i;
const COMMENT_LINE = /^(?: {2})?\.([0-9a-f]{4}) (.*)$/is;
const LOOKS_LIKE_COMMENT = /^\.[0-9a-f]{4}( |$)/i;
const LABEL = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parses one `.ann` file. Problems are collected, not thrown: every bad line is reported at once. */
export function parseAnn(text: string, fileName: string): { document: AnnDocument; problems: AnnProblem[] } {
  const document = emptyAnnDocument();
  const problems: AnnProblem[] = [];
  const problem = (line: number, message: string): void => {
    problems.push({ file: fileName, line, message });
  };
  const blocks = new Set<number>();
  let block: { offset: number; synopsis: string[]; line: number } | undefined;

  const closeBlock = () => {
    if (block?.synopsis.length) {
      document.synopses.push({ offset: block.offset, text: block.synopsis.join("\n"), line: block.line });
    }
    block = undefined;
  };

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === "" || raw.startsWith("#")) return;

    // --- An end-of-line comment, at the top level or inside a block
    const comment = COMMENT_LINE.exec(raw);
    if (comment) {
      document.comments.push({ offset: parseInt(comment[1], 16), text: unescapeText(comment[2]), line });
      return;
    }

    // --- A synopsis line belongs to the open block
    if (raw.startsWith("  ")) {
      if (!block) return problem(line, "A synopsis line needs a block (@offset) above it");
      block.synopsis.push(unescapeSynopsisLine(raw.slice(2)));
      return;
    }
    if (raw.startsWith(" ")) return problem(line, "Indent synopsis lines by exactly two spaces");

    closeBlock();
    const words = raw.trim().split(/\s+/);
    const [keyword] = words;

    if (keyword.startsWith("@")) {
      const offset = parseOffset(keyword.slice(1));
      if (offset === undefined) return problem(line, `"${keyword}" is not @ and a four-digit hex offset`);
      if (words.length > 2) return problem(line, "A block line is @offset and at most one label");
      if (blocks.has(offset)) return problem(line, `Block @${hex(offset)} appears twice in this file`);
      blocks.add(offset);
      if (words[1] !== undefined) {
        if (!LABEL.test(words[1])) return problem(line, `"${words[1]}" is not a label name`);
        document.labels.push({ offset, name: words[1], line });
      }
      block = { offset, synopsis: [], line };
      return;
    }

    switch (keyword) {
      case "rom":
        return parseHeader(words, line);
      case "default":
        if (words.length !== 2 || !isProvenance(words[1])) {
          return problem(line, "default takes one provenance: observed, manual or derived");
        }
        document.defaultProvenance = words[1];
        return;
      case "observed":
      case "manual":
      case "derived":
        return parseProvenanceMarks(keyword, words.slice(1), line);
      case "delete":
        return parseDeletes(words.slice(1), line);
      case "question":
        return parseQuestion(raw, line);
      case "feedback":
        return parseFeedback(raw, line);
      default:
        if ((ANN_REGION_KINDS as readonly string[]).includes(keyword)) return parseRegion(keyword as AnnRegionKind, words, line);
        return problem(line, `Unknown line "${keyword}"`);
    }
  });
  closeBlock();
  if (!document.header) problem(1, "The header line (rom <file> page <n> cpu <z80|z80n>) is missing");
  return { document, problems };

  function parseHeader(words: string[], line: number) {
    if (document.header) return problem(line, "The header appears twice");
    const [, rom, pageWord, page, cpuWord, cpu] = words;
    if (words.length !== 6 || pageWord !== "page" || cpuWord !== "cpu" || !/^\d+$/.test(page ?? "") || !isCpu(cpu)) {
      return problem(line, "The header is: rom <file> page <n> cpu <z80|z80n>");
    }
    document.header = { rom, page: Number(page), cpu: cpu.toLowerCase() as Cpu };
  }

  function parseRegion(kind: AnnRegionKind, words: string[], line: number) {
    const range = parseRange(words[1]);
    if (!range) return problem(line, `"${words[1] ?? ""}" is not a hex range (0B3D-0B40)`);
    const region: AnnRegion = { start: range[0], end: range[1], kind, line };
    for (const option of words.slice(2)) {
      const [name, value] = option.split("=");
      if (kind === "bytes" && name === "rows" && /^\d+$/.test(value ?? "") && Number(value) > 0) {
        region.rowBytes = Number(value);
      } else if (kind === "bytes" && name === "radix" && value === "binary") {
        region.radix = "binary";
      } else {
        return problem(line, `"${option}" is not an option of a ${kind} region`);
      }
    }
    document.regions.push(region);
  }

  function parseProvenanceMarks(provenance: Provenance, keys: string[], line: number) {
    if (!keys.length) return problem(line, `${provenance} needs at least one <offset>:label|line|region`);
    for (const key of keys) {
      const [offsetText, kind] = key.split(":");
      const offset = parseOffset(offsetText);
      if (offset === undefined || !["label", "line", "region"].includes(kind)) {
        problem(line, `"${key}" is not <offset>:label|line|region`);
        continue;
      }
      document.provenance.push({ offset, kind: kind as AnnProvenanceKind, provenance, line });
    }
  }

  function parseDeletes(keys: string[], line: number) {
    if (!keys.length) return problem(line, "delete needs at least one <offset>:label|synopsis|comment|line");
    for (const key of keys) {
      const [offsetText, kind] = key.split(":");
      const offset = parseOffset(offsetText);
      if (offset === undefined || !(ANN_DELETE_KINDS as readonly string[]).includes(kind)) {
        problem(line, `"${key}" is not <offset>:label|synopsis|comment|line`);
        continue;
      }
      document.deletes.push({ offset, kind: kind as AnnDeleteKind, line });
    }
  }

  function parseQuestion(raw: string, line: number) {
    const match = /^question\s+(\S+)\s+(.+)$/s.exec(raw);
    const offset = match ? parseOffset(match[1]) : undefined;
    if (!match || offset === undefined) return problem(line, "A question is: question <offset> <text>");
    document.questions.push({ offset, text: noteText(match[2]), line });
  }

  function parseFeedback(raw: string, line: number) {
    const match = /^feedback\s+(\S+)\s+(\S+)\s+(.+)$/s.exec(raw);
    if (!match || !(ANN_FEEDBACK_KINDS as readonly string[]).includes(match[1])) {
      return problem(line, `Feedback is: feedback <${ANN_FEEDBACK_KINDS.join("|")}> <offset or range> <text>`);
    }
    const single = parseOffset(match[2]);
    const range = single === undefined ? parseRange(match[2]) : [single, single];
    if (!range) return problem(line, `"${match[2]}" is not an offset or a range`);
    document.feedback.push({ kind: match[1] as AnnFeedbackKind, from: range[0], to: range[1], text: noteText(match[3]), line });
  }
}

function isProvenance(text: string | undefined): text is Provenance {
  return (PROVENANCES as readonly string[]).includes(text ?? "");
}

function parseOffset(text: string | undefined): number | undefined {
  const match = OFFSET.exec(text ?? "");
  return match ? parseInt(match[1], 16) : undefined;
}

function parseRange(text: string | undefined): [number, number] | undefined {
  const match = RANGE.exec(text ?? "");
  if (!match) return undefined;
  const [start, end] = [parseInt(match[1], 16), parseInt(match[2], 16)];
  return start <= end ? [start, end] : undefined;
}

/** A note's text: a JSON string when it is quoted, else the escaped rest of the line. */
function noteText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // --- Not valid JSON: taken as written
    }
  }
  return unescapeText(trimmed);
}

/** `\n` is a newline and `\\` a backslash; any other backslash stays as written. */
function unescapeText(text: string): string {
  return text.replace(/\\([\\n])/g, (_, c) => (c === "n" ? "\n" : "\\"));
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function unescapeSynopsisLine(text: string): string {
  return text.startsWith("\\") ? text.slice(1) : text;
}

function escapeSynopsisLine(text: string): string {
  return text === "" || text.startsWith("\\") || LOOKS_LIKE_COMMENT.test(text) ? `\\${text}` : text;
}

// ------------------------------------------------------------------------------------------------
// Writing

/** The width provenance and delete lists wrap at. */
const LIST_WIDTH = 92;

/**
 * A document as `.ann` text, in a fixed order: header, regions, blocks with their comments,
 * provenance exceptions, deletes, questions, feedback. Parsing the result gives the same document
 * (line numbers aside).
 */
export function writeAnn(document: AnnDocument, preamble: readonly string[] = []): string {
  const out: string[] = preamble.map((line) => `# ${line}`.trimEnd());
  const header = document.header;
  if (header) out.push(`rom ${header.rom} page ${header.page} cpu ${header.cpu}`);
  out.push(`default ${document.defaultProvenance}`);

  if (document.regions.length) {
    out.push("");
    for (const region of [...document.regions].sort((a, b) => a.start - b.start)) {
      const options = [
        ...(region.rowBytes !== undefined ? [`rows=${region.rowBytes}`] : []),
        ...(region.radix ? [`radix=${region.radix}`] : [])
      ];
      out.push([region.kind, `${hex(region.start)}-${hex(region.end)}`, ...options].join(" "));
    }
  }

  // --- Blocks: every offset with a label or a synopsis; comments go into the block they follow
  const labels = new Map(document.labels.map((l) => [l.offset, l.name]));
  const synopses = new Map(document.synopses.map((s) => [s.offset, s.text]));
  const starts = [...new Set([...labels.keys(), ...synopses.keys()])].sort((a, b) => a - b);
  const comments = [...document.comments].sort((a, b) => a.offset - b.offset);
  const commentLine = (c: AnnText, indent: string) => `${indent}.${hex(c.offset)} ${escapeText(c.text)}`;
  let next = 0;
  const leading = comments.filter((c) => starts.length === 0 || c.offset < starts[0]);
  if (leading.length) out.push("", ...leading.map((c) => commentLine(c, "")));
  next = leading.length;
  starts.forEach((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : Infinity;
    const name = labels.get(start);
    out.push("", name ? `@${hex(start)} ${name}` : `@${hex(start)}`);
    const synopsis = synopses.get(start);
    if (synopsis !== undefined) out.push(...synopsis.split("\n").map((l) => `  ${escapeSynopsisLine(l)}`));
    while (next < comments.length && comments[next].offset < end) out.push(commentLine(comments[next++], "  "));
  });

  const lists: string[] = [];
  for (const provenance of PROVENANCES) {
    const keys = document.provenance
      .filter((m) => m.provenance === provenance)
      .sort((a, b) => a.offset - b.offset || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0))
      .map((m) => `${hex(m.offset)}:${m.kind}`);
    lists.push(...wrapList(provenance, keys));
  }
  lists.push(...wrapList("delete", document.deletes.map((d) => `${hex(d.offset)}:${d.kind}`)));
  if (lists.length) out.push("", ...lists);

  const notes = [
    ...document.questions.map((q) => `question ${hex(q.offset)} ${escapeText(q.text)}`),
    ...document.feedback.map(
      (f) => `feedback ${f.kind} ${f.from === f.to ? hex(f.from) : `${hex(f.from)}-${hex(f.to)}`} ${escapeText(f.text)}`
    )
  ];
  if (notes.length) out.push("", ...notes);
  return `${out.join("\n")}\n`;
}

function wrapList(keyword: string, items: string[]): string[] {
  const lines: string[] = [];
  let current = keyword;
  for (const item of items) {
    if (current !== keyword && current.length + 1 + item.length > LIST_WIDTH) {
      lines.push(current);
      current = keyword;
    }
    current += ` ${item}`;
  }
  if (current !== keyword) lines.push(current);
  return lines;
}

/** Four upper-case hex digits. */
export function hex(value: number): string {
  return value.toString(16).padStart(4, "0").toUpperCase();
}
