import type { CharDescriptor } from "@common/machines/info-types";
import { HT1080Z_FIRST_TOKEN, ht1080zTokenName } from "@common/ht1080z/basicTokens";
import { HT1080Z_PROGRAM_START } from "@common/ht1080z/codePlacement";
import { HT64_BACKTICK_PAIRS } from "../ht1080zBasicListing";
import type { Ht1080zBasicLine } from "./ht1080zTapeView";

/*
 * A program line as the tape viewer shows it (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D5): the text LIST
 * would print, cut into runs a listing colours - keywords, strings and the rest. It follows the same
 * rules as the BASIC Listing view's detokenizer (`ht1080zBasicListing.ts`): `:ELSE` and `:REM'` print
 * without their colon, codes below 20h print nothing, and on the /64 a backtick pair is one character.
 */

export type Ht1080zTextRun = { kind: "keyword" | "string" | "text"; text: string };

const COLON = 0x3a;
const QUOTE = 0x22;
const REM = 0x93;
const ELSE = 0x95;
const APOSTROPHE = 0xfb;
const BACKTICK = 0x60;

/**
 * The runs of one line's text
 * @param text The tokenised text, without the link, the number and the 00h
 * @param charSet The model's characters
 * @param backtickPairs The /64's backtick pairs are characters
 */
export function ht1080zLineRuns(
  text: Uint8Array,
  charSet: Record<number, CharDescriptor>,
  backtickPairs = false
): Ht1080zTextRun[] {
  const runs: Ht1080zTextRun[] = [];
  const write = (kind: Ht1080zTextRun["kind"], value: string) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += value;
    else runs.push({ kind, text: value });
  };
  const glyph = (code: number) => (charSet[code]?.v ?? "?").replace("\xa0", " ");
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const code = text[i];
    if (code === COLON && text[i + 1] === ELSE) continue;
    if (code === COLON && text[i + 1] === REM && text[i + 2] === APOSTROPHE) {
      i++;
      continue;
    }
    if (code >= HT1080Z_FIRST_TOKEN) {
      const keyword = ht1080zTokenName(code);
      if (keyword) write("keyword", keyword);
      continue;
    }
    if (backtickPairs && code === BACKTICK && i + 1 < text.length) {
      const pair = HT64_BACKTICK_PAIRS[text[i + 1]];
      if (pair !== undefined) {
        i++;
        write(inString ? "string" : "text", glyph(pair));
        continue;
      }
    }
    if (code < 0x20) continue;
    if (code === QUOTE) {
      write("string", glyph(code));
      inString = !inString;
      continue;
    }
    write(inString ? "string" : "text", glyph(code));
  }
  return runs;
}

/** A line's text as LIST prints it, without the line number */
export function ht1080zLineText(text: Uint8Array, charSet: Record<number, CharDescriptor>, backtickPairs = false): string {
  return ht1080zLineRuns(text, charSet, backtickPairs)
    .map((r) => r.text)
    .join("");
}

/**
 * A program as CLOAD leaves it: the lines at 42E9h, each link pointing at the next line there, and
 * the 0000h link after them. A program saved from another TXTTAB (a disk BASIC's) lists as it would
 * once loaded.
 */
export function relinkedProgram(lines: Ht1080zBasicLine[]): Uint8Array {
  const length = lines.reduce((sum, l) => sum + l.length, 0);
  const out = new Uint8Array(length + 2);
  let pos = 0;
  for (const line of lines) {
    const next = HT1080Z_PROGRAM_START + pos + line.length;
    out[pos] = next & 0xff;
    out[pos + 1] = next >> 8;
    out[pos + 2] = line.lineNo & 0xff;
    out[pos + 3] = line.lineNo >> 8;
    out.set(line.text, pos + 4);
    out[pos + 4 + line.text.length] = 0;
    pos += line.length;
  }
  return out;
}
