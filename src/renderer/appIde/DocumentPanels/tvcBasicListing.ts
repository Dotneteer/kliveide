import { TVC_TOKEN, tvcTokenName } from "@common/tvc/basicTokens";
import type { CharDescriptor } from "@common/machines/info-types";
import { t } from "@common/i18n/i18n";
import { toHexa2 } from "../services/ide-commands";
import { BasicProgramBuffer, getMemoryWord } from "./BasicLine";
import type { BasicListing } from "./basicListing";

/*
 * The Videoton TVC's BASIC detokenizer (`.plans/VIDEOTON_TVC_PLAN.md` §11): a program's bytes into
 * the lines the BASIC Listing view shows. The format, observed on the core (`test/tvc-hw/basic-
 * listing.test.ts` types programs and lists them):
 *
 * - The program starts where the TEXT system variable (1722h) says: 19EFh after a boot on both
 *   models, higher after `LOMEM`. A line is its length (with the length byte and the terminator), a
 *   little-endian line number, the text and FFh; a length of 0 ends the program.
 * - The text is stored as typed, spaces included; the space after the line number is not stored.
 * - Bytes 95h-FEh are tokens (`basicTokens.ts`), the colon between statements among them. Inside
 *   quotes they are characters, and so is the rest of a line after REM or `!`, and a DATA statement's
 *   text up to an unquoted colon.
 * - The Hungarian letters are at 00h-08h and 10h-18h (`TvcChars`); other codes below 20h and codes
 *   from 80h up outside the tokens have no glyph.
 */

/** Where the program starts after a boot */
export const TVC_PROGRAM_START = 0x19ef;
/** TEXT: the address of the program's first line */
const TVC_TEXT = 0x1722;
/** The program's ceiling on an unreserved 64K: BFFFh HIMEM less the ROM's 100h gap */
const TVC_PROGRAM_LIMIT = 0xbeff;

const QUOTE = 0x22;
const END_OF_LINE = 0xff;

export type TvcListingOptions = {
  /** The machine's character set (`TvcChars`) */
  charSet: Record<number, CharDescriptor>;
  /** BASIC 2.2's tokens (the 64K+) */
  basic22: boolean;
  /** Show the codes that have no glyph as `$NN` cells */
  showCodes?: boolean;
  /** Reuse a buffer (BasicPanel keeps one for copying the listing) */
  buffer?: BasicProgramBuffer;
};

/** Where the program starts: TEXT, when it points into BASIC's memory */
export function tvcProgramStart(memory: Uint8Array): number {
  const text = getMemoryWord(memory, TVC_TEXT);
  return text >= TVC_PROGRAM_START && text < TVC_PROGRAM_LIMIT ? text : TVC_PROGRAM_START;
}

/**
 * Lists the BASIC program that starts at TEXT.
 * @param memory The 64K the CPU sees at BASIC's prompt (U0 at page 0)
 */
export function decodeTvcProgram(
  memory: Uint8Array,
  { charSet, basic22, showCodes = false, buffer = new BasicProgramBuffer() }: TvcListingOptions
): BasicListing {
  buffer.clear();
  const limit = Math.min(TVC_PROGRAM_LIMIT, memory.length);
  let corrupted = false;
  let pos = tvcProgramStart(memory);
  let lineCount = 0;

  const codeCell = (code: number) => {
    if (!showCodes) return;
    buffer.paper("blue");
    buffer.ink("white");
    buffer.write(`$${toHexa2(code)}`);
    buffer.resetColor();
  };
  const character = (code: number) => {
    const glyph = charSet[code]?.v;
    if (glyph !== undefined) buffer.write(glyph);
    else codeCell(code);
  };

  while (pos < limit) {
    const length = memory[pos];
    if (length === 0) break;
    const next = pos + length;
    // --- Length, line number and terminator at least, and the terminator where the length says
    if (length < 4 || next > limit || memory[next - 1] !== END_OF_LINE) {
      corrupted = true;
      break;
    }
    lineCount++;
    buffer.resetColor();
    buffer.ink("cyan");
    buffer.write(getMemoryWord(memory, pos + 1).toString());
    buffer.resetColor();
    buffer.write("\xa0");

    let inQuotes = false;
    let literalToEnd = false;
    let inData = false;
    for (let p = pos + 3; p < next - 1; p++) {
      const code = memory[p];
      if (code === QUOTE && !literalToEnd) {
        inQuotes = !inQuotes;
        buffer.write('"');
        continue;
      }
      if (inQuotes || literalToEnd) {
        character(code);
        continue;
      }
      if (inData) {
        // --- An unquoted colon ends the DATA statement and tokens resume
        if (code !== TVC_TOKEN.colon) {
          character(code);
          continue;
        }
        inData = false;
      }
      const word = tvcTokenName(code, basic22);
      if (word === undefined) {
        character(code);
        continue;
      }
      buffer.write(word);
      if (code === TVC_TOKEN.rem || code === TVC_TOKEN.comment) literalToEnd = true;
      else if (code === TVC_TOKEN.data) inData = true;
    }
    buffer.writeLine();
    pos = next;
  }
  if (pos >= limit) corrupted = true;

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
