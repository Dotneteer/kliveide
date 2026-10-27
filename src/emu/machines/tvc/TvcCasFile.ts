/*
 * Videoton TVC tape files (`.plans/VIDEOTON_TVC_PLAN.md` §9; the container and the signal are
 * documented in `_input/videoton-tvc/rtvc/info/tvc.md`, "CAS Cassette Representation").
 *
 * A `.cas` file is a 144-byte header and the payload:
 *   0      11h, the file identifier
 *   2-3    the number of whole 128-byte records in header + payload
 *   4-5    the bytes in the last, partial record
 *   80h    00h; 81h the file type; 82h-83h the payload length; 84h the autostart flag (nonzero: run
 *          after loading); 87h-88h the load address
 *   90h... the payload
 *
 * On tape the ROM writes a file as two blocks, each after silence, a pilot and one sync cycle:
 *   header: 00h (outside the CRC), 6Ah, FFh (header block), 11h (unbuffered), 00h (not protected),
 *           01h (one sector), sector 00h, its length (name + 17), the name's length, the name, 00h,
 *           the file type, the payload length, the autostart flag, 10 zero bytes, the version, the
 *           sector's end marker (00h), its CRC
 *   data:   00h, 6Ah, 00h (data block), 11h, 00h, the sector count, then each sector: its number
 *           (from 1), its length (00h = 256), the bytes, the end marker (00h after a full sector,
 *           FFh after a partial one), its CRC (reset before every sector but the first)
 * Bits go LSB first, one full cycle each: a 0 is 779 + 779 T, a 1 567 + 567 T; the pilot's cycles
 * are 638 + 638 T and the sync's 1205 + 1205 T; a "nominal second" of silence is 22,052 samples at
 * 44.1 kHz, the established converter's (the CRC and the timings are the documented ones).
 *
 * The core plays a tape program (`tvc-tape.c`): silence, runs of equal cycles, and data bytes.
 */

export const TVC_CAS_HEADER_LENGTH = 144;
export const TVC_CAS_EXTENSION = ".cas";

const OP_CYCLES = 0x4000_0000;
const OP_BYTE = 0x8000_0000;
const PILOT_HALF = 638;
const SYNC_HALF = 1205;
const BIT0_HALF = 779;
const BIT1_HALF = 567;
const SECTOR_SIZE = 256;

/** A tape file, ready for the core */
export type TvcTapeFile = {
  readonly kind: "tvc-cas";
  /** The name written to the tape's header: the file name's stem, upper case, up to 16 characters */
  readonly name: string;
  readonly fileType: number;
  readonly autostart: boolean;
  readonly payload: Uint8Array;
  /** The tape program the core plays (`tvcTapeProgramPtr`) */
  readonly program: Uint32Array;
};

/** Why a file cannot go on a TVC tape */
export type TvcCasErrorCode = "notCas" | "tooShort" | "lengthMismatch" | "tooManySectors";

export class TvcCasFileError extends Error {
  constructor(readonly code: TvcCasErrorCode) {
    super(`Not a usable TVC .cas file (${code}).`);
  }
}

export function isTvcCasFileName(fileName: string | undefined): boolean {
  return (fileName ?? "").toLowerCase().endsWith(TVC_CAS_EXTENSION);
}

export function isTvcTapeFile(value: unknown): value is TvcTapeFile {
  return typeof value === "object" && value !== null && (value as TvcTapeFile).kind === "tvc-cas";
}

/** The tape name for a file name: its stem, upper case, printable ASCII, at most 16 characters */
export function tvcTapeNameOf(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  return base
    .toUpperCase()
    .replace(/[^\x20-\x7e]/g, "")
    .slice(0, 16);
}

/**
 * Reads a `.cas` file.
 * @throws TvcCasFileError when it is not one
 */
export function parseTvcCasFile(bytes: Uint8Array, fileName: string): TvcTapeFile {
  if (bytes.length === 0 || bytes[0] !== 0x11) throw new TvcCasFileError("notCas");
  if (bytes.length < TVC_CAS_HEADER_LENGTH) throw new TvcCasFileError("tooShort");
  const records = bytes[2] | (bytes[3] << 8);
  const rest = bytes[4] | (bytes[5] << 8);
  const total = records * 128 + rest;
  const payloadLength = Math.max(0, total - TVC_CAS_HEADER_LENGTH);
  if (bytes.length < TVC_CAS_HEADER_LENGTH + payloadLength) throw new TvcCasFileError("lengthMismatch");
  const payload = bytes.slice(TVC_CAS_HEADER_LENGTH, TVC_CAS_HEADER_LENGTH + payloadLength);
  if (Math.ceil(payload.length / SECTOR_SIZE) > 255) throw new TvcCasFileError("tooManySectors");
  const name = tvcTapeNameOf(fileName);
  const fileType = bytes[0x81];
  const autostart = bytes[0x84] !== 0;
  return { kind: "tvc-cas", name, fileType, autostart, payload, program: buildTvcTapeProgram(name, fileType, autostart, payload) };
}

/** The CRC the ROM keeps over a block's bits */
class TapeCrc {
  value = 0;
  bit(bit: number): void {
    const carry = ((((this.value >> 8) & 0xff) ^ (bit ? 0x80 : 0)) & 0x80) !== 0;
    if (carry) this.value ^= 0x0810;
    this.value = (this.value << 1) & 0xffff;
    if (carry) this.value |= 1;
  }
  byte(value: number): void {
    for (let i = 0; i < 8; i++) this.bit((value >> i) & 1);
  }
}

/** Silence of `nominalSeconds` of the converter's seconds (22,052 samples at 44.1 kHz) */
const silence = (nominalSeconds: number) => Math.round((22_052 * nominalSeconds * 3_125_000) / 44_100);
const cycles = (half: number, count: number) => (OP_CYCLES | (half << 16) | count) >>> 0;

/** The tape program of one file: the header block, then the data block */
export function buildTvcTapeProgram(name: string, fileType: number, autostart: boolean, payload: Uint8Array): Uint32Array {
  const words: number[] = [];
  const crc = new TapeCrc();
  const byte = (value: number, counted = true) => {
    words.push((OP_BYTE | (value & 0xff)) >>> 0);
    if (counted) crc.byte(value);
  };
  const word = (value: number, counted = true) => {
    byte(value & 0xff, counted);
    byte((value >> 8) & 0xff, counted);
  };
  const start = (pilotCycles: number) => {
    words.push(cycles(PILOT_HALF, pilotCycles), cycles(SYNC_HALF, 1));
    byte(0x00, false);
    crc.value = 0;
    byte(0x6a);
  };
  const nameBytes = Array.from(name, (c) => c.charCodeAt(0) & 0x7f);

  // --- The header block
  words.push(silence(2));
  start(10_240);
  [0xff, 0x11, 0x00, 0x01, 0x00, nameBytes.length + 17, nameBytes.length, ...nameBytes, 0x00, fileType].forEach((b) =>
    byte(b)
  );
  word(payload.length);
  byte(autostart ? 0xff : 0x00);
  for (let i = 0; i < 10; i++) byte(0x00);
  byte(0x00); // --- The version
  byte(0x00); // --- The sector's end marker
  word(crc.value, false);
  words.push(cycles(PILOT_HALF, 5), silence(1));

  // --- The data block
  start(5_120);
  const sectors = Math.ceil(payload.length / SECTOR_SIZE);
  [0x00, 0x11, 0x00, sectors].forEach((b) => byte(b));
  for (let sector = 1; sector <= sectors; sector++) {
    if (sector > 1) crc.value = 0;
    const from = (sector - 1) * SECTOR_SIZE;
    const length = Math.min(SECTOR_SIZE, payload.length - from);
    byte(sector);
    byte(length === SECTOR_SIZE ? 0 : length);
    for (let i = 0; i < length; i++) byte(payload[from + i]);
    byte(length === SECTOR_SIZE ? 0x00 : 0xff);
    word(crc.value, false);
  }
  words.push(cycles(PILOT_HALF, 5), silence(2));
  return Uint32Array.from(words);
}

/** How long the tape program plays, in T-states */
export function tvcTapeProgramTacts(program: Uint32Array): number {
  let tacts = 0;
  for (const op of program) {
    const kind = op >>> 30;
    if (kind === 0) tacts += op & 0x3fff_ffff;
    else if (kind === 1) tacts += ((op >>> 16) & 0x3fff) * 2 * (op & 0xffff);
    else for (let i = 0; i < 8; i++) tacts += ((op >> i) & 1 ? BIT1_HALF : BIT0_HALF) * 2;
  }
  return tacts;
}

/** Writes a `.cas` container around a payload */
export function buildTvcCasFile(payload: Uint8Array, fileType: number, autostart: boolean, loadAddress = 0): Uint8Array {
  const total = TVC_CAS_HEADER_LENGTH + payload.length;
  const cas = new Uint8Array(total);
  cas[0] = 0x11;
  cas[2] = (total >> 7) & 0xff;
  cas[3] = (total >> 15) & 0xff;
  cas[4] = total & 0x7f;
  cas[0x81] = fileType;
  cas[0x82] = payload.length & 0xff;
  cas[0x83] = (payload.length >> 8) & 0xff;
  cas[0x84] = autostart ? 0xff : 0x00;
  cas[0x87] = loadAddress & 0xff;
  cas[0x88] = (loadAddress >> 8) & 0xff;
  cas.set(payload, TVC_CAS_HEADER_LENGTH);
  return cas;
}

/** A file the core recorded from a SAVE */
export type TvcSavedFile = { name: string; fileType: number; autostart: boolean; payload: Uint8Array; cas: Uint8Array };

/**
 * Builds the `.cas` from the blocks the core decoded while the ROM saved (`tvcTapeSavedDataPtr`):
 * each a 2-byte length and its bytes, from the 00h after the sync. Checks the markers, the sector
 * numbers and every CRC.
 * @returns the file, or undefined when the recording is not a whole, valid file
 */
export function tvcSavedFileOf(recording: Uint8Array): TvcSavedFile | undefined {
  const blocks: Uint8Array[] = [];
  for (let i = 0; i + 2 <= recording.length; ) {
    const length = recording[i] | (recording[i + 1] << 8);
    blocks.push(recording.subarray(i + 2, i + 2 + length));
    i += 2 + length;
  }
  const header = blocks.find((b) => b[0] === 0x00 && b[1] === 0x6a && b[2] === 0xff);
  const data = blocks.find((b) => b[0] === 0x00 && b[1] === 0x6a && b[2] === 0x00);
  if (!header || !data) return undefined;
  // --- The header sector: 00 6A FF 11 00 01 | 00 len | nameLen name 00 type lenLo lenHi auto ...
  const crc = new TapeCrc();
  // --- From 6Ah through the sector's length byte
  for (let i = 1; i < 8; i++) crc.byte(header[i]);
  const sectorLength = header[7];
  const body = header.subarray(8, 8 + sectorLength);
  body.forEach((b) => crc.byte(b));
  const endMarker = header[8 + sectorLength];
  crc.byte(endMarker);
  const storedCrc = header[9 + sectorLength] | (header[10 + sectorLength] << 8);
  if (crc.value !== storedCrc) return undefined;
  const nameLength = body[0];
  const name = String.fromCharCode(...body.subarray(1, 1 + nameLength));
  const fileType = body[2 + nameLength];
  const length = body[3 + nameLength] | (body[4 + nameLength] << 8);
  const autostart = body[5 + nameLength] !== 0;
  // --- The data sectors
  const payload = new Uint8Array(length);
  const dataCrc = new TapeCrc();
  for (let i = 1; i < 6; i++) dataCrc.byte(data[i]);
  const sectors = data[5];
  let at = 6;
  let filled = 0;
  for (let sector = 1; sector <= sectors; sector++) {
    if (sector > 1) dataCrc.value = 0;
    if (data[at] !== sector) return undefined;
    const size = data[at + 1] === 0 ? SECTOR_SIZE : data[at + 1];
    for (let i = 0; i < 2 + size + 1; i++) dataCrc.byte(data[at + i]);
    const stored = data[at + 3 + size] | (data[at + 4 + size] << 8);
    if (dataCrc.value !== stored) return undefined;
    payload.set(data.subarray(at + 2, at + 2 + Math.min(size, length - filled)), filled);
    filled += size;
    at += 5 + size;
  }
  if (filled < length) return undefined;
  return { name, fileType, autostart, payload, cas: buildTvcCasFile(payload, fileType, autostart) };
}
