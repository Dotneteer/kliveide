import { HT1080Z_FIRST_TOKEN, ht1080zTokenName } from "@common/ht1080z/basicTokens";
import type { CharDescriptor } from "@common/machines/info-types";
import { t } from "@common/i18n/i18n";
import { toHexa2 } from "../services/ide-commands";
import { BasicProgramBuffer, getMemoryWord } from "./BasicLine";
import type { BasicListing } from "./basicListing";

/*
 * The HT-1080Z's BASIC detokenizer (`.plans/HT1080Z_PLAN.md` §11): a Level II program's bytes into
 * the lines the BASIC Listing view shows, the way the ROM's LIST prints them. Observed on the core
 * (`test/ht1080z-hw/basic-listing.test.ts` lists programs both ways and compares):
 *
 * - The program starts at TXTTAB (40A4h). Each line is a little-endian link to the next line, a
 *   little-endian line number, the tokenised text and a 00h; a link of 0 ends the program.
 * - LIST prints the line number in decimal and one space, then the text as stored: it adds no spaces
 *   around keywords. Bytes 80h-FBh are keywords everywhere, inside quotes and after REM too.
 * - `ELSE` is stored after a colon (`3A 95`) and `'` as `:REM'` (`3A 93 FB`); LIST hides the colon,
 *   and the REM before the apostrophe.
 * - Codes below 20h go to the display driver as controls; LIST shows nothing for them.
 * - On the /64 a backtick and a key (60h, then one of 32 bytes) is one Hungarian or mathematical
 *   character; the display driver drops a backtick pair it does not know.
 */

/** Where the program starts: TXTTAB */
const TXTTAB = 0x40a4;
/** The end of the program: VARTAB, the first byte after its terminator */
const VARTAB = 0x40f9;

const COLON = 0x3a;
const REM = 0x93;
const ELSE = 0x95;
const APOSTROPHE = 0xfb;
const BACKTICK = 0x60;

/**
 * The /64's backtick pairs: the byte after the backtick, and the character code it prints (observed
 * on the core with the extension on).
 */
export const HT64_BACKTICK_PAIRS: Readonly<Record<number, number>> = {
  // --- Capitals and symbols: A E I O U 3 4 5 6, 9 M 8 G S B 7
  0x41: 0x00, 0x45: 0x01, 0x49: 0x02, 0x4f: 0x03, 0x33: 0x04, 0x34: 0x05, 0x55: 0x06, 0x35: 0x07,
  0x36: 0x08, 0x39: 0x09, 0x4d: 0x0a, 0x38: 0x0b, 0x47: 0x0c, 0x53: 0x0d, 0x42: 0x0e, 0x37: 0x0f,
  // --- Small letters and the shifted symbols: a e i o u # $ % &, ) m ( g s b '
  0x61: 0x10, 0x65: 0x11, 0x69: 0x12, 0x6f: 0x13, 0x23: 0x14, 0x24: 0x15, 0x75: 0x16, 0x25: 0x17,
  0x26: 0x18, 0x29: 0x19, 0x6d: 0x1a, 0x28: 0x1b, 0x67: 0x1c, 0x73: 0x1d, 0x62: 0x1e, 0x27: 0x1f
};

export type Ht1080zListingOptions = {
  /** The model's character set (`ht1080zCharsFor`) */
  charSet: Record<number, CharDescriptor>;
  /** The /64's backtick pairs are characters */
  backtickPairs?: boolean;
  /** Show the codes LIST does not print as `$NN` cells */
  showCodes?: boolean;
  /** Reuse a buffer (BasicPanel keeps one for copying the listing) */
  buffer?: BasicProgramBuffer;
};

/** Where the program is in an HT-1080Z's memory */
export function ht1080zProgramArea(memory: Uint8Array): { start: number; end: number } {
  return { start: getMemoryWord(memory, TXTTAB), end: getMemoryWord(memory, VARTAB) };
}

/**
 * Lists the BASIC program that starts at `start`.
 * @param memory All of memory
 * @param start TXTTAB
 * @param end VARTAB; a line running past it means the program is corrupted
 */
export function decodeHt1080zProgram(
  memory: Uint8Array,
  start: number,
  end: number,
  { charSet, backtickPairs = false, showCodes = false, buffer = new BasicProgramBuffer() }: Ht1080zListingOptions
): BasicListing {
  buffer.clear();
  const limit = Math.min(end, memory.length);
  let corrupted = start > limit;
  let pos = start;
  let lineCount = 0;

  const codeCell = (code: number) => {
    if (!showCodes) return;
    buffer.paper("blue");
    buffer.ink("white");
    buffer.write(`$${toHexa2(code)}`);
    buffer.resetColor();
  };

  while (!corrupted) {
    if (pos + 1 >= limit) {
      corrupted = true;
      break;
    }
    const link = getMemoryWord(memory, pos);
    if (link === 0) break;
    // --- A link must move forward and stay inside the program
    if (link <= pos || link > limit || pos + 4 >= limit) {
      corrupted = true;
      break;
    }
    const lineNo = getMemoryWord(memory, pos + 2);
    let p = pos + 4;
    lineCount++;

    buffer.resetColor();
    buffer.ink("cyan");
    buffer.write(lineNo.toString());
    buffer.resetColor();
    buffer.write("\xa0");

    while (p < limit && memory[p] !== 0) {
      const code = memory[p++];
      // --- `:ELSE` and `:REM'` print without their colon (and REM)
      if (code === COLON && memory[p] === ELSE) continue;
      if (code === COLON && memory[p] === REM && memory[p + 1] === APOSTROPHE) {
        p++;
        continue;
      }
      if (code >= HT1080Z_FIRST_TOKEN) {
        const keyword = ht1080zTokenName(code);
        if (keyword) buffer.write(keyword);
        else codeCell(code);
        continue;
      }
      if (backtickPairs && code === BACKTICK && p < limit && memory[p] !== 0) {
        const pair = HT64_BACKTICK_PAIRS[memory[p++]];
        if (pair !== undefined) buffer.write(charSet[pair]?.v ?? "?");
        else codeCell(code);
        continue;
      }
      if (code < 0x20) {
        codeCell(code);
        continue;
      }
      buffer.write(charSet[code]?.v ?? "?");
    }
    if (p >= limit) {
      corrupted = true;
      break;
    }
    buffer.writeLine();
    pos = link;
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
