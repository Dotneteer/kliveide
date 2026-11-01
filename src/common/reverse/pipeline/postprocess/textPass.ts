/*
 * The postprocessor's text pass (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §5, §6.1, P7): what it does to a
 * synopsis or comment the AI wrote before it goes into the sidecar.
 *
 * - **Kept numbers:** `$0B40!` is a number that must stay a number (a constant that looks like an
 *   address): the naming pass leaves it alone, and the `!` is dropped.
 * - **Wrapping:** a synopsis line longer than 92 columns is wrapped at 92, a numbered step's lines
 *   indented under its text. Lines are never joined, so text already in the house style is unchanged.
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

/** Wraps every line longer than the width; a numbered or dashed step keeps its hanging indent. */
export function wrapSynopsis(text: string, width = WRAP_WIDTH): string {
  return text
    .split("\n")
    .flatMap((line) => (line.length <= width ? [line] : wrapLine(line, width)))
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
