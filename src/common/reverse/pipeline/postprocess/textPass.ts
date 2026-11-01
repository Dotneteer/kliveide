/*
 * The postprocessor's text pass (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §5, §6.1, P7): what it does to a
 * synopsis or comment the AI wrote before it goes into the sidecar.
 *
 * - **Kept numbers:** `$0B40!` is a number that must stay a number (a constant that looks like an
 *   address): the naming pass leaves it alone, and the `!` is dropped.
 * - **Wrapping:** a paragraph with a line longer than 92 columns (or a word left alone by an earlier
 *   wrap) is reflowed at 92, a numbered step's lines indented under its text; other paragraphs are kept
 *   as written, so text already in the house style is unchanged.
 * - **Naming** (only when asked: `compile --name-numbers`): `$XXXX` that is a labelled offset of the
 *   page becomes the label, except a kept number and the explicit form "offset $XXXX". On a page
 *   that runs above $0000 a page offset can also be a RAM address ($0228 is IS-BASIC's stack pointer,
 *   not offset $0228), which is why it is not on by default, and why every swap is listed.
 */

export const WRAP_WIDTH = 92;

const KEPT = /(\$[0-9A-Fa-f]{4})!/g;

/** Drops the kept-number marks. */
export function dropKeptMarks(text: string): string {
  return text.replace(KEPT, "$1");
}

/** A line that starts a paragraph of its own: a step, a contract line. */
const PARAGRAPH_START = /^(\s*\d+\. |\s*- |Entry:|Exit:|Error:|Changes:|Keeps:|Observed:)/;

/**
 * Wraps a synopsis at the width. A paragraph (a run of lines up to a step, a contract line or a blank
 * line) is reflowed only when one of its lines is too long, or when a wrap left a word or two alone
 * on a line; any other paragraph is kept as written, so text already in the house style is unchanged.
 */
export function wrapSynopsis(text: string, width = WRAP_WIDTH): string {
  const lines = text.split("\n");
  const paragraphs: string[][] = [];
  for (const line of lines) {
    const last = paragraphs[paragraphs.length - 1];
    if (!last || line.trim() === "" || PARAGRAPH_START.test(line) || last[last.length - 1].trim() === "") paragraphs.push([line]);
    else last.push(line);
  }
  return paragraphs
    .flatMap((paragraph) => {
      const tooLong = paragraph.some((l) => l.length > width);
      const stranded = paragraph.some((l, i) => i > 0 && i < paragraph.length - 1 && l.trim().split(/\s+/).length <= 2 && paragraph[i - 1].length >= width - 12);
      if (!tooLong && !stranded) return paragraph;
      const lead = /^(\s*)(\d+\. |- )?/.exec(paragraph[0])![0];
      const joined = lead + paragraph.map((l, i) => (i === 0 ? l.slice(lead.length) : l.trim())).join(" ");
      return wrapLine(joined, width);
    })
    .join("\n");
}

function wrapLine(line: string, width: number): string[] {
  const lead = /^(\s*)(\d+\. |- )?/.exec(line)!;
  const hanging = " ".repeat(lead[0].length);
  const words = line.slice(lead[0].length).split(" ");
  const lines: string[] = [];
  let current = lead[0];
  for (const word of words) {
    const candidate = current.trim() === "" || current === lead[0] ? current + word : `${current} ${word}`;
    if (candidate.length > width && current.trim() !== "" && current !== lead[0]) {
      lines.push(current);
      current = hanging + word;
    } else current = candidate;
  }
  lines.push(current);
  return lines;
}

/** `$XXXX` mentions of labelled page offsets swapped for the labels; returns the text and the swaps. */
export function nameNumbers(text: string, labels: ReadonlyMap<number, string>, pageSize = 0x4000): { text: string; swaps: string[] } {
  const swaps: string[] = [];
  const result = text.replace(/(offset\s+)?\$([0-9A-Fa-f]{4})(?![0-9A-Fa-f!])/g, (match, offsetWord: string | undefined, digits: string) => {
    if (offsetWord) return match;
    const value = parseInt(digits, 16);
    const name = value < pageSize ? labels.get(value) : undefined;
    if (!name) return match;
    swaps.push(`$${digits.toUpperCase()} -> ${name}`);
    return name;
  });
  return { text: result, swaps };
}
