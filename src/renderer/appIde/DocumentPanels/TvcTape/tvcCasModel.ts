import { TVC_PROGRAM_START } from "@common/tvc/codePlacement";
import {
  buildTvcTapeProgram,
  TVC_CAS_HEADER_LENGTH,
  tvcCasPayloadLength,
  tvcTapeNameOf,
  tvcTapeProgramTacts
} from "@emu/machines/tvc/TvcCasFile";

/*
 * The Videoton TVC `.cas` viewer's model: the container taken apart into the parts the viewer lists
 * (`TvcCasFile.ts` documents the format). No React and no texts, so it is tested on the bytes alone.
 *
 * The parts: the 128-byte file header (the identifier and the record counts), the 16-byte application
 * header (the file type, the payload's length, the autostart flag), the payload and whatever follows
 * it. A program file's payload is loaded at 19EFh, where BASIC keeps its program: when its start reads
 * as BASIC lines (a length, a line number, the text and FFh, up to a 00h length), it is split into the
 * program and the bytes after it - the machine code a launcher line calls, as Klive's own export
 * writes it.
 */

/** The TVC's CPU clock: play times are counted at it */
export const TVC_TAPE_CLOCK = 3_125_000;
/** BASIC's SAVE writes this file type */
export const TVC_PROGRAM_FILE_TYPE = 0x01;

export type TvcCasPartRole = "fileHeader" | "appHeader" | "basicProgram" | "afterProgram" | "payload" | "trailing";

export type TvcCasPartProblem = "truncated";

/** One line of a TVC BASIC program, as stored */
export type TvcBasicLine = {
  /** Where the line starts in the payload (its length byte) */
  offset: number;
  lineNo: number;
  /** Bytes in all: the length byte, the number, the text and FFh */
  length: number;
};

export type TvcCasPart = {
  index: number;
  role: TvcCasPartRole;
  bytes: Uint8Array;
  /** Where the part starts in the file */
  offset: number;
  /** What it loads, `[from, to)` */
  loadFrom?: number;
  loadTo?: number;
  problem?: TvcCasPartProblem;
};

export type TvcCasAnalysis = {
  /** The file's size in bytes */
  size: number;
  /** The name the tape's header gets: the file name's stem */
  name: string;
  fileType: number;
  autostart: boolean;
  /** The payload's length as the record counts give it, and as the application header does */
  recordLength: number;
  headerLength: number;
  /** The payload's bytes in the file (fewer than declared when the file is cut off) */
  payload: Uint8Array;
  /** A BASIC program's lines at the start of the payload, and the bytes they take with the closing 00h */
  lines?: TvcBasicLine[];
  programBytes?: number;
  /** The record counts disagree with the application header, and Klive goes by the header */
  recordCountsWrong: boolean;
  /** How long the tape Klive plays of it lasts, in milliseconds */
  playMs: number;
  parts: TvcCasPart[];
  hasProblems: boolean;
};

export type TvcCasViewResult = { analysis?: TvcCasAnalysis; error?: "notTvcCas" };

/**
 * Takes a TVC `.cas` apart
 * @param bytes The file
 * @param fileName Its name: the tape's name is made from it, as when the file is loaded
 */
export function analyzeTvcCas(bytes: Uint8Array, fileName: string): TvcCasViewResult {
  if (bytes.length < TVC_CAS_HEADER_LENGTH || bytes[0] !== 0x11) return { error: "notTvcCas" };
  const recordTotal = (bytes[2] | (bytes[3] << 8)) * 128 + (bytes[4] | (bytes[5] << 8));
  const recordLength = Math.max(0, recordTotal - TVC_CAS_HEADER_LENGTH);
  const headerLength = bytes[0x82] | (bytes[0x83] << 8);
  const usable = tvcCasPayloadLength(bytes);
  // --- A cut-off file: as many bytes as there are, of the length the header declares
  const declared = usable ?? (headerLength || recordLength);
  const truncated = usable === undefined;
  const payload = bytes.subarray(TVC_CAS_HEADER_LENGTH, Math.min(bytes.length, TVC_CAS_HEADER_LENGTH + declared));
  const fileType = bytes[0x81];
  const autostart = bytes[0x84] !== 0;

  const parts: TvcCasPart[] = [];
  const push = (part: Omit<TvcCasPart, "index">) => parts.push({ ...part, index: parts.length });
  push({ role: "fileHeader", bytes: bytes.subarray(0, 0x80), offset: 0 });
  push({ role: "appHeader", bytes: bytes.subarray(0x80, TVC_CAS_HEADER_LENGTH), offset: 0x80 });

  const program = fileType === TVC_PROGRAM_FILE_TYPE && !truncated ? programLines(payload) : undefined;
  if (program && program.lines.length) {
    push({
      role: "basicProgram",
      bytes: payload.subarray(0, program.bytes),
      offset: TVC_CAS_HEADER_LENGTH,
      loadFrom: TVC_PROGRAM_START,
      loadTo: TVC_PROGRAM_START + program.bytes
    });
    if (program.bytes < payload.length) {
      push({
        role: "afterProgram",
        bytes: payload.subarray(program.bytes),
        offset: TVC_CAS_HEADER_LENGTH + program.bytes,
        loadFrom: TVC_PROGRAM_START + program.bytes,
        loadTo: TVC_PROGRAM_START + payload.length
      });
    }
  } else if (payload.length || truncated) {
    push({
      role: "payload",
      bytes: payload,
      offset: TVC_CAS_HEADER_LENGTH,
      loadFrom: TVC_PROGRAM_START,
      loadTo: TVC_PROGRAM_START + payload.length,
      ...(truncated ? { problem: "truncated" as const } : {})
    });
  }
  const end = TVC_CAS_HEADER_LENGTH + payload.length;
  if (end < bytes.length) push({ role: "trailing", bytes: bytes.subarray(end), offset: end });

  let playMs = 0;
  if (!truncated) {
    const name = tvcTapeNameOf(fileName);
    playMs = (tvcTapeProgramTacts(buildTvcTapeProgram(name, fileType, autostart, payload)) * 1000) / TVC_TAPE_CLOCK;
  }

  return {
    analysis: {
      size: bytes.length,
      name: tvcTapeNameOf(fileName),
      fileType,
      autostart,
      recordLength,
      headerLength,
      payload,
      lines: program?.lines.length ? program.lines : undefined,
      programBytes: program?.lines.length ? program.bytes : undefined,
      recordCountsWrong: !truncated && usable !== recordLength,
      playMs,
      parts,
      hasProblems: parts.some((p) => !!p.problem)
    }
  };
}

/**
 * The BASIC lines at the start of a payload: each a length (with itself and FFh), a line number, the
 * text and FFh; a 00h length ends the program
 * @returns the lines and the bytes they take with the 00h, or undefined when the bytes are not a program
 */
export function programLines(payload: Uint8Array): { lines: TvcBasicLine[]; bytes: number } | undefined {
  const lines: TvcBasicLine[] = [];
  let pos = 0;
  while (pos < payload.length) {
    const length = payload[pos];
    if (length === 0) return lines.length ? { lines, bytes: pos + 1 } : undefined;
    if (length < 4 || pos + length > payload.length || payload[pos + length - 1] !== 0xff) return undefined;
    lines.push({ offset: pos, lineNo: payload[pos + 1] | (payload[pos + 2] << 8), length });
    pos += length;
  }
  return undefined;
}
