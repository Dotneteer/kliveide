import { splitPlus3Header, type Plus3Header } from "@common/diskfs/plus3dos";

import { LORES_FILE_BYTES } from "./loresScreen";
import { TIMEX_FILE_BYTES } from "./timexScreen";
import { SCR_FILE_BYTES } from "./zxScreen";

/*
 * Screen files of one fixed size (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, §3): the ZX Spectrum
 * screen, LoRes and the two Timex modes. Pure. Any of them may follow a 128-byte PLUS3DOS header,
 * which +3 BASIC and NextBASIC (`SAVE ... SCREEN$`, `SAVE ... LAYER`) put in front of what they save.
 * Layer 2 files have sizes of their own and a palette: `zxnext/layer2/layer2File.ts`.
 */

export type ScreenFileKind = "scr" | "slr" | "shc" | "shr";

/** The size of each kind's picture, without a header */
export const SCREEN_FILE_BYTES: Record<ScreenFileKind, number> = {
  scr: SCR_FILE_BYTES,
  slr: LORES_FILE_BYTES,
  shc: TIMEX_FILE_BYTES,
  shr: TIMEX_FILE_BYTES
};

export type ScreenFile = {
  kind: ScreenFileKind;
  /** The picture's bytes, after the header if there is one */
  body: Uint8Array;
  header?: Plus3Header;
  /** The whole file, header included */
  bytes: Uint8Array;
};

export type ScreenFileError = {
  /** The whole file's size */
  size: number;
  /** The size the kind needs, without a header */
  expected: number;
};

/** Reads a screen file of a kind: its picture after an optional PLUS3DOS header, or why not */
export function readScreenFile(
  kind: ScreenFileKind,
  bytes: Uint8Array
): { file: ScreenFile; error?: undefined } | { file?: undefined; error: ScreenFileError } {
  const { header, body } = splitPlus3Header(bytes);
  const expected = SCREEN_FILE_BYTES[kind];
  if (body.length !== expected) return { error: { size: bytes.length, expected } };
  return { file: { kind, body, header, bytes } };
}
