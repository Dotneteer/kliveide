import type { CharDescriptor } from "@common/machines/info-types";
import { toHexa2 } from "../services/ide-commands";
import { BasicLine, BasicProgramBuffer, getMemoryWord, SpectrumColor } from "./BasicLine";

/*
 * The ZX Spectrum BASIC detokenizer: a program's bytes into the coloured lines the BASIC views show.
 *
 * It used to live inside `BasicPanel`, reading the live machine's memory through refs, so nothing
 * else could list a program. The tape viewer lists one from a tape block, with no machine at all
 * (`.plans/TAPE_VIEWER_PLAN.md` §4.3), so the loop moved here as a pure function. Both views call
 * it, so a program reads the same in either.
 *
 * This is the ROM's own token format, decoded with the machine's character table
 * (`common/machines/char-codes.ts`) - nothing here comes from a BASIC compiler.
 */

export type BasicListingOptions = {
  /** The machine's character table: token texts, control codes, graphics */
  charSet: Record<number, CharDescriptor>;
  /** Show non-printable codes as `$NN` cells instead of applying them */
  showCodes?: boolean;
  /** Reuse a buffer (BasicPanel keeps one for copying the listing) */
  buffer?: BasicProgramBuffer;
};

export type BasicListing = {
  lines: BasicLine[];
  buffer: BasicProgramBuffer;
  /** The listing stopped early: a line number out of order or above 9999, or a line overran */
  corrupted: boolean;
  /** How many program lines were listed */
  lineCount: number;
};

const COLOR_CODES: SpectrumColor[] = [
  "black",
  "blue",
  "red",
  "magenta",
  "green",
  "cyan",
  "yellow",
  "white"
];

function colorOf(code: number): SpectrumColor {
  return COLOR_CODES[code & 0x07];
}

/**
 * Lists the BASIC program held in `memory[start..end)`.
 *
 * Each line is a big-endian line number, a little-endian length, then the tokenized text ending in
 * ENTER. The five bytes after each `$0E` are a number's hidden binary form and are skipped.
 * @param memory The bytes holding the program - all of memory, or a tape block's payload
 * @param start Where the program starts (PROG, or 0 in a payload)
 * @param end Where it ends (VARS, or the header's variables offset)
 */
export function decodeBasicProgram(
  memory: Uint8Array,
  start: number,
  end: number,
  { charSet, showCodes = false, buffer = new BasicProgramBuffer() }: BasicListingOptions
): BasicListing {
  buffer.clear();
  const getWord = (address: number) => getMemoryWord(memory, address);
  let corrupted = start > end;
  let currentPos = start;
  let lastLineNo = -1;
  let lineCount = 0;

  while (!corrupted && currentPos < end) {
    const lineNo = (memory[currentPos] << 8) + memory[currentPos + 1];
    currentPos += 2;
    const lineLength = getWord(currentPos);
    currentPos += 2;
    const nextLine = currentPos + lineLength;

    // --- Check for line number/length corruption
    if (lineNo > 9999 || lineNo < lastLineNo || nextLine > end + 1) {
      corrupted = true;
      break;
    }

    // --- Start displaying the line
    lastLineNo = lineNo;
    lineCount++;
    let lastCode = 0;
    buffer.resetColor();
    let segment = "";
    let withinQuotes = false;

    // --- Line number
    buffer.ink("cyan");
    buffer.write(lineNo.toString().padStart(4, "\xa0") + "\xa0");
    buffer.resetColor();

    // --- Iterate through the line
    while (currentPos < nextLine) {
      if (showCodes) {
        buffer.resetColor();
      }

      const code = memory[currentPos++];

      if (code === 0x0e) {
        currentPos += 5;
        continue;
      }

      if (code === 0x0d) {
        continue;
      }

      if (code === 0x22) {
        withinQuotes = !withinQuotes;
      }

      const nextSymbol = charSet[code] ?? {};
      const codeCell = (paper: SpectrumColor, value = code) => {
        buffer.paper(paper);
        buffer.ink("white");
        segment += `$${toHexa2(value)}`;
      };
      switch (nextSymbol.c) {
        case "ctrl":
          if (showCodes) codeCell("blue");
          break;
        case "graph":
          if (showCodes) codeCell("magenta");
          break;
        case "pr":
          if (showCodes) codeCell("magenta");
          switch (code) {
            case 0x10:
              if (!showCodes) buffer.ink(colorOf(memory[currentPos]));
              currentPos++;
              break;
            case 0x11:
              if (!showCodes) buffer.paper(colorOf(memory[currentPos]));
              currentPos++;
              break;
            case 0x12:
              if (!showCodes) buffer.flash(memory[currentPos] !== 0);
              currentPos++;
              break;
            case 0x13:
              if (!showCodes) buffer.bright(memory[currentPos] !== 0);
              currentPos++;
              break;
            case 0x14:
              if (!showCodes) buffer.inverse(memory[currentPos] !== 0);
              currentPos++;
              break;
            case 0x15:
              if (showCodes) codeCell("magenta", memory[currentPos]);
              currentPos++;
              break;
            case 0x16:
              if (showCodes) {
                codeCell("magenta", memory[currentPos]);
                segment += `$${toHexa2(memory[currentPos + 1])}`;
              }
              currentPos += 2;
              break;
            case 0x17:
              // --- TAB takes two bytes, like AT. The panel's loop consumed none, so they printed
              // --- as stray characters (and, with codes on, wrote `$17` twice).
              if (showCodes) {
                segment += `$${toHexa2(memory[currentPos])}$${toHexa2(memory[currentPos + 1])}`;
              }
              currentPos += 2;
              break;
          }
          break;
        case "udg":
          if (showCodes) codeCell("green");
          break;
        case "token":
          if (
            (lastCode >= 0x61 && lastCode <= 0x7a) ||
            (lastCode >= 0x41 && lastCode <= 0x5a) ||
            (lastCode >= 0x30 && lastCode <= 0x39)
          ) {
            segment += "\xa0";
          }
          segment += (nextSymbol.t ?? "").toUpperCase();
          segment += " ";
          break;
        default:
          segment = nextSymbol.v ?? "";
          if ((nextSymbol.v === ":" || nextSymbol.v === ";") && !withinQuotes) {
            segment += "\xa0";
          }
          break;
      }

      if (segment) {
        buffer.write(segment);
        segment = "";
      }

      lastCode = code;
    }

    // --- Next line
    currentPos = nextLine;
    buffer.writeLine();
  }

  // --- Mark corrupted code
  if (corrupted) {
    buffer.resetColor();
    buffer.writeLine();
    buffer.bright(true);
    buffer.paper("white");
    buffer.ink("red");
    buffer.inverse(true);
    buffer.writeLine("*** BASIC code corrupted or partially loaded ***");
  }

  return { lines: buffer.getContents(), buffer, corrupted, lineCount };
}

/** A listing's plain text, one program line per text line */
export function basicListingText(lines: BasicLine[]): string {
  return lines
    .map((line) => line.spans.map((s) => s.text).join(""))
    .join("\n")
    .replace(/\xa0/g, " ")
    .replace(/\n+$/, "");
}
