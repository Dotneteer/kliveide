/*
 * HT-1080Z tape files (`.plans/HT1080Z_PLAN.md` §9; `_input/ht1080z/STORAGE_FIRMWARE_SOFTWARE.md` §3):
 * `.cas`, `.cmd` and `.bas`, each turned into the `.cas` bit stream the core plays and reads.
 *
 * The `.cas` header detection - 00 bytes then the A5h sync, at any bit offset, and the 1500-baud
 * Model III header 55h ... 7Fh, which the HT cannot read - is ported from lkesteloot/trs80,
 * `packages/trs80-base/src/Cassette.ts` (`checkMatch`, `findHeader`), commit 11ed9327. Its licence:
 *
 *   MIT License
 *
 *   Copyright (c) 2021 Lawrence Kesteloot
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 *   associated documentation files (the "Software"), to deal in the Software without restriction,
 *   including without limitation the rights to use, copy, modify, merge, publish, distribute,
 *   sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all copies or
 *   substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 *   BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 *   NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 *   DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * The rest is Klive's: the `.cmd` record reading follows the record layout in STORAGE §3.5 (type,
 * length, data; a load block's length 0, 1 or 2 means 256, 257 or 258), and the tapes are built as
 * the ROM writes them (§3.4): 255 zero bytes, A5h, then the file.
 */

/** The extensions of the files the HT-1080Z loads from tape */
export const HT1080Z_TAPE_EXTENSIONS = [".cas", ".cmd", ".bas"];

/** Whether a file name is an HT-1080Z tape file */
export function isHt1080zTapeFileName(fileName: string | undefined): boolean {
  const lower = (fileName ?? "").toLowerCase();
  return HT1080Z_TAPE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** What the first program on the tape is, which decides how it is loaded and started */
export type Ht1080zTapeProgramKind = "basic" | "system" | "unknown";

/** A tape file, ready for the core */
export type Ht1080zTapeFile = {
  /** The file type the image came from */
  source: "cas" | "cmd" | "bas";
  /** The `.cas` bit stream the core plays (`MEDIA_TAPE`) */
  tapeBytes: Uint8Array;
  /** The first program's kind: `CLOAD` for BASIC, `SYSTEM` for machine code */
  kind: Ht1080zTapeProgramKind;
  /** The first program's name as recorded (1 character for BASIC, up to 6 for SYSTEM) */
  name: string;
};

import type { MessageKey } from "@common/i18n/keys.generated";
import { isTokenisedHt1080zBasic } from "@common/ht1080z/basContent";

/** Why a file cannot go on an HT-1080Z tape: the IDE shows `HT1080Z_TAPE_ERROR_KEYS[code]` */
export type Ht1080zTapeFileErrorCode =
  | "highSpeed"
  | "noHeader"
  | "cmdTruncated"
  | "cmdBadRecord"
  | "cmdNoEntry"
  | "cmdNoCode"
  | "basNotTokenised"
  | "notTapeFile";

/** The message the user reads for each reason (with the file's path as `{file}`) */
export const HT1080Z_TAPE_ERROR_KEYS: Readonly<Record<Ht1080zTapeFileErrorCode, MessageKey>> = {
  highSpeed: "emu.media.tape.ht1080z.highSpeed",
  noHeader: "emu.media.tape.ht1080z.noHeader",
  cmdTruncated: "emu.media.tape.ht1080z.cmdTruncated",
  cmdBadRecord: "emu.media.tape.ht1080z.cmdBadRecord",
  cmdNoEntry: "emu.media.tape.ht1080z.cmdNoEntry",
  cmdNoCode: "emu.media.tape.ht1080z.cmdNoCode",
  basNotTokenised: "emu.media.tape.ht1080z.basNotTokenised",
  notTapeFile: "emu.media.tape.ht1080z.notTapeFile"
};

/** The reason's message key for any error a tape file's reading threw */
export function ht1080zTapeErrorKey(err: unknown): MessageKey {
  return HT1080Z_TAPE_ERROR_KEYS[err instanceof Ht1080zTapeFileError ? err.code : "notTapeFile"];
}

/**
 * Whether a file goes in the HT-1080Z's deck: a `.cas` or `.cmd` always; a `.bas` when its content is a
 * tokenised HT program (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D1, D6), or - its content unknown or text
 * - while the HT runs, where reading it says why a text `.bas` is not a tape. Elsewhere a text `.bas`
 * is BASIC source (Klive BASIC, Boriel BASIC).
 * @param bytes The file's bytes (or its first ones), when known
 */
export function isHt1080zTapeFor(
  fileName: string | undefined,
  machineId: string | undefined,
  bytes?: ArrayLike<number>
): boolean {
  if (!isHt1080zTapeFileName(fileName)) return false;
  if (!fileName!.toLowerCase().endsWith(".bas")) return true;
  return machineId === "ht1080z" || (!!bytes && isTokenisedHt1080zBasic(bytes, true));
}

/** Thrown for a file that cannot go on an HT-1080Z tape, with the reason (English, for logs) */
export class Ht1080zTapeFileError extends Error {
  constructor(
    readonly code: Ht1080zTapeFileErrorCode,
    message: string
  ) {
    super(message);
  }
}

const LEADER_LENGTH = 255;
const SYNC = 0xa5;
const BASIC_HEADER = 0xd3;
const SYSTEM_HEADER = 0x55;
const SYSTEM_BLOCK = 0x3c;
const SYSTEM_ENTRY = 0x78;

const LOW_SPEED_DETECT = 0x000000a5;
const HIGH_SPEED_DETECT = (0x55 << 24) | (0x55 << 16) | (0x55 << 8) | 0x7f;

/** lkesteloot `checkMatch`: the bit offset at which the last 32 bits end with `reference`, if any */
function checkMatch(actual: number, reference: number): number | undefined {
  for (let offset = 0; offset < 8; offset++) {
    if (((actual & ~((1 << offset) - 1)) >>> 0) === ((reference << offset) >>> 0)) return offset;
  }
  return undefined;
}

/**
 * lkesteloot `findHeader`, reduced to what the HT needs: where the first low-speed sync ends, as a bit
 * index into the image (the first bit of the program), or "high" for a 1500-baud header first
 */
function findSync(binary: Uint8Array): number | "high" | undefined {
  let recentBits = 0xffffffff;
  for (let i = 0; i < binary.length; i++) {
    recentBits = ((recentBits << 8) | binary[i]) >>> 0;
    const low = checkMatch(recentBits, LOW_SPEED_DETECT);
    if (low !== undefined) return (i + 1) * 8 - low;
    if (checkMatch(recentBits, HIGH_SPEED_DETECT) !== undefined) return "high";
  }
  return undefined;
}

/** The byte that starts at bit `bit` of the image */
function byteAtBit(binary: Uint8Array, bit: number): number {
  const index = bit >> 3;
  const shift = bit & 7;
  const value = ((binary[index] ?? 0) << 8) | (binary[index + 1] ?? 0);
  return (value >> (8 - shift)) & 0xff;
}

/** The first program of a `.cas`: its kind and name, read past the sync */
function describeCas(binary: Uint8Array): { kind: Ht1080zTapeProgramKind; name: string } {
  const sync = findSync(binary);
  if (sync === "high") {
    throw new Ht1080zTapeFileError(
      "highSpeed",
      "This is a 1500-baud (Model III) cassette image; the HT-1080Z reads 500-baud tapes only."
    );
  }
  if (sync === undefined) {
    throw new Ht1080zTapeFileError("noHeader", "No 500-baud tape header (zero bytes and the A5h sync) was found in this file.");
  }
  const at = (n: number) => byteAtBit(binary, sync + n * 8);
  if (at(0) === BASIC_HEADER && at(1) === BASIC_HEADER && at(2) === BASIC_HEADER) {
    return { kind: "basic", name: String.fromCharCode(at(3)) };
  }
  if (at(0) === SYSTEM_HEADER) {
    let name = "";
    for (let i = 1; i <= 6; i++) name += String.fromCharCode(at(i));
    return { kind: "system", name: name.trimEnd() };
  }
  return { kind: "unknown", name: "" };
}

/** A tape image: the leader, the sync and the file's bytes, as the ROM writes them */
function withLeader(body: number[]): Uint8Array {
  return new Uint8Array([...new Array(LEADER_LENGTH).fill(0), SYNC, ...body]);
}

/** A name for a tape: letters and digits of the file name, upper case, at most `length` */
function tapeName(fileName: string, length: number): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  const name = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, length);
  return name || "A".repeat(1);
}

/**
 * A `.cmd` load module as a SYSTEM tape: its load blocks (records 01, split to at most 256 bytes) and
 * its transfer address (record 02). Other records (05 header, 1F copyright...) are skipped, as the
 * TRSDOS loader skips them.
 */
export function cmdToSystemTape(cmd: Uint8Array, name: string): Uint8Array {
  const blocks: { address: number; data: number[] }[] = [];
  let entry: number | undefined;
  let pos = 0;
  while (pos < cmd.length) {
    const type = cmd[pos++];
    if (pos >= cmd.length) break;
    let length = cmd[pos++];
    if (type === 0x01 && length <= 2) length += 256;
    else if (length === 0) length = 256;
    if (pos + length > cmd.length) throw new Ht1080zTapeFileError("cmdTruncated", "The .cmd file is truncated.");
    const data = Array.from(cmd.subarray(pos, pos + length));
    pos += length;
    if (type === 0x01) {
      blocks.push({ address: data[0] | (data[1] << 8), data: data.slice(2) });
    } else if (type === 0x02) {
      entry = data[0] | ((data[1] ?? 0) << 8);
      break;
    } else if (type > 0x1f) {
      throw new Ht1080zTapeFileError("cmdBadRecord", `The .cmd file has an unknown record type ${type.toString(16)}h.`);
    }
  }
  if (entry === undefined) throw new Ht1080zTapeFileError("cmdNoEntry", "The .cmd file has no transfer address (record 02).");
  if (blocks.length === 0) throw new Ht1080zTapeFileError("cmdNoCode", "The .cmd file has no load blocks (record 01).");
  const body: number[] = [SYSTEM_HEADER, ...name.padEnd(6, " ").slice(0, 6).split("").map((c) => c.charCodeAt(0))];
  for (const block of blocks) {
    for (let offset = 0; offset < block.data.length; offset += 256) {
      const chunk = block.data.slice(offset, offset + 256);
      const address = (block.address + offset) & 0xffff;
      let checksum = (address & 0xff) + (address >> 8);
      for (const b of chunk) checksum += b;
      body.push(SYSTEM_BLOCK, chunk.length & 0xff, address & 0xff, address >> 8, ...chunk, checksum & 0xff);
    }
  }
  body.push(SYSTEM_ENTRY, entry & 0xff, entry >> 8);
  return withLeader(body);
}

/**
 * A tokenised `.bas` (an FFh, then the program lines) as a CLOAD tape: D3h D3h D3h, the name, the
 * lines, ending in a 00 00 link. CLOAD relinks the lines wherever the program lands.
 */
export function basToBasicTape(bas: Uint8Array, name: string): Uint8Array {
  if (bas.length < 3 || bas[0] !== 0xff) {
    throw new Ht1080zTapeFileError("basNotTokenised", "This .bas file is not tokenised BASIC (it does not start with FFh).");
  }
  const program = Array.from(bas.subarray(1));
  // --- The end of the program is a 00 00 link; a file cut short of it gets one
  const last = program.length;
  if (!(last >= 2 && program[last - 1] === 0 && program[last - 2] === 0)) program.push(0, 0);
  return withLeader([BASIC_HEADER, BASIC_HEADER, BASIC_HEADER, name.charCodeAt(0), ...program]);
}

/**
 * Reads a tape file by its extension. `.cas` is used as it is; `.cmd` and `.bas` are turned into the
 * tape the ROM would have written for them.
 * @throws Ht1080zTapeFileError for a file the HT-1080Z cannot load
 */
export function parseHt1080zTapeFile(data: Uint8Array, fileName: string): Ht1080zTapeFile {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".cas")) {
    const { kind, name } = describeCas(data);
    return { source: "cas", tapeBytes: data, kind, name };
  }
  if (lower.endsWith(".cmd")) {
    const name = tapeName(fileName, 6);
    return { source: "cmd", tapeBytes: cmdToSystemTape(data, name), kind: "system", name };
  }
  if (lower.endsWith(".bas")) {
    const name = tapeName(fileName, 1);
    return { source: "bas", tapeBytes: basToBasicTape(data, name), kind: "basic", name };
  }
  throw new Ht1080zTapeFileError("notTapeFile", `'${fileName}' is not an HT-1080Z tape file (.cas, .cmd or .bas).`);
}

/**
 * The file name a SAVE gets: the program's name on the tape (`CSAVE "A"` -> `A.cas`, a SYSTEM tape
 * its 6 characters), or `ht1080z-save.cas` when there is none to read
 */
export function ht1080zSavedFileName(cas: Uint8Array): string {
  try {
    const { name } = describeCas(cas);
    const safe = name.replace(/[^A-Za-z0-9_-]/g, "");
    return `${safe || "ht1080z-save"}.cas`;
  } catch {
    return "ht1080z-save.cas";
  }
}

/** Whether a machine property holds an HT-1080Z tape (a Spectrum tape is an array of blocks) */
export function isHt1080zTapeFile(value: unknown): value is Ht1080zTapeFile {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Ht1080zTapeFile).tapeBytes instanceof Uint8Array &&
    typeof (value as Ht1080zTapeFile).kind === "string"
  );
}
