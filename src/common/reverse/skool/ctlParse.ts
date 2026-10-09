import {
  isSkoolBlockType,
  parseSkoolNumber,
  type SkoolBlockType,
  type SkoolDiagnostic,
  type SkoolDirective,
  type SkoolDocument,
  type SkoolEntry,
  type SkoolInstruction,
  type SkoolNonEntry
} from "./skoolTypes";

/*
 * A SkoolKit control file reader (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §6.1, phase S1).
 *
 * Written from SkoolKit's documented control-file format only (R7). It gives the same
 * `SkoolDocument` a skool file does, with no instruction text — a control file describes structure
 * and comments, and SkoolKit combines it with a snapshot to make a skool file. Klive combines it
 * with the bytes it already has.
 *
 * - `b c g i s t u w addr [title]` start an entry.
 * - `B C S T W addr[,length[,sublengths]] [comment]` set a sub-block's type (and its instruction
 *   comment).
 * - `D` description, `R` registers, `N` start or mid-block comment, `E` end comment; each line one
 *   paragraph. `M addr[,length] comment` is one comment over several sub-blocks.
 * - `L addr,length,count[,blocks]` repeats a pattern; kept as text.
 * - `@ addr directive[=value]` is an ASM directive; `> addr[,1] text` is non-entry text before (or,
 *   with `,1`, after) the entry at `addr`.
 * - `#`, `%` and `;` lines are comments of the control file itself.
 */

const BLOCK_LINE = /^([bcgistuw])\s+(\$[0-9A-Fa-f]+|[0-9]+)(?:\s+(.*))?$/;
const SUB_BLOCK_LINE = /^([BCSTW])\s+(\$[0-9A-Fa-f]+|[0-9]+)((?:,[^\s]*)?)(?:\s+(.*))?$/;
const COMMENT_LINE = /^([DRNEM])\s+(\$[0-9A-Fa-f]+|[0-9]+)((?:,[^\s]*)?)(?:\s(.*))?$/;

export function parseCtl(source: string): SkoolDocument {
  const diagnostics: SkoolDiagnostic[] = [];
  const entries: SkoolEntry[] = [];
  const nonEntries: SkoolNonEntry[] = [];
  const addressDirectives: { address: number; directive: SkoolDirective }[] = [];
  let entry: SkoolEntry | undefined;
  /** Mid-block comments waiting for the sub-block at their address. */
  const pendingMidComments = new Map<number, string[]>();

  const warn = (line: number, message: string) =>
    diagnostics.push({ line, severity: "warning", message });
  const needEntry = (line: number, directive: string): SkoolEntry | undefined => {
    if (!entry) warn(line, `${directive} before any block directive; ignored.`);
    return entry;
  };

  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const text = raw.replace(/\s+$/, "");
    if (text.length === 0 || /^[#%;]/.test(text)) return;

    // --- ASM directive: `@ addr directive=value`
    if (text.startsWith("@")) {
      const match = /^@\s+(\$[0-9A-Fa-f]+|[0-9]+)\s+(.*)$/.exec(text);
      const address = match ? parseSkoolNumber(match[1]) : undefined;
      if (!match || address === undefined) {
        warn(line, "An @ directive needs an address and a directive; ignored.");
        return;
      }
      const body = match[2];
      const eq = body.indexOf("=");
      const directive: SkoolDirective =
        eq < 0 ? { name: body.trim(), line } : { name: body.slice(0, eq).trim(), value: body.slice(eq + 1), line };
      addressDirectives.push({ address, directive });
      return;
    }

    // --- Non-entry text: `> addr[,1] text`
    if (text.startsWith(">")) {
      const match = /^>\s+(\$[0-9A-Fa-f]+|[0-9]+)(,[01])?(?:\s(.*))?$/.exec(text);
      const address = match ? parseSkoolNumber(match[1]) : undefined;
      if (!match || address === undefined) {
        warn(line, "A > directive needs an address; ignored.");
        return;
      }
      const after = match[2] === ",1";
      const last = nonEntries[nonEntries.length - 1];
      if (last && last.address === address && !!last.after === after) last.lines.push(match[3] ?? "");
      else nonEntries.push({ line, address, ...(after ? { after } : {}), lines: [match[3] ?? ""] });
      return;
    }

    let match = BLOCK_LINE.exec(text);
    if (match) {
      const address = parseSkoolNumber(match[2])!;
      entry = {
        line,
        type: match[1] as SkoolBlockType,
        address,
        description: [],
        registers: [],
        startComment: [],
        directives: [],
        instructions: [],
        endComment: []
      };
      if (match[3]?.trim()) entry.title = match[3].trim();
      entries.push(entry);
      return;
    }

    match = SUB_BLOCK_LINE.exec(text);
    if (match) {
      const current = needEntry(line, match[1]);
      if (!current) return;
      const address = parseSkoolNumber(match[2])!;
      const { length, sublengths } = readLengths(match[3], line, diagnostics);
      const instruction: SkoolInstruction = {
        line,
        address,
        marker: " ",
        subType: match[1].toLowerCase() as SkoolBlockType,
        text: "",
        directives: []
      };
      if (length !== undefined) instruction.length = length;
      if (sublengths) instruction.sublengths = sublengths;
      const comment = match[4]?.trim();
      if (comment) instruction.comment = comment;
      const pending = pendingMidComments.get(address);
      if (pending) {
        instruction.midComment = pending;
        pendingMidComments.delete(address);
      }
      current.instructions.push(instruction);
      return;
    }

    match = COMMENT_LINE.exec(text);
    if (match) {
      const current = needEntry(line, match[1]);
      if (!current) return;
      const address = parseSkoolNumber(match[2])!;
      const body = (match[4] ?? "").trim();
      switch (match[1]) {
        case "D":
          current.description.push(body);
          break;
        case "R":
          current.registers.push(body);
          break;
        case "E":
          current.endComment.push(body);
          break;
        case "N":
          if (address === current.address && current.instructions.length === 0) {
            current.startComment.push(body);
          } else {
            const existing = current.instructions.find((i) => i.address === address);
            if (existing) (existing.midComment ??= []).push(body);
            else pendingMidComments.set(address, [...(pendingMidComments.get(address) ?? []), body]);
          }
          break;
        case "M": {
          const { length } = readLengths(match[3], line, diagnostics);
          (current.spanComments ??= []).push({
            line,
            address,
            ...(length !== undefined ? { length } : {}),
            text: body
          });
          break;
        }
      }
      return;
    }

    if (text.startsWith("L ")) {
      const current = needEntry(line, "L");
      if (current) (current.repeats ??= []).push({ line, spec: text.slice(2).trim() });
      return;
    }

    if (isSkoolBlockType(text[0]) && !/\s/.test(text[1] ?? " ")) {
      warn(line, "A block directive needs a space before its address; ignored.");
      return;
    }
    warn(line, "Unrecognised control directive; ignored.");
  });

  // --- A mid-block comment at an address no sub-block starts at becomes a sub-block of its own
  // --- type-less kind: it still marks where the comment goes.
  for (const [address, paragraphs] of pendingMidComments) {
    const owner = [...entries].reverse().find((e) => e.address <= address);
    owner?.instructions.push({ line: owner.line, address, marker: " ", text: "", directives: [], midComment: paragraphs });
  }
  for (const e of entries) e.instructions.sort((a, b) => a.address - b.address);

  return { format: "ctl", entries, nonEntries, addressDirectives, diagnostics };
}

/** `,length[,sublengths]` after a sub-block's address. */
function readLengths(
  spec: string,
  line: number,
  diagnostics: SkoolDiagnostic[]
): { length?: number; sublengths?: string } {
  if (!spec) return {};
  const parts = spec.slice(1).split(",");
  const result: { length?: number; sublengths?: string } = {};
  if (parts[0]) {
    const length = parseSkoolNumber(parts[0]);
    if (length === undefined) {
      diagnostics.push({ line, severity: "warning", message: `"${parts[0]}" is not a length; ignored.` });
    } else {
      result.length = length;
    }
  }
  if (parts.length > 1) result.sublengths = parts.slice(1).join(",");
  return result;
}
