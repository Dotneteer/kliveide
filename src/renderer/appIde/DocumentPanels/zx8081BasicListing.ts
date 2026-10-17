import { Zx80Chars, Zx81Chars } from "@common/machines/char-codes";
import type { CharDescriptor } from "@common/machines/info-types";
import { toHexa2 } from "../services/ide-commands";
import { BasicProgramBuffer, getMemoryWord, SpectrumColor } from "./BasicLine";
import type { BasicListing } from "./basicListing";
import { t } from "@common/i18n/i18n";

/*
 * The ZX81 and ZX80 BASIC detokenizers: a program's bytes into the lines the BASIC Listing view
 * shows, the way each machine's own LIST prints them.
 *
 * The formats and the spacing rules are the ROMs' (interface facts, in Klive's words):
 *
 * - **ZX81** (and a ZX80 with the 8K ROM): each line is a big-endian line number, a little-endian
 *   length, then the text ending in NEWLINE ($76). `$7E` is followed by a number's five-byte binary
 *   form, which LIST skips. Keyword tokens are $C0-$FF; RND, INKEY$ and PI are $40-$42. The ROM's
 *   TOKENS routine ($094B) puts a space before a token from `**` ($D8) on whose text starts with a
 *   letter (so `OR`, `THEN`, `PRINT`, but not `**` or `<=`), unless the last thing printed was such
 *   a trailing space, and a space after a token that ends in a letter, a digit or `$`. RND, INKEY$
 *   and PI get neither.
 * - **ZX80** (the 4K ROM): each line is a big-endian line number, then the text ending in NEWLINE.
 *   There is no length, and numbers are stored only as their digits. Tokens are $D4-$FF. The ROM
 *   ($0584) puts a space before a token whose text starts with a letter, unless a space was the last
 *   thing printed, and a space after one that ends in a letter or digit. Printing a space keeps that
 *   "space printed" state; any other character clears it ($0559).
 *
 * Both ROMs print the line number right-aligned in four columns, then one separator - the program
 * cursor `>` on the current line, a space elsewhere. The listing always shows the space.
 */

/** Where each machine keeps its program */
export type Zx8081BasicKind = "zx81" | "zx80";

/** The ZX81's program starts after the system variables, and ends where the display file starts */
const ZX81_PROGRAM = 0x407d;
const ZX81_D_FILE = 0x400c;
/** The ZX80's program starts after the system variables, and ends where the variables start */
const ZX80_PROGRAM = 0x4028;
const ZX80_VARS = 0x4008;

const NEWLINE = 0x76;
const ZX81_NUMBER = 0x7e;

/** Where the program is in a ZX81's or ZX80's memory */
export function zx8081ProgramArea(memory: Uint8Array, kind: Zx8081BasicKind): { start: number; end: number } {
  return kind === "zx81"
    ? { start: ZX81_PROGRAM, end: getMemoryWord(memory, ZX81_D_FILE) }
    : { start: ZX80_PROGRAM, end: getMemoryWord(memory, ZX80_VARS) };
}

export type Zx8081ListingOptions = {
  /** Show non-printable codes as `$NN` cells instead of `?` */
  showCodes?: boolean;
  /** Reuse a buffer (BasicPanel keeps one for copying the listing) */
  buffer?: BasicProgramBuffer;
};

/**
 * A line number as LIST prints it: four columns, leading zeros as spaces. The thousands are one
 * character, the digit codes counted on ($1C + n), so 14393 prints as `E393` - which is how a line
 * number above 9999 (a NEWLINE POKEd into a REM makes one) appears on the screen.
 */
function lineNumberText(lineNo: number, charSet: Record<number, CharDescriptor>): string {
  const thousands = Math.floor(lineNo / 1000);
  const rest = (lineNo % 1000).toString();
  if (thousands === 0) return rest.padStart(4, "\xa0");
  const code = 0x1c + thousands;
  return (code < 0x40 ? (charSet[code]?.v ?? "?") : "?") + rest.padStart(3, "0");
}

/** Digits and letters: the ROMs' token spacing depends on them */
const isLetterOrDigit = (code: number) => code >= 0x1c && code <= 0x3f;

/**
 * Lists the BASIC program held in `memory[start..end)`.
 * @param memory The bytes holding the program - all of memory
 * @param start Where the program starts
 * @param end Where it ends (D_FILE on the ZX81, VARS on the ZX80)
 * @param kind Which ROM's format and spacing to follow
 */
export function decodeZx8081Program(
  memory: Uint8Array,
  start: number,
  end: number,
  kind: Zx8081BasicKind,
  { showCodes = false, buffer = new BasicProgramBuffer() }: Zx8081ListingOptions = {}
): BasicListing {
  buffer.clear();
  const isZx81 = kind === "zx81";
  const charSet = isZx81 ? Zx81Chars : Zx80Chars;
  // --- The character codes the token texts are made of, to apply the ROMs' spacing rules
  const codeOf = new Map<string, number>();
  for (let code = 0; code < 0x40; code++) {
    const v = charSet[code]?.v;
    if (v !== undefined && !codeOf.has(v)) codeOf.set(v, code);
  }
  const charCode = (ch: string) => codeOf.get(ch) ?? 0;

  let corrupted = start > end || end > memory.length;
  let pos = start;
  let lineCount = 0;

  while (!corrupted && pos < end) {
    const lineNo = (memory[pos] << 8) | memory[pos + 1];
    pos += 2;
    // --- The ZX81's length is not what LIST follows: like the ZX80, it lists up to the NEWLINE and
    // --- starts the next line after it (only a number's five bytes are skipped unread). A NEWLINE
    // --- POKEd into a REM therefore starts a "line" of its own on the screen, and here too.
    if (isZx81) pos += 2;
    let lineEnd = pos;
    while (lineEnd < end && memory[lineEnd] !== NEWLINE) {
      lineEnd += isZx81 && memory[lineEnd] === ZX81_NUMBER ? 6 : 1;
    }
    if (lineEnd >= end) {
      corrupted = true;
      break;
    }
    lineEnd++;
    lineCount++;

    // --- The line number, right-aligned in four columns, and the separator
    buffer.resetColor();
    buffer.ink("cyan");
    buffer.write(lineNumberText(lineNo, charSet) + "\xa0");
    buffer.resetColor();

    // --- "A space was just printed": the separator counts as one
    let afterSpace = true;
    const print = (text: string, inverse = false) => {
      buffer.inverse(inverse);
      buffer.write(text);
      buffer.inverse(false);
    };
    const space = () => {
      print("\xa0");
      afterSpace = true;
    };
    const codeCell = (paper: SpectrumColor, code: number) => {
      buffer.paper(paper);
      buffer.ink("white");
      buffer.write(`$${toHexa2(code)}`);
      buffer.resetColor();
      afterSpace = false;
    };

    while (pos < lineEnd) {
      const code = memory[pos++];
      if (code === NEWLINE) break;
      if (isZx81 && code === ZX81_NUMBER) {
        pos += 5;
        continue;
      }

      const ch = charSet[code];
      if (ch?.c === "token") {
        const text = ch.t ?? "?";
        const first = charCode(text[0]);
        const last = charCode(text[text.length - 1]);
        let leading: boolean;
        let trailing: boolean;
        if (isZx81) {
          const keyword = code >= 0xc0;
          leading = keyword && code - 0xc0 >= 0x18 && isLetterOrDigit(first);
          trailing = keyword && (isLetterOrDigit(last) || text.endsWith("$"));
        } else {
          leading = isLetterOrDigit(first);
          trailing = isLetterOrDigit(last);
        }
        if (leading && !afterSpace) space();
        print(text);
        afterSpace = false;
        if (trailing) space();
        continue;
      }

      if (code < 0x40 || (code >= 0x80 && code < 0xc0)) {
        // --- A character, or its inverse
        print(ch?.v ?? "?", code >= 0x80);
        // --- The ZX80 ROM keeps "space printed" across a space; the ZX81's clears it on any character
        afterSpace = !isZx81 && code === 0 ? afterSpace : false;
        continue;
      }

      // --- A code LIST cannot print: the ROMs show `?`
      if (showCodes) codeCell("blue", code);
      else {
        print("?");
        afterSpace = false;
      }
    }

    pos = lineEnd;
    buffer.writeLine();
  }

  if (corrupted) {
    buffer.resetColor();
    buffer.writeLine();
    buffer.bright(true);
    buffer.paper("white");
    buffer.ink("red");
    buffer.inverse(true);
    buffer.writeLine(t("panels.doc.basic.corrupted"));
  }

  return { lines: buffer.getContents(), buffer, corrupted, lineCount };
}
