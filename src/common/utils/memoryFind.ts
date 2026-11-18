/*
 * Find in memory (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §5.3): the pattern language of the
 * Memory view's Find box and the search itself, shared by the view (over the bytes it shows) and the
 * emulator process (`findMemory`, over every partition, so 2 MB is never copied to the renderer).
 *
 * A pattern is one of:
 * - bytes: hex pairs separated by spaces (`21 00 58`), `??` for any byte (`21 ?? 58`); in decimal
 *   mode the numbers are decimal; a `$` or `0x` prefix forces hex, `%` binary
 * - text: a quoted string (`"HELLO"`), matched as the machine's character codes (ASCII here)
 * Anything else is not a byte pattern; the view treats it as a label name.
 */

/** A byte to match, or `null` for any byte */
export type FindPattern = (number | null)[];

/** Parse a number token of a byte pattern; undefined when it is not a byte */
function parseByteToken(token: string, decimal: boolean): number | null | undefined {
  if (token === "??" || token === "?") return null;
  let value: number;
  if (/^\$[0-9a-f]{1,2}$/i.test(token)) value = parseInt(token.slice(1), 16);
  else if (/^0x[0-9a-f]{1,2}$/i.test(token)) value = parseInt(token.slice(2), 16);
  else if (/^%[01]{1,8}$/.test(token)) value = parseInt(token.slice(1), 2);
  else if (decimal && /^\d{1,3}$/.test(token)) value = parseInt(token, 10);
  else if (!decimal && /^[0-9a-f]{1,2}$/i.test(token)) value = parseInt(token, 16);
  else return undefined;
  return value >= 0 && value <= 0xff ? value : undefined;
}

/**
 * Parse the Find box's text into a byte pattern.
 * @returns The pattern, or undefined when the text is not a byte or text pattern (a label, then)
 */
export function parseFindPattern(text: string, decimal = false): FindPattern | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const quoted = /^"(.*)"$/.exec(trimmed) ?? /^'(.*)'$/.exec(trimmed);
  if (quoted) {
    const body = quoted[1];
    if (!body.length) return undefined;
    return Array.from(body, (ch) => ch.charCodeAt(0) & 0xff);
  }
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  const pattern: FindPattern = [];
  for (const token of tokens) {
    const value = parseByteToken(token, decimal);
    if (value === undefined) return undefined;
    pattern.push(value);
  }
  // --- All wildcards would match everywhere
  return pattern.some((v) => v !== null) ? pattern : undefined;
}

/**
 * The offsets where the pattern starts in `data`, at most `limit` of them.
 * @returns The offsets and whether there were more than the limit
 */
export function findPattern(
  data: ArrayLike<number>,
  pattern: FindPattern,
  limit = Number.MAX_SAFE_INTEGER
): { offsets: number[]; truncated: boolean } {
  const offsets: number[] = [];
  const n = pattern.length;
  if (n === 0) return { offsets, truncated: false };
  const first = pattern[0];
  outer: for (let i = 0; i + n <= data.length; i++) {
    if (first !== null && data[i] !== first) continue;
    for (let j = 1; j < n; j++) {
      const p = pattern[j];
      if (p !== null && data[i + j] !== p) continue outer;
    }
    if (offsets.length >= limit) return { offsets, truncated: true };
    offsets.push(i);
  }
  return { offsets, truncated: false };
}

/** The default cap of a search across partitions */
export const MEMORY_FIND_LIMIT = 1000;
