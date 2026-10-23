import {
  basToBasicTape,
  byteAtBit,
  cmdToSystemTape,
  findSync,
  HT1080Z_BASIC_HEADER,
  HT1080Z_SYSTEM_BLOCK,
  HT1080Z_SYSTEM_ENTRY,
  HT1080Z_SYSTEM_HEADER
} from "@emu/machines/ht1080z/Ht1080zTapeFile";
import { HT1080Z_PROGRAM_START } from "@common/ht1080z/codePlacement";

/*
 * The HT-1080Z tape file viewer's model (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D4): a `.cas`, `.cmd` or
 * tokenised `.bas` taken apart into the parts the viewer lists - where each starts, its bytes, what it
 * loads where, its checksum and when it plays. No React and no texts: the field explanations are
 * worded at display time (`ht1080zTapeFields.ts`), so this is tested on the bytes alone.
 *
 * Play times follow the core's tape player (`ht1080z-tape.c`): a 1 bit is a 3,557 T-state cell, a 0 bit
 * 3,570, and after the sync byte the ROM waits 1,774 T-states. A `.cas` plays as its bits are; a `.cmd`
 * or `.bas` as the tape Klive makes of it when it loads it.
 */

/** The tape player's cells and the silence after the sync, in T-states (`ht1080z-tape.c`) */
export const HT1080Z_CELL_ONE = 3557;
export const HT1080Z_CELL_ZERO = 3570;
export const HT1080Z_SYNC_GAP = 1774;
/** The Series I/II clock, which the times default to */
export const HT1080Z_TAPE_CLOCK = 1_774_000;

export type Ht1080zFileKind = "basicTape" | "systemTape" | "cmd" | "bas";

export type Ht1080zPartRole =
  // --- Any tape
  | "leader"
  | "sync"
  // --- A BASIC (CLOAD) tape
  | "basicHeader"
  | "basicProgram"
  | "programEnd"
  // --- A machine-code (SYSTEM) tape
  | "systemHeader"
  | "systemBlock"
  | "systemEntry"
  // --- A .cmd load module
  | "cmdHeader"
  | "cmdLoad"
  | "cmdTransfer"
  | "cmdOther"
  // --- A tokenised .bas
  | "basLine"
  // --- Bytes after the last part, or a part that could not be read
  | "trailing";

/** What is wrong with a part, when something is */
export type Ht1080zPartProblem = "truncated" | "checksum" | "badRecord";

/** One line of a BASIC program, as stored */
export type Ht1080zBasicLine = {
  /** Where the line starts in the program's bytes (the link's first byte) */
  offset: number;
  /** The address it occupies once CLOAD has put the program at 42E9h */
  address: number;
  /** The link as saved: the next line's address on the machine that saved it */
  link: number;
  lineNo: number;
  /** The tokenised text, without the link, the number and the closing 00h */
  text: Uint8Array;
  /** Bytes in all: link, number, text and 00h */
  length: number;
};

export type Ht1080zPart = {
  index: number;
  role: Ht1080zPartRole;
  /** The part's bytes, as read (a `.cas`'s bytes are read from the bit stream past the sync) */
  bytes: Uint8Array;
  /** Where the part starts: a byte offset in the file, or - on a `.cas` past the sync - in the stream */
  offset: number;
  /** When it plays, in milliseconds from the start of the tape (a `.cas` only) */
  startMs?: number;
  endMs?: number;
  /** What it loads, `[from, to)`, and the start address a SYSTEM tape or `.cmd` names */
  loadFrom?: number;
  loadTo?: number;
  entry?: number;
  /** The checksum a SYSTEM block carries, and the one its bytes give */
  checksum?: { stored: number; computed: number };
  /** The name a header or a `.cmd` module record holds */
  name?: string;
  /** A `.cmd` record's type */
  recordType?: number;
  /** A program line (a `.bas` line, or each line of a tape's program) */
  line?: Ht1080zBasicLine;
  problem?: Ht1080zPartProblem;
};

export type Ht1080zTapeAnalysis = {
  kind: Ht1080zFileKind;
  /** The file's size in bytes */
  size: number;
  parts: Ht1080zPart[];
  /** The program's or the module's name */
  name?: string;
  /** A BASIC program's lines (a BASIC tape or a `.bas`) */
  lines?: Ht1080zBasicLine[];
  /** Bytes of code a SYSTEM tape or `.cmd` loads, and where it starts */
  codeBytes?: number;
  entry?: number;
  /** The highest address loaded (exclusive), for the 16K/48K check */
  loadTop?: number;
  /** How long the file plays: a `.cas` as it is, a `.cmd` or `.bas` as the tape Klive makes of it */
  playMs: number;
  /** Whether any part has a problem */
  hasProblems: boolean;
};

export type Ht1080zTapeViewResult = { analysis?: Ht1080zTapeAnalysis; error?: "unknownFile" | "noHeader" | "highSpeed" | "notTokenised" };

/** Milliseconds per T-state at the clock */
const msOf = (tacts: number, clock: number) => (tacts * 1000) / clock;

/** The cells a byte's bits take, MSB first */
function byteTacts(value: number): number {
  let tacts = 0;
  for (let bit = 7; bit >= 0; bit--) tacts += (value >> bit) & 1 ? HT1080Z_CELL_ONE : HT1080Z_CELL_ZERO;
  return tacts;
}

/**
 * Takes an HT-1080Z tape file apart
 * @param bytes The file
 * @param fileName Its name: the extension says which kind it is
 * @param clock The CPU clock the times are counted at (the /64's is 1,777,417 Hz)
 */
export function analyzeHt1080zFile(bytes: Uint8Array, fileName: string, clock = HT1080Z_TAPE_CLOCK): Ht1080zTapeViewResult {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".cas")) return analyzeCas(bytes, clock);
  if (lower.endsWith(".cmd")) return analyzeCmd(bytes, clock);
  if (lower.endsWith(".bas")) return analyzeBas(bytes, clock);
  return { error: "unknownFile" };
}

// =================================================================================================
// .cas

function analyzeCas(file: Uint8Array, clock: number): Ht1080zTapeViewResult {
  const sync = findSync(file);
  if (sync === "high") return { error: "highSpeed" };
  if (sync === undefined) return { error: "noHeader" };
  const streamBytes = Math.max(0, Math.floor((file.length * 8 - sync) / 8));
  const at = (n: number) => byteAtBit(file, sync + n * 8);
  const slice = (from: number, to: number) => {
    const out = new Uint8Array(Math.max(0, Math.min(to, streamBytes) - from));
    for (let i = 0; i < out.length; i++) out[i] = at(from + i);
    return out;
  };

  // --- The leader and the sync, timed by their real bits
  const parts: Ht1080zPart[] = [];
  const leaderBits = sync - 8;
  let tacts = 0;
  for (let bit = 0; bit < leaderBits; bit++) {
    tacts += (file[bit >> 3] >> (7 - (bit & 7))) & 1 ? HT1080Z_CELL_ONE : HT1080Z_CELL_ZERO;
  }
  const leader = file.subarray(0, Math.floor(leaderBits / 8));
  const push = (part: Omit<Ht1080zPart, "index" | "startMs" | "endMs">, extraTacts = 0) => {
    const start = tacts;
    for (const b of part.bytes) tacts += byteTacts(b);
    tacts += extraTacts;
    parts.push({ ...part, index: parts.length, startMs: msOf(start, clock), endMs: msOf(tacts, clock) });
  };
  parts.push({ index: 0, role: "leader", bytes: leader, offset: 0, startMs: 0, endMs: msOf(tacts, clock) });
  push({ role: "sync", bytes: new Uint8Array([0xa5]), offset: leader.length }, HT1080Z_SYNC_GAP);

  const base: Omit<Ht1080zTapeAnalysis, "kind" | "parts" | "playMs" | "hasProblems"> = { size: file.length };
  let kind: Ht1080zFileKind;
  let pos = 0;
  const truncated = (role: Ht1080zPartRole, from: number) =>
    push({ role, bytes: slice(from, streamBytes), offset: from, problem: "truncated" });

  if (at(0) === HT1080Z_BASIC_HEADER && at(1) === HT1080Z_BASIC_HEADER && at(2) === HT1080Z_BASIC_HEADER && streamBytes >= 4) {
    // --- A BASIC tape: D3 D3 D3, a one-character name, the program lines, a 0000h link
    kind = "basicTape";
    base.name = String.fromCharCode(at(3));
    push({ role: "basicHeader", bytes: slice(0, 4), offset: 0, name: base.name });
    pos = 4;
    const program = programLines((n) => at(pos + n), streamBytes - pos);
    if (program.lines.length) {
      const length = program.lines.reduce((sum, l) => sum + l.length, 0);
      push({ role: "basicProgram", bytes: slice(pos, pos + length), offset: pos, loadFrom: HT1080Z_PROGRAM_START, loadTo: HT1080Z_PROGRAM_START + length });
      pos += length;
    }
    base.lines = program.lines;
    if (program.ended) {
      push({ role: "programEnd", bytes: slice(pos, pos + 2), offset: pos });
      pos += 2;
    } else {
      truncated("programEnd", pos);
      pos = streamBytes;
    }
    if (base.lines.length) base.loadTop = HT1080Z_PROGRAM_START + base.lines.reduce((s, l) => s + l.length, 0) + 2;
  } else if (at(0) === HT1080Z_SYSTEM_HEADER && streamBytes >= 7) {
    // --- A SYSTEM tape: 55h, a six-character name, blocks (3Ch) and the entry (78h)
    kind = "systemTape";
    const nameBytes = slice(1, 7);
    base.name = String.fromCharCode(...nameBytes).trimEnd();
    push({ role: "systemHeader", bytes: slice(0, 7), offset: 0, name: base.name });
    pos = 7;
    let code = 0;
    while (pos < streamBytes) {
      const marker = at(pos);
      if (marker === HT1080Z_SYSTEM_BLOCK) {
        const count = at(pos + 1) || 256;
        const end = pos + 4 + count + 1;
        if (end > streamBytes) {
          truncated("systemBlock", pos);
          pos = streamBytes;
          break;
        }
        const address = at(pos + 2) | (at(pos + 3) << 8);
        let computed = at(pos + 2) + at(pos + 3);
        for (let i = 0; i < count; i++) computed += at(pos + 4 + i);
        const stored = at(pos + 4 + count);
        computed &= 0xff;
        push({
          role: "systemBlock",
          bytes: slice(pos, end),
          offset: pos,
          loadFrom: address,
          loadTo: address + count,
          checksum: { stored, computed },
          ...(stored !== computed ? { problem: "checksum" as const } : {})
        });
        code += count;
        base.loadTop = Math.max(base.loadTop ?? 0, address + count);
        pos = end;
      } else if (marker === HT1080Z_SYSTEM_ENTRY) {
        if (pos + 3 > streamBytes) {
          truncated("systemEntry", pos);
          pos = streamBytes;
          break;
        }
        base.entry = at(pos + 1) | (at(pos + 2) << 8);
        push({ role: "systemEntry", bytes: slice(pos, pos + 3), offset: pos, entry: base.entry });
        pos += 3;
        break;
      } else {
        push({ role: "trailing", bytes: slice(pos, streamBytes), offset: pos, problem: "badRecord" });
        pos = streamBytes;
        break;
      }
    }
    base.codeBytes = code;
  } else {
    return { error: "noHeader" };
  }

  // --- What follows the program on the tape: silence, noise or another file, shown as it is
  if (pos < streamBytes) push({ role: "trailing", bytes: slice(pos, streamBytes), offset: pos });

  return { analysis: finish({ ...base, kind, parts, playMs: msOf(tacts, clock) }) };
}

/** A program's lines from a byte source: the chain of links up to a 0000h link */
function programLines(byteAt: (n: number) => number, available: number): { lines: Ht1080zBasicLine[]; ended: boolean } {
  const lines: Ht1080zBasicLine[] = [];
  let pos = 0;
  while (pos + 2 <= available) {
    const link = byteAt(pos) | (byteAt(pos + 1) << 8);
    if (link === 0) return { lines, ended: true };
    if (pos + 4 > available) break;
    let end = pos + 4;
    while (end < available && byteAt(end) !== 0) end++;
    if (end >= available) break;
    const text = new Uint8Array(end - pos - 4);
    for (let i = 0; i < text.length; i++) text[i] = byteAt(pos + 4 + i);
    lines.push({
      offset: pos,
      address: HT1080Z_PROGRAM_START + pos,
      link,
      lineNo: byteAt(pos + 2) | (byteAt(pos + 3) << 8),
      text,
      length: end + 1 - pos
    });
    pos = end + 1;
  }
  return { lines, ended: false };
}

// =================================================================================================
// .cmd

function analyzeCmd(file: Uint8Array, clock: number): Ht1080zTapeViewResult {
  const parts: Ht1080zPart[] = [];
  const result: Omit<Ht1080zTapeAnalysis, "playMs" | "hasProblems"> = { kind: "cmd", size: file.length, parts, codeBytes: 0 };
  let pos = 0;
  while (pos < file.length) {
    const type = file[pos];
    if (pos + 1 >= file.length) {
      parts.push({ index: parts.length, role: "trailing", bytes: file.subarray(pos), offset: pos, problem: "truncated" });
      break;
    }
    let length = file[pos + 1];
    if (type === 0x01 && length <= 2) length += 256;
    else if (length === 0) length = 256;
    const end = pos + 2 + length;
    const record = file.subarray(pos, Math.min(end, file.length));
    const data = record.subarray(2);
    const add = (part: Omit<Ht1080zPart, "index" | "bytes" | "offset">) =>
      parts.push({ index: parts.length, bytes: record, offset: pos, recordType: type, ...part });
    if (end > file.length) {
      add({ role: type === 0x01 ? "cmdLoad" : "trailing", problem: "truncated" });
      break;
    }
    if (type === 0x01) {
      const address = data[0] | (data[1] << 8);
      add({ role: "cmdLoad", loadFrom: address, loadTo: address + length - 2 });
      result.codeBytes! += length - 2;
      result.loadTop = Math.max(result.loadTop ?? 0, address + length - 2);
    } else if (type === 0x02) {
      result.entry = data[0] | ((data[1] ?? 0) << 8);
      add({ role: "cmdTransfer", entry: result.entry });
      pos = end;
      break;
    } else if (type === 0x05) {
      result.name = String.fromCharCode(...data).trimEnd();
      add({ role: "cmdHeader", name: result.name });
    } else if (type <= 0x1f) {
      add({ role: "cmdOther" });
    } else {
      add({ role: "trailing", problem: "badRecord" });
      break;
    }
    pos = end;
  }
  if (pos < file.length && parts[parts.length - 1]?.role === "cmdTransfer") {
    parts.push({ index: parts.length, role: "trailing", bytes: file.subarray(pos), offset: pos });
  }
  // --- How long Klive's SYSTEM tape of it plays
  let playMs = 0;
  try {
    playMs = analyzeCas(cmdToSystemTape(file, result.name || "KLIVE"), clock).analysis?.playMs ?? 0;
  } catch {
    playMs = 0;
  }
  return { analysis: finish({ ...result, playMs }) };
}

// =================================================================================================
// .bas

function analyzeBas(file: Uint8Array, clock: number): Ht1080zTapeViewResult {
  if (file.length < 3 || file[0] !== 0xff) return { error: "notTokenised" };
  const program = programLines((n) => file[1 + n], file.length - 1);
  const parts: Ht1080zPart[] = program.lines.map((line, index) => ({
    index,
    role: "basLine",
    bytes: file.subarray(1 + line.offset, 1 + line.offset + line.length),
    offset: 1 + line.offset,
    loadFrom: line.address,
    loadTo: line.address + line.length,
    line
  }));
  const programLength = program.lines.reduce((sum, l) => sum + l.length, 0);
  if (program.ended) {
    parts.push({ index: parts.length, role: "programEnd", bytes: file.subarray(1 + programLength, 3 + programLength), offset: 1 + programLength });
    if (3 + programLength < file.length) {
      parts.push({ index: parts.length, role: "trailing", bytes: file.subarray(3 + programLength), offset: 3 + programLength });
    }
  } else {
    parts.push({ index: parts.length, role: "trailing", bytes: file.subarray(1 + programLength), offset: 1 + programLength, problem: "truncated" });
  }
  let playMs = 0;
  try {
    playMs = analyzeCas(basToBasicTape(file, "A"), clock).analysis?.playMs ?? 0;
  } catch {
    playMs = 0;
  }
  return {
    analysis: finish({
      kind: "bas",
      size: file.length,
      parts,
      lines: program.lines,
      loadTop: HT1080Z_PROGRAM_START + programLength + 2,
      playMs
    })
  };
}

function finish(analysis: Omit<Ht1080zTapeAnalysis, "hasProblems">): Ht1080zTapeAnalysis {
  return { ...analysis, hasProblems: analysis.parts.some((p) => !!p.problem) };
}

/** Whether what the file loads fits a 16K model (RAM to 7FFFh) */
export function fitsSixteenK(analysis: Ht1080zTapeAnalysis): boolean {
  return (analysis.loadTop ?? 0) <= 0x8000;
}
