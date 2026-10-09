import {
  isSkoolBlockType,
  parseSkoolNumber,
  toParagraphs,
  type SkoolBlockType,
  type SkoolDiagnostic,
  type SkoolDirective,
  type SkoolDocument,
  type SkoolEntry,
  type SkoolInstruction,
  type SkoolNonEntry
} from "./skoolTypes";

/*
 * A skool file reader (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §6.1, phase S1).
 *
 * Written from SkoolKit's documented skool format only (R7). The rules it follows, in Klive's words:
 *
 * - Entries are separated by blank lines. A paragraph of lines with no instruction line in it is
 *   not an entry: a file header, kept verbatim as a non-entry.
 * - An instruction line is a marker column, the address (decimal, or hex with `$`), and the
 *   instruction, optionally followed by `; comment`. The marker is the block character on an
 *   entry's first line, `*` for an entry point, otherwise a space.
 * - Before the first instruction, `;` lines are the entry header: up to four sections separated by
 *   a bare `;` line — title, description, registers, start comment. Paragraphs within a section are
 *   separated by `; .`.
 * - Between instructions, `;` lines starting in column 0 are a mid-block comment (or, after the last
 *   instruction, the end comment); `;` lines that start with whitespace continue the previous
 *   instruction's comment.
 * - `@` lines are ASM directives. Those before the header belong to the entry; those after the
 *   header (or between instructions) belong to the next instruction.
 * - An instruction comment starting with `{` opens a comment over several instructions; one ending
 *   with `}` closes it.
 */

const INSTRUCTION_LINE = /^([bcgistuw* ])(\$[0-9A-Fa-f]{1,4}|[0-9]{1,5})(?:\s+(.*))?$/;

type Line = { line: number; text: string };

export function parseSkool(source: string): SkoolDocument {
  const diagnostics: SkoolDiagnostic[] = [];
  const entries: SkoolEntry[] = [];
  const nonEntries: SkoolNonEntry[] = [];

  for (const block of splitBlocks(source)) {
    const firstInstruction = block.findIndex((l) => INSTRUCTION_LINE.test(l.text));
    if (firstInstruction < 0) {
      nonEntries.push({ line: block[0].line, lines: block.map((l) => l.text) });
      continue;
    }
    const entry = parseEntry(block, firstInstruction, diagnostics);
    if (entry) entries.push(entry);
    else nonEntries.push({ line: block[0].line, lines: block.map((l) => l.text) });
  }
  return { format: "skool", entries, nonEntries, diagnostics };
}

function splitBlocks(source: string): Line[][] {
  const blocks: Line[][] = [];
  let current: Line[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    if (text.trim().length === 0) {
      if (current.length > 0) blocks.push(current);
      current = [];
    } else {
      current.push({ line: index + 1, text: text.replace(/\s+$/, "") });
    }
  });
  if (current.length > 0) blocks.push(current);
  return blocks;
}

function parseDirective(line: Line): SkoolDirective {
  const body = line.text.slice(1);
  const eq = body.indexOf("=");
  return eq < 0
    ? { name: body.trim(), line: line.line }
    : { name: body.slice(0, eq).trim(), value: body.slice(eq + 1), line: line.line };
}

/** A `;` line's text without the `;` and the one space after it. */
function commentText(text: string): string {
  return text.replace(/^\s*;\s?/, "");
}

function parseEntry(
  block: Line[],
  firstInstruction: number,
  diagnostics: SkoolDiagnostic[]
): SkoolEntry | undefined {
  // --- The header: directives, then `;` sections
  const header = block.slice(0, firstInstruction);
  const lastComment = header.reduce((last, l, i) => (l.text.startsWith(";") ? i : last), -1);
  const entryDirectives: SkoolDirective[] = [];
  let pendingDirectives: SkoolDirective[] = [];
  const sections: string[][] = [[]];
  header.forEach((l, i) => {
    if (l.text.startsWith("@")) {
      (i > lastComment ? pendingDirectives : entryDirectives).push(parseDirective(l));
    } else if (l.text.startsWith(";")) {
      const text = commentText(l.text);
      if (text.trim().length === 0) sections.push([]);
      else sections[sections.length - 1].push(text);
    } else {
      diagnostics.push({ line: l.line, severity: "warning", message: "Unexpected line in an entry header; ignored." });
    }
  });

  const first = INSTRUCTION_LINE.exec(block[firstInstruction].text)!;
  const type = first[1];
  if (!isSkoolBlockType(type)) {
    diagnostics.push({
      line: block[firstInstruction].line,
      severity: "error",
      message: `An entry must start with a block character (b, c, g, i, s, t, u, w), not "${type}".`
    });
    return undefined;
  }

  const entry: SkoolEntry = {
    line: block[0].line,
    type: type as SkoolBlockType,
    address: parseSkoolNumber(first[2])!,
    description: toParagraphs(sections[1] ?? []),
    registers: (sections[2] ?? []).filter((r) => r.trim().length > 0),
    startComment: toParagraphs(sections[3] ?? []),
    directives: entryDirectives,
    instructions: [],
    endComment: []
  };
  const title = (sections[0] ?? []).join(" ").trim();
  if (title) entry.title = title;
  if (sections.length > 4) {
    diagnostics.push({
      line: block[0].line,
      severity: "warning",
      message: "An entry header has more than four sections; the extra ones are kept in the start comment."
    });
    entry.startComment.push(...sections.slice(4).flatMap((s) => toParagraphs(s)));
  }

  // --- The body
  let pendingComment: string[] = [];
  let previous: SkoolInstruction | undefined;
  for (const l of block.slice(firstInstruction)) {
    const match = INSTRUCTION_LINE.exec(l.text);
    if (match) {
      const instruction = parseInstruction(l, match);
      if (instruction.marker !== " " && instruction.marker !== "*" && previous) {
        diagnostics.push({
          line: l.line,
          severity: "warning",
          message: "A block character inside an entry; a blank line should separate entries."
        });
      }
      if (pendingComment.length > 0) instruction.midComment = toParagraphs(pendingComment);
      instruction.directives = pendingDirectives;
      pendingComment = [];
      pendingDirectives = [];
      entry.instructions.push(instruction);
      previous = instruction;
    } else if (l.text.startsWith("@")) {
      pendingDirectives.push(parseDirective(l));
    } else if (l.text.startsWith(";")) {
      pendingComment.push(commentText(l.text));
    } else if (/^\s+;/.test(l.text) && previous && pendingComment.length === 0) {
      appendComment(previous, commentText(l.text));
    } else if (entry.type === "i") {
      (entry.rawLines ??= []).push(l.text);
    } else {
      diagnostics.push({ line: l.line, severity: "warning", message: "Unrecognised line; ignored." });
    }
  }
  if (pendingComment.length > 0) entry.endComment = toParagraphs(pendingComment);
  if (pendingDirectives.length > 0) entry.trailingDirectives = pendingDirectives;
  return entry;
}

function parseInstruction(l: Line, match: RegExpExecArray): SkoolInstruction {
  const rest = match[3] ?? "";
  const split = splitComment(rest);
  const instruction: SkoolInstruction = {
    line: l.line,
    marker: match[1],
    address: parseSkoolNumber(match[2])!,
    ...(match[2].startsWith("$") ? { hex: true } : {}),
    text: split.text,
    directives: []
  };
  if (split.comment !== undefined) appendComment(instruction, split.comment);
  return instruction;
}

/** Add a comment line to an instruction, recognising the braces of a comment over several. */
function appendComment(instruction: SkoolInstruction, raw: string): void {
  let text = raw.trim();
  if (instruction.comment === undefined && text.startsWith("{")) {
    instruction.braceOpen = true;
    text = text.slice(1).trimStart();
  }
  if (text.endsWith("}")) {
    instruction.braceClose = true;
    text = text.slice(0, -1).trimEnd();
  }
  if (text.length === 0) {
    instruction.comment ??= "";
    return;
  }
  instruction.comment = instruction.comment ? `${instruction.comment} ${text}` : text;
}

/** Split an instruction from its comment at the first `;` outside a string. */
export function splitComment(rest: string): { text: string; comment?: string } {
  let inString = false;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (inString && ch === "\\") {
      i++;
      continue;
    }
    if (ch === '"') inString = !inString;
    else if (ch === ";" && !inString) {
      return { text: rest.slice(0, i).trim(), comment: rest.slice(i + 1) };
    }
  }
  return { text: rest.trim() };
}
