/*
 * What makes a `.bas` an HT-1080Z program (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D1, D-A): a tokenised
 * Level II program and BASIC source text share the extension but never the content, so the file
 * decides, wherever it is and whatever machine runs.
 *
 * A tokenised program is an FFh byte, then its lines: each a 2-byte link (the address of the next
 * line), a 2-byte line number, the text and a 00h. The chain ends at a link of 0000h. The address the
 * program was saved from does not matter (a disk BASIC saves from another TXTTAB): only the links'
 * differences are checked, each the next line's length. Text cannot pass: FFh never occurs in UTF-8,
 * and UTF-16 text (`FF FE ...`) has no 00h-terminated lines whose links match their lengths.
 */

/** How many bytes the test reads: enough to follow the first lines */
export const HT1080Z_BASIC_SNIFF_BYTES = 512;

/** The content kind a sniffed file has, when it is not what its extension suggests */
export type FileContentKind = "ht1080zBasic";

/**
 * Whether the bytes are (the start of) a tokenised HT-1080Z BASIC program
 * @param bytes The file, or its first `HT1080Z_BASIC_SNIFF_BYTES` bytes
 * @param complete Whether `bytes` is the whole file: then the chain must end with a 0000h link inside it
 */
export function isTokenisedHt1080zBasic(bytes: ArrayLike<number>, complete = bytes.length < HT1080Z_BASIC_SNIFF_BYTES): boolean {
  if (bytes.length < 3 || bytes[0] !== 0xff) return false;
  const word = (at: number) => bytes[at] | (bytes[at + 1] << 8);
  // --- An empty program
  if (word(1) === 0) return true;
  let pos = 1;
  let previousLink: number | undefined;
  let lines = 0;
  while (pos + 2 <= bytes.length) {
    const link = word(pos);
    if (link === 0) return lines > 0;
    if (pos + 4 > bytes.length) break;
    // --- The line's text runs to its 00h, after the link and the line number
    let end = pos + 4;
    while (end < bytes.length && bytes[end] !== 0) end++;
    if (end >= bytes.length) return !complete && lines > 0;
    const length = end + 1 - pos;
    // --- The first link fixes where the program was saved from; every later one must follow on
    if (previousLink !== undefined && link - previousLink !== length) return false;
    if (previousLink === undefined && link < length) return false;
    previousLink = link;
    pos = end + 1;
    lines++;
  }
  // --- Ran out of bytes mid-chain: a sample of a longer file, never a whole one
  return !complete && lines > 0;
}
