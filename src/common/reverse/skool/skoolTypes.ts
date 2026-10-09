/*
 * The shape a SkoolKit skool or control file is read into (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * §6.1, §6.4).
 *
 * **Provenance (R7).** SkoolKit is GPL-3 Python. These types, the parsers and the writers are
 * written from SkoolKit's *documented file formats* only — the formats are interface facts. No
 * SkoolKit code was read, copied or translated.
 *
 * Both parsers produce the same `SkoolDocument`; a control file simply has no instruction text.
 */

/** A skool block character: code, bytes, text, words, same-value bytes, unused, game status, ignored. */
export type SkoolBlockType = "c" | "b" | "t" | "w" | "s" | "u" | "g" | "i";

export const SKOOL_BLOCK_TYPES: readonly SkoolBlockType[] = ["c", "b", "t", "w", "s", "u", "g", "i"];

export function isSkoolBlockType(value: string): value is SkoolBlockType {
  return (SKOOL_BLOCK_TYPES as readonly string[]).includes(value);
}

/** An ASM directive (`@name=value`, or `@name` alone), where it was written. */
export type SkoolDirective = {
  name: string;
  value?: string;
  line: number;
};

/** A comment as a list of paragraphs; a paragraph is its lines joined by single spaces. */
export type SkoolParagraphs = string[];

export type SkoolInstruction = {
  /** 1-based line number, for messages. */
  line: number;
  /** The address the instruction is at. */
  address: number;
  /** The address was written in hex (`$8000`). */
  hex?: boolean;
  /** The block character of an entry's first line, else `" "`; `"*"` marks an entry point. */
  marker: string;
  /** The sub-block type, for a control file's sub-block directives (`B`, `C`, `S`, `T`, `W`). */
  subType?: SkoolBlockType;
  /** The length the control file gave, when it gave one. */
  length?: number;
  /** A control file's sublength specification, kept as text. */
  sublengths?: string;
  /** The instruction text; empty for a control file. */
  text: string;
  /** The instruction comment, continuation lines joined with spaces; `{`/`}` stripped. */
  comment?: string;
  /** Opens a braced comment that spans this and following instructions. */
  braceOpen?: boolean;
  /** Closes a braced comment. */
  braceClose?: boolean;
  /** The mid-block comment written above this instruction. */
  midComment?: SkoolParagraphs;
  /** ASM directives written above this instruction. */
  directives: SkoolDirective[];
};

export type SkoolEntry = {
  line: number;
  type: SkoolBlockType;
  address: number;
  /** The entry header's first section. */
  title?: string;
  /** The description's paragraphs. */
  description: SkoolParagraphs;
  /** The register lines, as written (one per register). */
  registers: string[];
  /** The start comment's paragraphs. */
  startComment: SkoolParagraphs;
  /** ASM directives written above the entry's header. */
  directives: SkoolDirective[];
  instructions: SkoolInstruction[];
  /** The comment after the last instruction. */
  endComment: SkoolParagraphs;
  /** An `i` entry's lines that are not instructions, verbatim. */
  rawLines?: string[];
  /** A control file's `M` directives: one comment over several sub-blocks. */
  spanComments?: { line: number; address: number; length?: number; text: string }[];
  /** A control file's `L` directives, kept as text (`addr,length,count[,blocks]`). */
  repeats?: { line: number; spec: string }[];
  /** ASM directives after the last instruction, which have nothing to attach to. */
  trailingDirectives?: SkoolDirective[];
};

/** Text that is not part of any entry: a file header, or a control file's `>` lines. */
export type SkoolNonEntry = {
  line: number;
  /** The address the text sits before (or after, with `after`), when a control file says. */
  address?: number;
  after?: boolean;
  lines: string[];
};

export type SkoolDiagnostic = {
  line: number;
  severity: "error" | "warning";
  message: string;
};

export type SkoolDocument = {
  format: "skool" | "ctl";
  entries: SkoolEntry[];
  nonEntries: SkoolNonEntry[];
  /** Control-file `@` directives by address (a skool file keeps them on their instruction). */
  addressDirectives?: { address: number; directive: SkoolDirective }[];
  diagnostics: SkoolDiagnostic[];
};

/** Read a skool or control file address: decimal, or hexadecimal with `$` (or `0x`). */
export function parseSkoolNumber(text: string): number | undefined {
  const value = text.trim();
  let parsed: number;
  if (/^\$[0-9a-fA-F]+$/.test(value)) parsed = parseInt(value.slice(1), 16);
  else if (/^0x[0-9a-fA-F]+$/i.test(value)) parsed = parseInt(value.slice(2), 16);
  else if (/^[0-9]+$/.test(value)) parsed = parseInt(value, 10);
  else return undefined;
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Split a comment's lines into paragraphs at `.` lines, joining each paragraph's lines. */
export function toParagraphs(lines: string[]): SkoolParagraphs {
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) paragraphs.push(current.join(" "));
    current = [];
  };
  for (const line of lines) {
    if (line.trim() === ".") flush();
    else if (line.trim().length > 0) current.push(line.trim());
  }
  flush();
  return paragraphs;
}
