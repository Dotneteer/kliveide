import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import {
  BIT_0_PL,
  BIT_1_PL,
  DATA_PILOT_COUNT,
  HEADER_PILOT_COUNT,
  PILOT_PL,
  SYNC_1_PL,
  SYNC_2_PL
} from "@common/structs/tape-const";
import { SpectrumTapeHeader } from "@emu/machines/tape/SpectrumTapeHeader";
import type { TzxBlockBase } from "@emu/machines/tape/TzxBlockBase";
import type { TzxStandardSpeedBlock } from "@emu/machines/tape/TzxStandardSpeedBlock";
import type { TzxTurboSpeedBlock } from "@emu/machines/tape/TzxTurboSpeedBlock";
import type { TzxPureToneBlock } from "@emu/machines/tape/TzxPureToneBlock";
import type { TzxPulseSequenceBlock } from "@emu/machines/tape/TzxPulseSequenceBlock";
import type { TzxPureBlock } from "@emu/machines/tape/TzxPureBlock";
import type { TzxDirectRecordingBlock } from "@emu/machines/tape/TzxDirectRecordingBlock";
import type { TzxCswRecordingBlock } from "@emu/machines/tape/TzxCswRecordingBlock";
import type { TzxGeneralizedBlock } from "@emu/machines/tape/TzxGeneralizedBlock";
import type { TzxSilenceBlock } from "@emu/machines/tape/TzxSilenceBlock";
import type { TzxGroupStartBlock } from "@emu/machines/tape/TzxGroupStartBlock";
import type { TzxTextDescriptionBlock } from "@emu/machines/tape/TzxTextDescriptionBlock";
import type { TzxMessageBlock } from "@emu/machines/tape/TzxMessageBlock";
import type { TzxArchiveInfoBlock } from "@emu/machines/tape/TzxArchiveInfoBlock";
import type { TzxHardwareInfoBlock } from "@emu/machines/tape/TzxHardwareInfoBlock";
import type { TzxCustomInfoBlock } from "@emu/machines/tape/TzxCustomInfoBlock";
import type { TzxLoopStartBlock } from "@emu/machines/tape/TzxLoopStartBlock";
import type { TzxJumpBlock } from "@emu/machines/tape/TzxJumpBlock";
import { readTapeFile } from "@renderer/utils/tape-utils";
import { zxText } from "./zxText";

/*
 * The tape viewer's model (`.plans/TAPE_VIEWER_PLAN.md` §4.2): what a `.tap` or `.tzx` file holds,
 * block by block, as plain data - no React, so every rule here is unit-tested on its own.
 *
 * Three things are worked out here that the file does not state:
 * - **files**: a standard header and the data block after it are one file (D2);
 * - **roles**: what that data is - BASIC, code, a screen, an array - read from its header;
 * - **timing**: how long each block plays, from its pulse lengths, for the play time and the
 *   timeline strip.
 */

/** The Spectrum's CPU clock: tape pulse lengths are counted in its T-states. */
const T_STATES_PER_MS = 3_500;

/** Where BASIC starts on a 48K machine with no microdrive: the usual value of PROG. */
export const DEFAULT_PROG_ADDRESS = 0x5ccb;

/** Where a screen dump starts, and how long one is. */
const SCREEN_ADDRESS = 0x4000;
const SCREEN_LENGTH = 6912;

export type TapeBlockKind =
  | "header"
  | "data"
  | "tone"
  | "pulses"
  | "pause"
  | "control"
  | "group"
  | "text"
  | "archive"
  | "hardware"
  | "other";

/** What a data block holds, from the header in front of it. */
export type TapeBlockRole = "basic" | "code" | "screen" | "numArray" | "charArray" | "headerless";

/** The ways a block pops out as its own document. */
export type TapeBlockView = "memory" | "disassembly" | "basic" | "screen";

export const TAPE_VIEW_NAMES: Record<TapeBlockView, string> = {
  memory: "Memory",
  disassembly: "Disassembly",
  basic: "BASIC",
  screen: "Screen"
};

/** A standard ROM header, decoded. */
export type TapeHeaderInfo = {
  type: number;
  typeName: string;
  /** The name for display: Spectrum characters, control codes spelled out (`zxText`) */
  name: string;
  dataLength: number;
  param1: number;
  param2: number;
  checksumOk: boolean;
  /** Program: the autostart line, or undefined for none (32768 and above) */
  autostart?: number;
  /** Program: the offset of the variables area, which is also the program's length */
  variablesOffset?: number;
  /** Code: the load address */
  startAddress?: number;
  /** Arrays: the array's name, `a()` or `a$()` */
  arrayName?: string;
};

export type TapeBlockTiming = {
  pilotPulse: number;
  pilotCount: number;
  sync1: number;
  sync2: number;
  bit0: number;
  bit1: number;
};

export type TapeArchiveField = { label: string; value: string };

export type TapeBlockInfo = {
  index: number;
  /** The TZX block id; undefined for a TAP block */
  blockId?: number;
  kind: TapeBlockKind;
  /** A short name for the block's kind: "Standard data", "Pure tone", ... */
  kindName: string;
  /** The chip on the block's row: a role (`BASIC`), `HDR`, or the TZX id (`$12`) */
  chip: string;
  /** The block's bytes as recorded - flag, payload and checksum for a ROM-format block */
  bytes?: Uint8Array;
  flag?: number;
  checksumOk?: boolean;
  /** Set on a header block */
  header?: TapeHeaderInfo;
  /** Set on a data block that follows a header: the header's block index */
  headerIndex?: number;
  role?: TapeBlockRole;
  /** The payload length disagrees with the header in front of it */
  lengthMismatch?: boolean;
  timing?: TapeBlockTiming;
  pauseMs: number;
  /** How long the block plays, pause included */
  durationMs: number;
  /** The duration is an estimate (recorded and generalized signal) */
  durationApprox?: boolean;
  /** The block makes sound on the tape (data, tones, pulses, a pause) */
  carriesSignal: boolean;
  /** Klive's tape player plays it; a block that carries signal but is not played loads wrong */
  playable: boolean;
  /** Text it carries: a description, a message, a group name, a custom block's id */
  text?: string;
  archive?: TapeArchiveField[];
  /** A short summary for the row: `LINE 10`, `$8000`, `1,000 ms`, ... */
  summary: string;
  /** The block's file group key and label; consecutive blocks with one key share a heading */
  groupKey: string;
  groupLabel: string;
};

export type TapeFile = {
  key: string;
  headerIndex: number;
  dataIndex?: number;
  label: string;
  role: TapeBlockRole;
};

export type TapeSummary = {
  format: "TAP" | "TZX";
  version?: string;
  size: number;
  blockCount: number;
  fileCount: number;
  roleCounts: Partial<Record<TapeBlockRole, number>>;
  durationMs: number;
  /** Some block's duration is an estimate */
  durationApprox: boolean;
  /** Blocks that carry signal Klive's player drops */
  unplayableCount: number;
  title?: string;
  publisher?: string;
  year?: string;
  authors?: string;
};

export type TapeAnalysis = {
  blocks: TapeBlockInfo[];
  files: TapeFile[];
  summary: TapeSummary;
};

const HEADER_TYPE_NAMES = ["Program", "Number array", "Character array", "Bytes"];

const ROLE_CHIPS: Record<TapeBlockRole, string> = {
  basic: "BASIC",
  code: "CODE",
  screen: "SCR$",
  numArray: "DATA",
  charArray: "DATA$",
  headerless: "DATA"
};

export const TAPE_ROLE_NAMES: Record<TapeBlockRole, string> = {
  basic: "BASIC program",
  code: "Code",
  screen: "Screen",
  numArray: "Number array",
  charArray: "Character array",
  headerless: "Headerless data"
};

const TZX_KIND_NAMES: Record<number, string> = {
  0x10: "Standard data",
  0x11: "Turbo data",
  0x12: "Pure tone",
  0x13: "Pulse sequence",
  0x14: "Pure data",
  0x15: "Direct recording",
  0x16: "C64 ROM data",
  0x17: "C64 turbo data",
  0x18: "CSW recording",
  0x19: "Generalized data",
  0x20: "Pause",
  0x21: "Group start",
  0x22: "Group end",
  0x23: "Jump",
  0x24: "Loop start",
  0x25: "Loop end",
  0x26: "Call sequence",
  0x27: "Return from sequence",
  0x28: "Select block",
  0x2a: "Stop if 48K",
  0x2b: "Set signal level",
  0x30: "Text description",
  0x31: "Message",
  0x32: "Archive info",
  0x33: "Hardware type",
  0x34: "Emulation info",
  0x35: "Custom info",
  0x40: "Snapshot",
  0x5a: "Glue"
};

const ARCHIVE_LABELS: Record<number, string> = {
  0x00: "Title",
  0x01: "Publisher",
  0x02: "Authors",
  0x03: "Year",
  0x04: "Language",
  0x05: "Type",
  0x06: "Price",
  0x07: "Loader",
  0x08: "Origin",
  0xff: "Comment"
};

/* --- The TZX blocks Klive's tape player turns into sound. `MainToEmuProcessor.setTapeFile` keeps
   --- only blocks with a `getDataBlock()`, and the WASM player treats a block with no data as a pause,
   --- so a pure tone ($12), which has none, is silently skipped too. */
const PLAYED_TZX_BLOCKS = new Set([0x10, 0x11, 0x20]);

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");

/** `true` when `data` is a standard 19-byte ROM header block (flag 0) */
export function isHeaderBlock(data: Uint8Array | undefined): boolean {
  return !!data && data.length === 19 && data[0] === 0x00;
}

/** XOR of every byte, the checksum included: zero for an intact ROM-format block */
function checksumOk(data: Uint8Array): boolean {
  let chk = 0;
  for (let i = 0; i < data.length; i++) chk ^= data[i];
  return chk === 0;
}

/** Decodes a header block's 19 bytes. */
export function parseTapeHeader(data: Uint8Array): TapeHeaderInfo {
  const header = new SpectrumTapeHeader(data);
  const type = header.type;
  const info: TapeHeaderInfo = {
    type,
    typeName: HEADER_TYPE_NAMES[type] ?? `Type ${type}`,
    name: zxText(header.nameBytes),
    dataLength: header.dataLength,
    param1: header.parameter1,
    param2: header.parameter2,
    checksumOk: header.checksumValid
  };
  switch (type) {
    case 0:
      info.autostart = header.parameter1 < 0x8000 ? header.parameter1 : undefined;
      info.variablesOffset = header.parameter2;
      break;
    case 1:
    case 2: {
      // --- The array's letter is in the high byte of parameter 1, as the ROM stores it in VARS
      const letter = String.fromCharCode(0x60 + ((header.parameter1 >> 8) & 0x1f));
      info.arrayName = `${letter}${type === 2 ? "$" : ""}()`;
      break;
    }
    case 3:
      info.startAddress = header.parameter1;
      break;
  }
  return info;
}

/** What a header says its data block is. */
export function roleOf(header: TapeHeaderInfo): TapeBlockRole {
  switch (header.type) {
    case 0:
      return "basic";
    case 1:
      return "numArray";
    case 2:
      return "charArray";
    default:
      return header.startAddress === SCREEN_ADDRESS && header.dataLength === SCREEN_LENGTH
        ? "screen"
        : "code";
  }
}

/** T-states to send the bits of `bytes`, with `lastBits` bits used in the last byte */
function bitTStates(bytes: ArrayLike<number>, bit0: number, bit1: number, lastBits = 8): number {
  let total = 0;
  for (let i = 0; i < bytes.length; i++) {
    const bits = i === bytes.length - 1 ? lastBits : 8;
    let value = bytes[i];
    for (let b = 0; b < bits; b++) {
      total += value & 0x80 ? 2 * bit1 : 2 * bit0;
      value <<= 1;
    }
  }
  return total;
}

function romBlockTStates(data: Uint8Array, timing: TapeBlockTiming, lastBits = 8): number {
  return (
    timing.pilotCount * timing.pilotPulse +
    timing.sync1 +
    timing.sync2 +
    bitTStates(data, timing.bit0, timing.bit1, lastBits)
  );
}

function standardTiming(data: Uint8Array): TapeBlockTiming {
  return {
    pilotPulse: PILOT_PL,
    pilotCount: data.length > 0 && data[0] < 0x80 ? HEADER_PILOT_COUNT : DATA_PILOT_COUNT,
    sync1: SYNC_1_PL,
    sync2: SYNC_2_PL,
    bit0: BIT_0_PL,
    bit1: BIT_1_PL
  };
}

/** The play time of a generalized ($19) block, decoded from its symbol tables */
function generalizedTStates(block: TzxGeneralizedBlock): number {
  const symbolLength = (pulses: number[] | undefined) =>
    (pulses ?? []).reduce((sum, p) => sum + p, 0);
  let total = 0;
  for (const prle of block.pilotStream ?? []) {
    total += prle.repetitions * symbolLength(block.pilotSymDef?.[prle.symbol]?.pulseLengths);
  }
  const symbols = block.dataSymDef ?? [];
  if (block.totd > 0 && symbols.length > 0) {
    const bitsPerSymbol = Math.max(1, Math.ceil(Math.log2(symbols.length)));
    const bytes = block.dataBytes ?? new Uint8Array(0);
    for (let s = 0; s < block.totd; s++) {
      let symbol = 0;
      for (let b = 0; b < bitsPerSymbol; b++) {
        const bit = s * bitsPerSymbol + b;
        const byte = bytes[bit >> 3] ?? 0;
        symbol = (symbol << 1) | ((byte >> (7 - (bit & 7))) & 1);
      }
      total += symbolLength(symbols[symbol]?.pulseLengths);
    }
  }
  return total;
}

/** The play time of a CSW ($18) block: RLE samples over the sample rate; Z-RLE is not unpacked */
function cswMs(block: TzxCswRecordingBlock): number {
  const rate =
    (block.samplingRate?.[0] ?? 0) |
    ((block.samplingRate?.[1] ?? 0) << 8) |
    ((block.samplingRate?.[2] ?? 0) << 16);
  if (!rate) return 0;
  if (block.compressionType !== 1) {
    // --- Z-RLE: not unpacked here; assume one sample per pulse as a lower bound
    return (block.pulseCount / rate) * 1000;
  }
  const data = block.data ?? new Uint8Array(0);
  let samples = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0 && i + 4 < data.length) {
      samples += data[i + 1] | (data[i + 2] << 8) | (data[i + 3] << 16) | (data[i + 4] << 24);
      i += 4;
    } else {
      samples += data[i];
    }
  }
  return (samples / rate) * 1000;
}

type BlockBase = Omit<TapeBlockInfo, "summary" | "groupKey" | "groupLabel" | "chip"> & {
  chip?: string;
};

function describeTapBlock(index: number, block: TapeDataBlock): BlockBase {
  const data = block.data;
  const timing = standardTiming(data);
  const header = isHeaderBlock(data) ? parseTapeHeader(data) : undefined;
  return {
    index,
    kind: header ? "header" : "data",
    kindName: header ? "Header" : "Data",
    bytes: data,
    flag: data[0],
    checksumOk: data.length > 0 ? checksumOk(data) : undefined,
    header,
    timing,
    pauseMs: block.pauseAfter,
    durationMs: romBlockTStates(data, timing) / T_STATES_PER_MS + block.pauseAfter,
    carriesSignal: true,
    playable: true
  };
}

function describeTzxBlock(index: number, block: TzxBlockBase): BlockBase {
  const blockId = block.blockId;
  const base: BlockBase = {
    index,
    blockId,
    kind: "other",
    kindName: TZX_KIND_NAMES[blockId] ?? `Block $${hex2(blockId)}`,
    chip: `$${hex2(blockId)}`,
    pauseMs: 0,
    durationMs: 0,
    carriesSignal: false,
    playable: PLAYED_TZX_BLOCKS.has(blockId)
  };
  const withData = (data: Uint8Array, kind: TapeBlockKind = "data"): BlockBase => {
    const header = kind === "data" && isHeaderBlock(data) ? parseTapeHeader(data) : undefined;
    return {
      ...base,
      kind: header ? "header" : kind,
      bytes: data,
      flag: data[0],
      checksumOk: data.length > 0 ? checksumOk(data) : undefined,
      header,
      carriesSignal: true
    };
  };

  switch (blockId) {
    case 0x10: {
      const b = block as TzxStandardSpeedBlock;
      const timing = standardTiming(b.data);
      return {
        ...withData(b.data),
        timing,
        pauseMs: b.pauseAfter,
        durationMs: romBlockTStates(b.data, timing) / T_STATES_PER_MS + b.pauseAfter
      };
    }
    case 0x11: {
      const b = block as TzxTurboSpeedBlock;
      const data = new Uint8Array(b.data ?? []);
      const timing: TapeBlockTiming = {
        pilotPulse: b.pilotPulseLength,
        pilotCount: b.pilotToneLength,
        sync1: b.sync1PulseLength,
        sync2: b.sync2PulseLength,
        bit0: b.zeroBitPulseLength,
        bit1: b.oneBitPulseLength
      };
      return {
        ...withData(data),
        timing,
        pauseMs: b.pauseAfter,
        durationMs:
          romBlockTStates(data, timing, b.lastByteUsedBits || 8) / T_STATES_PER_MS + b.pauseAfter
      };
    }
    case 0x12: {
      const b = block as TzxPureToneBlock;
      return {
        ...base,
        kind: "tone",
        carriesSignal: true,
        durationMs: (b.pulseLength * b.pulseCount) / T_STATES_PER_MS,
        text: `${b.pulseCount.toLocaleString("en-US")} × ${b.pulseLength.toLocaleString("en-US")}T`
      };
    }
    case 0x13: {
      const b = block as TzxPulseSequenceBlock;
      const total = (b.pulseLengths ?? []).reduce((sum, p) => sum + p, 0);
      return {
        ...base,
        kind: "pulses",
        carriesSignal: true,
        durationMs: total / T_STATES_PER_MS,
        text: `${b.pulseCount} pulses`
      };
    }
    case 0x14: {
      const b = block as TzxPureBlock;
      const data = new Uint8Array(b.data ?? []);
      return {
        ...withData(data),
        pauseMs: b.pauseAfter,
        durationMs:
          bitTStates(data, b.zeroBitPulseLength, b.oneBitPulseLength, b.lastByteUsedBits || 8) /
            T_STATES_PER_MS +
          b.pauseAfter
      };
    }
    case 0x15: {
      const b = block as TzxDirectRecordingBlock;
      const length = b.data?.length ?? 0;
      const bits = length > 0 ? (length - 1) * 8 + (b.lastByteUsedBits || 8) : 0;
      return {
        ...base,
        kind: "data",
        carriesSignal: true,
        pauseMs: b.pauseAfter,
        durationMs: (bits * b.tactsPerSample) / T_STATES_PER_MS + b.pauseAfter,
        durationApprox: true,
        text: `${b.tactsPerSample}T per sample`
      };
    }
    case 0x18: {
      const b = block as TzxCswRecordingBlock;
      return {
        ...base,
        kind: "data",
        carriesSignal: true,
        pauseMs: b.pauseAfter,
        durationMs: cswMs(b) + b.pauseAfter,
        durationApprox: true,
        text: `${b.pulseCount.toLocaleString("en-US")} pulses`
      };
    }
    case 0x19: {
      const b = block as TzxGeneralizedBlock;
      return {
        ...base,
        kind: "data",
        carriesSignal: true,
        pauseMs: b.pauseAfter,
        durationMs: generalizedTStates(b) / T_STATES_PER_MS + b.pauseAfter,
        durationApprox: true,
        text: `${b.totd.toLocaleString("en-US")} symbols`
      };
    }
    case 0x20: {
      const b = block as TzxSilenceBlock;
      return {
        ...base,
        kind: b.duration === 0 ? "control" : "pause",
        kindName: b.duration === 0 ? "Stop the tape" : "Pause",
        carriesSignal: b.duration > 0,
        pauseMs: b.duration,
        durationMs: b.duration
      };
    }
    case 0x21:
      return { ...base, kind: "group", text: (block as TzxGroupStartBlock).groupName };
    case 0x22:
      return { ...base, kind: "group" };
    case 0x23:
      return { ...base, kind: "control", text: `by ${(block as TzxJumpBlock).jump}` };
    case 0x24:
      return { ...base, kind: "control", text: `${(block as TzxLoopStartBlock).loops} times` };
    case 0x25:
    case 0x26:
    case 0x27:
    case 0x28:
    case 0x2a:
    case 0x2b:
      return { ...base, kind: "control" };
    case 0x30:
      return { ...base, kind: "text", text: (block as TzxTextDescriptionBlock).descriptionText };
    case 0x31:
      return { ...base, kind: "text", text: (block as TzxMessageBlock).messageText };
    case 0x32: {
      const b = block as TzxArchiveInfoBlock;
      return {
        ...base,
        kind: "archive",
        archive: (b.textStrings ?? []).map((t) => ({
          label: ARCHIVE_LABELS[t.type] ?? `Field $${hex2(t.type)}`,
          value: t.text.replace(/\r\n?/g, "\n")
        }))
      };
    }
    case 0x33:
      return {
        ...base,
        kind: "hardware",
        text: `${(block as TzxHardwareInfoBlock).hwCount} entr${
          (block as TzxHardwareInfoBlock).hwCount === 1 ? "y" : "ies"
        }`
      };
    case 0x35:
      return { ...base, kind: "text", text: (block as TzxCustomInfoBlock).idText?.trim() };
    default:
      return base;
  }
}

function formatMs(ms: number): string {
  return `${Math.round(ms).toLocaleString("en-US")} ms`;
}

/**
 * Analyses a tape file.
 * @returns The analysis, or the reader's reason for rejecting the file
 */
export function analyzeTape(contents: Uint8Array): { analysis?: TapeAnalysis; error?: string } {
  const read = readTapeFile(contents);
  if (!read.data) {
    return { error: read.error ?? "This file could not be read as a .tap or .tzx tape." };
  }
  const isTap = read.type === "tap";
  const described: BlockBase[] = read.data.map((block, index) =>
    isTap
      ? describeTapBlock(index, block as TapeDataBlock)
      : describeTzxBlock(index, block as TzxBlockBase)
  );

  // --- Pair every header with the next data block, skipping the blocks between that carry no
  // --- bytes (a pause, a text block). A header followed directly by another header has no data.
  const files: TapeFile[] = [];
  for (let i = 0; i < described.length; i++) {
    const block = described[i];
    if (block.kind !== "header" || !block.header) continue;
    let dataIndex: number | undefined;
    for (let j = i + 1; j < described.length; j++) {
      const next = described[j];
      if (next.kind === "header") break;
      if (next.bytes && next.kind === "data") {
        dataIndex = j;
        break;
      }
      if (next.carriesSignal && next.kind !== "pause") break;
    }
    const role = roleOf(block.header);
    const label = `${block.header.typeName} "${block.header.name}"`;
    const file: TapeFile = { key: `file:${i}`, headerIndex: i, dataIndex, label, role };
    files.push(file);
    if (dataIndex !== undefined) {
      const data = described[dataIndex];
      data.headerIndex = i;
      data.role = role;
      data.lengthMismatch = (data.bytes?.length ?? 0) - 2 !== block.header.dataLength;
    }
  }

  // --- Data that no header claimed
  for (const block of described) {
    if (block.kind === "data" && block.bytes && block.role === undefined) {
      block.role = "headerless";
    }
  }

  // --- Groups: a file's header, its data and the pauses after it; runs of metadata; the rest by
  // --- the TZX group they sit in, or as headerless.
  const fileOf = new Map<number, TapeFile>();
  for (const file of files) {
    fileOf.set(file.headerIndex, file);
    if (file.dataIndex !== undefined) fileOf.set(file.dataIndex, file);
  }
  let tzxGroup: { key: string; name: string } | undefined;
  let previous: { key: string; label: string } | undefined;
  const blocks: TapeBlockInfo[] = described.map((block) => {
    let groupKey: string;
    let groupLabel: string;
    const file = fileOf.get(block.index);
    if (block.blockId === 0x21) {
      tzxGroup = { key: `group:${block.index}`, name: block.text ?? "" };
    }
    if (file) {
      groupKey = file.key;
      groupLabel = file.label;
    } else if (block.kind === "text" || block.kind === "archive" || block.kind === "hardware") {
      groupLabel = "Metadata";
      groupKey = previous?.label === groupLabel ? previous.key : `meta:${block.index}`;
    } else if ((block.kind === "pause" || block.kind === "control") && previous) {
      groupKey = previous.key;
      groupLabel = previous.label;
    } else if (tzxGroup) {
      groupKey = tzxGroup.key;
      groupLabel = `Group "${tzxGroup.name}"`;
    } else {
      groupKey = previous?.label === "Headerless" ? previous.key : `headerless:${block.index}`;
      groupLabel = "Headerless";
    }
    if (block.blockId === 0x22) tzxGroup = undefined;
    previous = { key: groupKey, label: groupLabel };

    return {
      ...block,
      chip: chipOf(block),
      summary: summaryOf(block),
      groupKey,
      groupLabel
    };
  });

  return { analysis: { blocks, files, summary: summarize(read, contents, blocks, files) } };
}

function chipOf(block: BlockBase): string {
  if (block.kind === "header") return "HDR";
  if (block.role && block.role !== "headerless") return ROLE_CHIPS[block.role];
  return block.chip ?? "DATA";
}

function summaryOf(block: BlockBase): string {
  if (block.header) return `${block.header.typeName} header`;
  switch (block.role) {
    case "basic":
      return block.headerIndex !== undefined ? "Program" : "";
    case "code":
    case "screen":
      return "";
    case "numArray":
    case "charArray":
      return "Array";
  }
  if (block.kind === "pause") return formatMs(block.pauseMs);
  if (block.text) return block.text;
  if (block.archive) return `${block.archive.length} field${block.archive.length === 1 ? "" : "s"}`;
  return block.role === "headerless" ? "Headerless" : "";
}

function summarize(
  read: ReturnType<typeof readTapeFile>,
  contents: Uint8Array,
  blocks: TapeBlockInfo[],
  files: TapeFile[]
): TapeSummary {
  const roleCounts: Partial<Record<TapeBlockRole, number>> = {};
  for (const file of files) roleCounts[file.role] = (roleCounts[file.role] ?? 0) + 1;
  const archive = blocks.find((b) => b.archive)?.archive ?? [];
  const field = (label: string) => archive.find((f) => f.label === label)?.value;
  return {
    format: read.type === "tap" ? "TAP" : "TZX",
    version: read.version,
    size: contents.length,
    blockCount: blocks.length,
    fileCount: files.length,
    roleCounts,
    durationMs: blocks.reduce((sum, b) => sum + b.durationMs, 0),
    durationApprox: blocks.some((b) => b.durationApprox),
    unplayableCount: blocks.filter((b) => b.carriesSignal && !b.playable).length,
    title: field("Title"),
    publisher: field("Publisher"),
    year: field("Year"),
    authors: field("Authors")
  };
}

/** `m:ss`, the way a cassette counter would show it */
export function formatPlayTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Each block's start time on the tape, in ms */
export function blockStartTimes(blocks: TapeBlockInfo[]): number[] {
  let at = 0;
  return blocks.map((b) => {
    const start = at;
    at += b.durationMs;
    return start;
  });
}

// ─── Payloads ────────────────────────────────────────────────────────────────

/**
 * The bytes a block loads into memory: the recorded bytes without the flag and checksum the ROM
 * format puts around them. A block too short to have both is returned whole.
 */
export function blockPayload(block: TapeBlockInfo): Uint8Array | undefined {
  const bytes = block.bytes;
  if (!bytes) return undefined;
  return bytes.length >= 2 ? bytes.subarray(1, bytes.length - 1) : bytes;
}

/**
 * The address a block's payload is listed at. Code loads where its header says; BASIC at the usual
 * PROG; anything else at `fallback` (the viewer's "Disassemble from..." value, default 0).
 */
export function blockLoadAddress(
  block: TapeBlockInfo,
  header?: TapeHeaderInfo,
  fallback = 0
): number {
  if (block.role === "code" || block.role === "screen") return header?.startAddress ?? fallback;
  if (block.role === "basic") return DEFAULT_PROG_ADDRESS;
  return fallback;
}

/** The views a block can pop out in */
export function tapeBlockViews(block: TapeBlockInfo): TapeBlockView[] {
  // --- A header's nineteen bytes are all in its details already; there is nothing to pop out
  if (!block.bytes || block.kind === "header") return [];
  const views: TapeBlockView[] = ["memory", "disassembly"];
  if (block.role === "basic") views.push("basic");
  if (block.role === "screen" || (blockPayload(block)?.length ?? 0) === SCREEN_LENGTH) {
    views.push("screen");
  }
  return views;
}

/** The view a block pops out in before the user picks one */
export function defaultTapeBlockView(block: TapeBlockInfo): TapeBlockView {
  switch (block.role) {
    case "basic":
      return "basic";
    case "screen":
      return "screen";
    case "code":
      return "disassembly";
    default:
      return "memory";
  }
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export type TapeBlockFilter = "all" | "data" | "basic" | "code" | "notPlayed";

export const TAPE_BLOCK_FILTERS: { value: TapeBlockFilter; text: string }[] = [
  { value: "all", text: "All" },
  { value: "data", text: "Data" },
  { value: "basic", text: "BASIC" },
  { value: "code", text: "Code" },
  { value: "notPlayed", text: "Not played" }
];

export function filterTapeBlocks<T extends { block: TapeBlockInfo }>(
  items: T[],
  filter: string
): T[] {
  switch (filter) {
    case "data":
      return items.filter((i) => !!i.block.bytes);
    case "basic":
      return items.filter((i) => i.block.role === "basic");
    case "code":
      return items.filter((i) => i.block.role === "code" || i.block.role === "screen");
    case "notPlayed":
      return items.filter((i) => i.block.carriesSignal && !i.block.playable);
    default:
      return items;
  }
}

// ─── Timeline ────────────────────────────────────────────────────────────────

/** The colour role of a timeline segment */
export type TapeSegmentTone =
  "header" | "basic" | "code" | "data" | "tone" | "pause" | "unplayable" | "merged";

export type TapeTimelineSegment = {
  /** The first and last block index the segment covers (equal unless merged) */
  first: number;
  last: number;
  x: number;
  width: number;
  tone: TapeSegmentTone;
};

export type TapeTimelineOptions = {
  /** The narrowest a block is drawn, so short blocks stay visible */
  minWidth?: number;
  /** Above this many signal blocks, blocks narrower than one pixel merge into runs */
  mergeAbove?: number;
};

function toneOf(block: TapeBlockInfo): TapeSegmentTone {
  if (block.carriesSignal && !block.playable) return "unplayable";
  if (block.kind === "header") return "header";
  if (block.role === "basic") return "basic";
  if (block.role === "code" || block.role === "screen") return "code";
  if (block.kind === "tone" || block.kind === "pulses") return "tone";
  if (block.kind === "pause") return "pause";
  return "data";
}

/**
 * The timeline strip's segments (§4.4.1): one per block that carries signal, as wide as its share of
 * the play time, but never narrower than `minWidth` - the width that takes is taken from the widest
 * segments. Blocks that carry no signal (text, archive, control) get no segment.
 * @param blocks The tape's blocks
 * @param width The strip's width in pixels
 */
export function tapeTimeline(
  blocks: TapeBlockInfo[],
  width: number,
  { minWidth = 2, mergeAbove = 500 }: TapeTimelineOptions = {}
): TapeTimelineSegment[] {
  const signal = blocks.filter((b) => b.carriesSignal);
  if (signal.length === 0 || width <= 0) return [];
  const total = signal.reduce((sum, b) => sum + Math.max(b.durationMs, 0), 0);
  const rawOf = (ms: number) =>
    total > 0 ? (Math.max(ms, 0) / total) * width : width / signal.length;

  // --- Runs: one block each, or merged runs of sub-pixel blocks on a long tape
  type Run = { first: number; last: number; raw: number; tone: TapeSegmentTone };
  const runs: Run[] = [];
  const merge = signal.length > mergeAbove;
  // --- A run of sub-pixel blocks still being gathered; it closes once it is a pixel wide
  let pending: Run | undefined;
  const flush = () => {
    if (pending) runs.push(pending);
    pending = undefined;
  };
  for (const block of signal) {
    const raw = rawOf(block.durationMs);
    if (!merge || raw >= 1) {
      flush();
      runs.push({ first: block.index, last: block.index, raw, tone: toneOf(block) });
      continue;
    }
    if (pending) {
      pending.last = block.index;
      pending.raw += raw;
      pending.tone = "merged";
    } else {
      pending = { first: block.index, last: block.index, raw, tone: toneOf(block) };
    }
    if (pending.raw >= 1) flush();
  }
  flush();

  // --- The minimum width, paid for by the segments wide enough to give it up
  const small = runs.filter((r) => r.raw < minWidth);
  const large = runs.filter((r) => r.raw >= minWidth);
  const fixed = small.length * minWidth;
  const largeRaw = large.reduce((sum, r) => sum + r.raw, 0);
  const remaining = width - fixed;
  const widthOf =
    remaining <= 0 || largeRaw === 0
      ? () => width / runs.length
      : (r: Run) => (r.raw < minWidth ? minWidth : (r.raw / largeRaw) * remaining);

  let x = 0;
  return runs.map((run) => {
    const w = widthOf(run);
    const segment = { first: run.first, last: run.last, x, width: w, tone: run.tone };
    x += w;
    return segment;
  });
}

/** The segment covering block `index`, if it has one */
export function segmentOfBlock(
  segments: TapeTimelineSegment[],
  index: number
): TapeTimelineSegment | undefined {
  return segments.find((s) => index >= s.first && index <= s.last);
}

export { hex4 as tapeHex4, hex2 as tapeHex2 };
