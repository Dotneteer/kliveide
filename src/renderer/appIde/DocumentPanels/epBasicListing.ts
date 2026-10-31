import { decodeEpBasicFromMemory } from "@common/enterprise/basicTokens";
import type { CharDescriptor } from "@common/machines/info-types";
import { toHexa2 } from "../services/ide-commands";
import { BasicProgramBuffer } from "./BasicLine";
import type { BasicListing } from "./basicListing";

/*
 * The Enterprise's IS-BASIC listing (`.plans/ENTERPRISE_PLAN.md` §11.4): the current program, through
 * IS-BASIC's own pointers (021Ah, 0236h in segment F8h at page 0), detokenised as LIST prints it
 * (`common/enterprise/basicTokens.ts`, observed on the running ROM). Each character goes through
 * EXOS's font (`EpChars`), so 23h shows as the machine shows it, £; a code with no glyph is a `$NN`
 * cell when codes are shown.
 */

export type EpListingOptions = {
  /** The machine's character set (`EpChars`) */
  charSet: Record<number, CharDescriptor>;
  /** Show the codes that have no glyph as `$NN` cells */
  showCodes?: boolean;
  /** Reuse a buffer (BasicPanel keeps one for copying the listing) */
  buffer?: BasicProgramBuffer;
};

/** The decoder writes a code with no ASCII glyph as `{NN}` */
const CODE = /\{([0-9A-F]{2})\}/g;

/**
 * Lists IS-BASIC's current program.
 * @param memory The 64K the CPU sees at IS-BASIC's prompt (segment F8h at page 0)
 */
export function decodeEpBasicListing(
  memory: Uint8Array,
  { charSet, showCodes = false, buffer = new BasicProgramBuffer() }: EpListingOptions
): BasicListing {
  buffer.clear();
  const character = (code: number) => {
    const glyph = charSet[code]?.v;
    if (glyph !== undefined) {
      buffer.write(glyph);
    } else if (showCodes) {
      buffer.paper("blue");
      buffer.ink("white");
      buffer.write(`$${toHexa2(code)}`);
      buffer.resetColor();
    }
  };
  const lines = decodeEpBasicFromMemory(memory);
  for (const line of lines) {
    buffer.resetColor();
    buffer.ink("cyan");
    buffer.write(line.lineNo.toString());
    buffer.resetColor();
    buffer.write("\xa0" + "\xa0\xa0".repeat(line.indent));
    let last = 0;
    for (const match of line.text.matchAll(CODE)) {
      for (const c of line.text.slice(last, match.index)) character(c.charCodeAt(0));
      character(parseInt(match[1], 16));
      last = match.index! + match[0].length;
    }
    for (const c of line.text.slice(last)) character(c.charCodeAt(0));
    buffer.writeLine();
  }
  return { lines: buffer.getContents(), buffer, corrupted: false, lineCount: lines.length };
}
