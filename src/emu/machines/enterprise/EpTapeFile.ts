/*
 * Enterprise 64/128 tape files (`.plans/ENTERPRISE_PLAN.md` §9.3; the formats are
 * `_input/enterprise128/STORAGE_FIRMWARE_SOFTWARE.md` §4.2 and `DAVE_MEMORY_IO.md` §7.4-§7.5).
 *
 * EXOS writes a file as chunks, the motor stopped between them. A chunk is a leader (424 us cycles at
 * the fast speed), one sync cycle (696 us), a dummy byte (00h), 6Ah, the chunk's data and a few leader
 * cycles. Its data is a block count - FFh for the header chunk, 0-16 for a data chunk - then each block:
 * its length (0 = 256), its bytes and their CRC (16 bits, low byte first). Bits go LSB first, one full
 * cycle each: a 1 is 344 us, a 0 504 us. The header chunk has one block: the protection byte, the name's
 * length and the name. Data chunks carry 4 KB each but the last, which is shorter (0 bytes included):
 * that one ends the file.
 *
 * The CRC (EXOS book §6.5): a register from 0; for each data bit, LSB first, the bit is XOR-ed into bit
 * 15, the register is XOR-ed with 0810h when bit 15 is then set, and rotated left. The length byte is
 * not covered, and the CRC follows the block low byte first.
 *
 * The header's protection byte (DAVE_MEMORY_IO.md OQ7), observed on EXOS 2.1 by the SAVE round trip
 * (`test/ep-hw/tape.test.ts`): EXOS writes its PROTECT variable (34) as it is, and the variable follows
 * EXOS's on/off convention (0 on, FFh off, like REM1 and REM2). An ordinary SAVE writes FFh (not
 * protected), `TOGGLE 34` makes the next one write 00h (protected), `SET 34,1` writes 01h. So
 * ep128emu's reading - 00h protected, FFh not - is right, and the book's "non-zero for a protected
 * file" is not what EXOS does.
 *
 * Formats read (detected by their magic, in this order):
 * - **ep128emu's native `.tap`**: a 4096-byte header of big-endian words (0275CD72h, 1C445126h, bits per
 *   sample, sample rate, cue points, FFFFFFFFh), then the samples, packed MSB first. Played as its edges.
 * - **EPTE/TAPir `.tap`**: "ENTERPRISE 128K TAPE FILE" at offset 128, the decoded chunks from offset 512.
 *   No such file was available to check against, so the reader does not trust the offset table at the
 *   start: it walks the chunks by their own structure (a block count, then each block's length), with or
 *   without a leading 00h 6Ah, with or without stored CRCs. The chunks are synthesised at EXOS's fast
 *   timings.
 * - **`.wav`** (8- or 16-bit PCM, the first channel): played as its zero crossings.
 *
 * The SAVE side: the core records the left D/A's half-periods (`ep-tape.c`), `EpTapeRecorder` decodes
 * them into chunks, checks every CRC and builds the file, written as an ep128emu native 1-bit `.tap`
 * (decision D9) re-synthesised at ep128emu's own writer's periods (24 kHz: leader 10 samples, a 1 8, a 0
 * 12, sync 16).
 *
 * The core plays a tape program (`ep-tape.c`): silence, runs of equal half-periods, data bytes, edges.
 */

export const EP_TAP_EXTENSION = ".tap";
export const EP_WAV_EXTENSION = ".wav";

/** The CPU clock the tape program counts in */
const CLOCK = 4_000_000;

const OP_HALVES = 0x4000_0000;
const OP_BYTE = 0x8000_0000;
const OP_EDGE = 0xc000_0000;
const MAX_HALF = 0x3fff;
const MAX_RUN = 0xffff;
const MAX_SILENCE = 0x3fff_ffff;

/** EXOS's fast timings as half-periods in T-states (DAVE_MEMORY_IO.md §7.4) */
export const EP_TAPE_FAST = { leader: 848, one: 688, zero: 1008, sync: 1392 } as const;
/** And the slow ones (`SP_TAPE` nonzero) */
export const EP_TAPE_SLOW = { leader: 2000, one: 1600, zero: 2400, sync: 3200 } as const;

const NATIVE_MAGIC_0 = 0x0275cd72;
const NATIVE_MAGIC_1 = 0x1c445126;
const NATIVE_HEADER = 4096;
const NATIVE_RATE = 24_000;
/** ep128emu's writer's periods in 24 kHz samples (fast); slow ones scaled from EXOS's */
const NATIVE_FAST = { leader: 10, one: 8, zero: 12, sync: 16 } as const;
const NATIVE_SLOW = { leader: 24, one: 20, zero: 28, sync: 38 } as const;

const EPTE_MAGIC = "ENTERPRISE 128K TAPE FILE       ";
const EPTE_MAGIC_OFFSET = 128;
const EPTE_DATA_OFFSET = 512;

/** A data chunk's capacity: 16 blocks of 256 bytes */
export const EP_CHUNK_BYTES = 4096;

/** One chunk as EXOS writes it after 6Ah: the block count, then each block's length, bytes and CRC */
export type EpTapeChunk = { readonly bytes: Uint8Array; readonly slow?: boolean };

/** A tape file, ready for the core */
export type EpTapeFile = {
  readonly kind: "ep-tape";
  readonly format: "ep128emu" | "epte" | "wav";
  /** The tape program the core plays (`epTapeProgramPtr`) */
  readonly program: Uint32Array;
  /** The chunks, for a format that holds them decoded (EPTE) */
  readonly chunks?: readonly EpTapeChunk[];
  /**
   * The EXOS module type of the tape's first file (its first data block's second byte: 4 an IS-BASIC
   * program, 5 a machine-code application), when the tape's start decodes as EXOS chunks
   */
  readonly moduleType?: number;
};

/** Why a file cannot go in the Enterprise's deck */
export type EpTapeErrorCode = "notTape" | "badHeader" | "badChunks" | "tooLong" | "badWav";

export class EpTapeFileError extends Error {
  constructor(readonly code: EpTapeErrorCode) {
    super(`Not a usable Enterprise tape file (${code}).`);
  }
}

export function isEpTapeFileName(fileName: string | undefined): boolean {
  const name = (fileName ?? "").toLowerCase();
  return name.endsWith(EP_TAP_EXTENSION) || name.endsWith(EP_WAV_EXTENSION);
}

export function isEpTapeFile(value: unknown): value is EpTapeFile {
  return typeof value === "object" && value !== null && (value as EpTapeFile).kind === "ep-tape";
}

// =============================================================================================
// The CRC and the chunks

/** EXOS's tape CRC over `bytes` (DAVE_MEMORY_IO.md §7.4) */
export function epTapeCrc(bytes: ArrayLike<number>, from = 0, to = bytes.length): number {
  let value = 0;
  for (let i = from; i < to; i++) {
    const byte = bytes[i];
    for (let b = 0; b < 8; b++) {
      const carry = ((value >> 15) ^ (byte >> b)) & 1;
      if (carry) value ^= 0x0810;
      value = ((value << 1) & 0xffff) | carry;
    }
  }
  return value;
}

/** A chunk of `blocks` (each up to 256 bytes) with block count `count` */
function chunkOf(count: number, blocks: Uint8Array[]): Uint8Array {
  const out: number[] = [count];
  for (const block of blocks) {
    out.push(block.length & 0xff, ...block);
    const crc = epTapeCrc(block);
    out.push(crc & 0xff, crc >> 8);
  }
  return Uint8Array.from(out);
}

/**
 * The chunks of a file as EXOS writes it: the header chunk (`protect` is the byte on tape, FFh for an
 * unprotected file), then 4 KB data chunks, the last one shorter (possibly empty)
 */
export function epFileChunks(name: string, payload: Uint8Array, protect = 0xff): Uint8Array[] {
  const nameBytes = Array.from(name.slice(0, 28), (c) => c.charCodeAt(0) & 0xff);
  const chunks = [chunkOf(0xff, [Uint8Array.from([protect, nameBytes.length, ...nameBytes])])];
  for (let at = 0; ; at += EP_CHUNK_BYTES) {
    const part = payload.subarray(at, Math.min(payload.length, at + EP_CHUNK_BYTES));
    const blocks: Uint8Array[] = [];
    for (let b = 0; b < part.length; b += 256) blocks.push(part.subarray(b, b + 256));
    chunks.push(chunkOf(blocks.length, blocks));
    if (part.length < EP_CHUNK_BYTES) break;
  }
  return chunks;
}

/** A chunk's parts, checked */
export type EpParsedChunk = {
  readonly header: boolean;
  readonly blocks: Uint8Array[];
  /** Whether every block's CRC matched */
  readonly crcOk: boolean;
  /** The chunk's length in bytes from its block count */
  readonly length: number;
};

/**
 * Reads a chunk from its block count (`withCrc`: each block followed by its CRC)
 * @returns undefined when the bytes do not hold a whole chunk
 */
export function parseEpChunk(bytes: ArrayLike<number>, from = 0, withCrc = true): EpParsedChunk | undefined {
  if (from >= bytes.length) return undefined;
  const count = bytes[from];
  if (count !== 0xff && count > 16) return undefined;
  const blocks: Uint8Array[] = [];
  let crcOk = true;
  let at = from + 1;
  for (let i = 0; i < (count === 0xff ? 1 : count); i++) {
    if (at >= bytes.length) return undefined;
    const length = bytes[at] === 0 ? 256 : bytes[at];
    const end = at + 1 + length + (withCrc ? 2 : 0);
    if (end > bytes.length) return undefined;
    const block = Uint8Array.from({ length }, (_, k) => bytes[at + 1 + k]);
    if (withCrc) {
      const stored = bytes[at + 1 + length] | (bytes[at + 2 + length] << 8);
      if (stored !== epTapeCrc(block)) crcOk = false;
    }
    blocks.push(block);
    at = end;
  }
  return { header: count === 0xff, blocks, crcOk, length: at - from };
}

// =============================================================================================
// Tape programs

const halves = (half: number, count: number) => (OP_HALVES | ((half & MAX_HALF) << 16) | count) >>> 0;

/** Builds a tape program as the core plays it (`ep-tape.c`) */
class ProgramBuilder {
  readonly words: number[] = [];
  silence(tacts: number): void {
    for (let left = Math.round(tacts); left > 0; left -= MAX_SILENCE) this.words.push(Math.min(left, MAX_SILENCE));
  }
  /** `count` half-periods of `half` T-states */
  halves(half: number, count: number): void {
    if (count <= 0) return;
    if (half > MAX_HALF) {
      for (let i = 0; i < count; i++) {
        this.words.push((OP_EDGE | Math.min(half, MAX_SILENCE)) >>> 0);
        if (half > MAX_SILENCE) this.silence(half - MAX_SILENCE);
      }
      return;
    }
    const last = this.words[this.words.length - 1];
    if (last !== undefined && last >>> 30 === 1 && ((last >>> 16) & MAX_HALF) === half) {
      const room = MAX_RUN - (last & 0xffff);
      const add = Math.min(room, count);
      this.words[this.words.length - 1] = halves(half, (last & 0xffff) + add);
      count -= add;
    }
    while (count > 0) {
      const n = Math.min(count, MAX_RUN);
      this.words.push(halves(half, n));
      count -= n;
    }
  }
  byte(value: number, slow: boolean): void {
    this.words.push((OP_BYTE | (slow ? 0x100 : 0) | (value & 0xff)) >>> 0);
  }
  build(): Uint32Array {
    return Uint32Array.from(this.words);
  }
}

/**
 * The tape program of a list of chunks at EXOS's timings: before each, silence and a leader (5 s for
 * the first, 2 s for the others), then the sync cycle, 00h, 6Ah, the chunk and 150 leader cycles
 */
export function buildEpTapeProgram(chunks: readonly (Uint8Array | EpTapeChunk)[]): Uint32Array {
  const p = new ProgramBuilder();
  chunks.forEach((entry, index) => {
    const chunk = entry instanceof Uint8Array ? { bytes: entry } : entry;
    const slow = !!chunk.slow;
    const t = slow ? EP_TAPE_SLOW : EP_TAPE_FAST;
    p.silence(CLOCK / (index === 0 ? 2 : 4));
    const leaderCycles = Math.round(((index === 0 ? 5 : 2) * CLOCK) / (2 * t.leader));
    p.halves(t.leader, 2 * leaderCycles);
    p.halves(t.sync, 2);
    p.byte(0x00, slow);
    p.byte(0x6a, slow);
    chunk.bytes.forEach((b) => p.byte(b, slow));
    p.halves(t.leader, 2 * 150);
  });
  p.silence(CLOCK / 2);
  return p.build();
}

/** The tape program of a signal given as its half-periods in T-states (the first starts with an edge) */
export function programOfHalves(halfPeriods: ArrayLike<number>, leadingSilence = 0): Uint32Array {
  const p = new ProgramBuilder();
  if (leadingSilence > 0) p.silence(leadingSilence);
  for (let i = 0; i < halfPeriods.length; ) {
    let j = i + 1;
    while (j < halfPeriods.length && halfPeriods[j] === halfPeriods[i]) j++;
    p.halves(Math.max(1, halfPeriods[i]), j - i);
    i = j;
  }
  p.silence(CLOCK / 2);
  return p.build();
}

/** How long a tape program plays, in T-states */
export function epTapeProgramTacts(program: Uint32Array): number {
  let tacts = 0;
  for (const op of program) {
    switch (op >>> 30) {
      case 0:
      case 3:
        tacts += op & MAX_SILENCE;
        break;
      case 1:
        tacts += ((op >>> 16) & MAX_HALF) * (op & 0xffff);
        break;
      default: {
        const t = op & 0x100 ? EP_TAPE_SLOW : EP_TAPE_FAST;
        for (let i = 0; i < 8; i++) tacts += ((op >> i) & 1 ? t.one : t.zero) * 2;
      }
    }
  }
  return tacts;
}

// =============================================================================================
// Reading files

/**
 * Reads a tape file.
 * @throws EpTapeFileError when it is not one
 */
export function parseEpTapeFile(bytes: Uint8Array): EpTapeFile {
  if (isNativeTap(bytes)) {
    const signal = nativeTapHalves(bytes);
    return { kind: "ep-tape", format: "ep128emu", program: programOfHalves(signal), moduleType: moduleTypeOfHalves(signal) };
  }
  if (isEpteTap(bytes)) {
    const chunks = epteChunks(bytes);
    const data = chunks.length > 1 ? parseEpChunk(chunks[1].bytes) : undefined;
    return { kind: "ep-tape", format: "epte", program: buildEpTapeProgram(chunks), chunks, moduleType: moduleTypeOfBlocks(data?.blocks) };
  }
  if (isWav(bytes)) {
    const signal = wavHalves(bytes);
    return { kind: "ep-tape", format: "wav", program: programOfHalves(signal), moduleType: moduleTypeOfHalves(signal) };
  }
  throw new EpTapeFileError("notTape");
}

/** An EXOS module header's type byte (00h, type, ...) at the start of a data chunk's first block */
function moduleTypeOfBlocks(blocks: Uint8Array[] | undefined): number | undefined {
  const first = blocks?.[0];
  return first && first.length >= 2 && first[0] === 0x00 ? first[1] : undefined;
}

/** The module type of the first file a signal holds: its runs between pauses decoded as chunks, up to the first data chunk */
function moduleTypeOfHalves(signal: readonly number[]): number | undefined {
  let run: number[] = [];
  let seenHeader = false;
  for (let i = 0; i <= signal.length; i++) {
    const half = signal[i];
    if (i < signal.length && half <= 254 * EP_SAVE_UNIT_TACTS) {
      run.push(Math.max(1, Math.round(half / EP_SAVE_UNIT_TACTS)));
      continue;
    }
    if (run.length > 200) {
      const chunk = decodeEpChunkRun(run);
      if (chunk?.header) seenHeader = true;
      else if (chunk && seenHeader) return moduleTypeOfBlocks(chunk.blocks);
    }
    run = [];
  }
  return undefined;
}

const be32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const le32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
const le16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

function isNativeTap(b: Uint8Array): boolean {
  return b.length >= 16 && be32(b, 0) === NATIVE_MAGIC_0 && be32(b, 4) === NATIVE_MAGIC_1;
}

function isEpteTap(b: Uint8Array): boolean {
  if (b.length < EPTE_DATA_OFFSET) return false;
  for (let i = 0; i < EPTE_MAGIC.length; i++) if (b[EPTE_MAGIC_OFFSET + i] !== EPTE_MAGIC.charCodeAt(i)) return false;
  return true;
}

function isWav(b: Uint8Array): boolean {
  return b.length >= 44 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WAVE";
}

/** Half-periods of a level stream from its first edge, each quantised to T-states */
function halvesOfLevels(levels: (i: number) => boolean, count: number, rate: number): number[] {
  const result: number[] = [];
  const tactsPerSample = CLOCK / rate;
  let i = 0;
  let level = count > 0 ? levels(0) : false;
  while (i < count && levels(i) === level) i++;
  let start = i;
  level = !level;
  for (; i < count; i++) {
    const now = levels(i);
    if (now !== level) {
      result.push(Math.round((i - start) * tactsPerSample));
      start = i;
      level = now;
    }
  }
  if (count > start) result.push(Math.round((count - start) * tactsPerSample));
  return result;
}

/** An ep128emu native `.tap`'s half-periods: a sample is high when it is at least half the full scale */
function nativeTapHalves(b: Uint8Array): number[] {
  if (b.length < NATIVE_HEADER) throw new EpTapeFileError("badHeader");
  const bits = be32(b, 8);
  const rate = be32(b, 12);
  if (![1, 2, 4, 8].includes(bits) || rate < 10_000 || rate > 120_000) throw new EpTapeFileError("badHeader");
  const data = b.subarray(NATIVE_HEADER);
  const count = Math.floor((data.length * 8) / bits);
  const half = 1 << (bits - 1);
  const perByte = 8 / bits;
  const mask = (1 << bits) - 1;
  const level = (i: number) => {
    const byte = data[Math.floor(i / perByte)];
    const shift = 8 - bits * ((i % perByte) + 1);
    return ((byte >> shift) & mask) >= half;
  };
  return halvesOfLevels(level, count, rate);
}

/** A WAV file's half-periods: its first channel's zero crossings, with a little hysteresis */
function wavHalves(b: Uint8Array): number[] {
  let at = 12;
  let format = 0;
  let channels = 0;
  let rate = 0;
  let bits = 0;
  let data: Uint8Array | undefined;
  while (at + 8 <= b.length) {
    const id = String.fromCharCode(...b.subarray(at, at + 4));
    const size = le32(b, at + 4);
    const body = b.subarray(at + 8, Math.min(b.length, at + 8 + size));
    if (id === "fmt ") {
      format = le16(body, 0);
      channels = le16(body, 2);
      rate = le32(body, 4);
      bits = le16(body, 14);
    } else if (id === "data") {
      data = body;
    }
    at += 8 + size + (size & 1);
  }
  if (format !== 1 || channels < 1 || (bits !== 8 && bits !== 16) || rate < 8000 || !data) throw new EpTapeFileError("badWav");
  const frame = channels * (bits / 8);
  const count = Math.floor(data.length / frame);
  const sample = (i: number) =>
    bits === 8 ? data![i * frame] - 128 : ((data![i * frame] | (data![i * frame + 1] << 8)) << 16) >> 16;
  const threshold = bits === 8 ? 4 : 1024;
  let level = false;
  const levels = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const v = sample(i);
    if (level && v < -threshold) level = false;
    else if (!level && v > threshold) level = true;
    levels[i] = level ? 1 : 0;
  }
  return halvesOfLevels((i) => levels[i] !== 0, count, rate);
}

/**
 * An EPTE file's chunks, walked by their structure from offset 512. Whether the blocks carry their CRCs
 * is decided once, by the first chunk; a stored CRC that does not match is kept, as a real tape keeps
 * its errors.
 */
function epteChunks(b: Uint8Array): EpTapeChunk[] {
  const start = (at: number) => (b[at] === 0x00 && b[at + 1] === 0x6a ? at + 2 : b[at] === 0x6a ? at + 1 : at);
  const first = parseEpChunk(b, start(EPTE_DATA_OFFSET), true);
  const withCrc = !!first?.crcOk;
  const chunks: EpTapeChunk[] = [];
  let at = EPTE_DATA_OFFSET;
  while (at < b.length) {
    // --- Padding between chunks
    if (b[at] !== 0xff && b[at] > 16 && b[at] !== 0x6a) {
      at++;
      continue;
    }
    const from = start(at);
    const chunk = parseEpChunk(b, from, withCrc);
    if (!chunk) break;
    chunks.push({ bytes: withCrc ? b.slice(from, from + chunk.length) : chunkOf(b[from], chunk.blocks) });
    at = from + chunk.length;
  }
  if (chunks.length === 0) throw new EpTapeFileError("badChunks");
  return chunks;
}

// =============================================================================================
// Writing files

/**
 * An EPTE/TAPir `.tap` of the chunks, as Klive reads it: the offset table (each chunk's end, relative to
 * offset 512), the magic at 128, the chunks from 512 (each as EXOS writes it after 6Ah, CRCs included)
 */
export function buildEpteFile(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(EPTE_DATA_OFFSET + total);
  let at = 0;
  chunks.forEach((chunk, i) => {
    out.set(chunk, EPTE_DATA_OFFSET + at);
    at += chunk.length;
    if (i < 32) {
      out[i * 4] = at & 0xff;
      out[i * 4 + 1] = (at >> 8) & 0xff;
      out[i * 4 + 2] = (at >> 16) & 0xff;
      out[i * 4 + 3] = (at >> 24) & 0xff;
    }
  });
  for (let i = 0; i < EPTE_MAGIC.length; i++) out[EPTE_MAGIC_OFFSET + i] = EPTE_MAGIC.charCodeAt(i);
  return out;
}

/**
 * An ep128emu native 1-bit `.tap` (24 kHz) of the chunks, at ep128emu's writer's periods: 0.25 s of
 * silence, 6000 leader cycles (4800 after the first chunk), the sync, 00h, 6Ah, the chunk, 150 leader
 * cycles and 0.25 s of silence per chunk
 */
export function buildEp128emuTap(chunks: readonly (Uint8Array | EpTapeChunk)[]): Uint8Array {
  const samples: number[] = [];
  const silence = (n: number) => {
    for (let i = 0; i < n; i++) samples.push(0);
  };
  const cycle = (length: number) => {
    const high = length >> 1;
    for (let i = 0; i < length; i++) samples.push(i < high ? 1 : 0);
  };
  chunks.forEach((entry, index) => {
    const chunk = entry instanceof Uint8Array ? { bytes: entry } : entry;
    const t = chunk.slow ? NATIVE_SLOW : NATIVE_FAST;
    const byte = (value: number) => {
      for (let i = 0; i < 8; i++) cycle((value >> i) & 1 ? t.one : t.zero);
    };
    silence(NATIVE_RATE / 4);
    for (let i = 0; i < (index === 0 ? 6000 : 4800); i++) cycle(t.leader);
    cycle(t.sync);
    byte(0x00);
    byte(0x6a);
    chunk.bytes.forEach(byte);
    for (let i = 0; i < 150; i++) cycle(t.leader);
    silence(NATIVE_RATE / 4);
  });
  // --- Whole 4096-sample blocks
  while (samples.length % 4096 !== 0) samples.push(0);
  const out = new Uint8Array(NATIVE_HEADER + samples.length / 8);
  const put32 = (at: number, v: number) => {
    out[at] = (v >>> 24) & 0xff;
    out[at + 1] = (v >>> 16) & 0xff;
    out[at + 2] = (v >>> 8) & 0xff;
    out[at + 3] = v & 0xff;
  };
  put32(0, NATIVE_MAGIC_0);
  put32(4, NATIVE_MAGIC_1);
  put32(8, 1);
  put32(12, NATIVE_RATE);
  for (let w = 4; w < 1024; w++) put32(w * 4, 0xffff_ffff);
  for (let i = 0; i < samples.length; i++) if (samples[i]) out[NATIVE_HEADER + (i >> 3)] |= 0x80 >> (i & 7);
  return out;
}

// =============================================================================================
// The SAVE side

/** A chunk decoded from a recording */
export type EpDecodedChunk = EpParsedChunk & {
  /** The chunk as EXOS wrote it after 6Ah */
  readonly bytes: Uint8Array;
  readonly slow: boolean;
};

/** A file decoded from a recording */
export type EpSavedFile = {
  /** The name in the header chunk */
  readonly name: string;
  /** The header's protection byte as it is on tape (FFh: not protected) */
  readonly protect: number;
  readonly payload: Uint8Array;
  readonly chunks: readonly EpDecodedChunk[];
  /** The file as an ep128emu native `.tap` */
  readonly tap: Uint8Array;
};

/** The recording's unit (`ep-tape.c`): 16 T-states */
export const EP_SAVE_UNIT_TACTS = 16;

/**
 * Decodes one motor run of a recording (half-periods in 16 T units): a leader of at least 200 halves
 * within 1/8 of each other, the sync (halves over 1.4 leader halves), then full cycles shorter than a
 * leader cycle are 1s and longer ones 0s. The chunk's structure says where it ends (the trailer is
 * leader cycles, which sit on the threshold).
 * @returns undefined when the run holds no whole chunk after a 00h, 6Ah
 */
export function decodeEpChunkRun(units: ArrayLike<number>): EpDecodedChunk | undefined {
  let i = 0;
  let leader = 0;
  let run = 0;
  // --- The leader, then the sync's first half
  for (; i < units.length; i++) {
    const h = units[i];
    if (run >= 200 && h * 10 > leader * 14) break;
    if (run > 0 && h * 8 > leader * 7 && h * 8 < leader * 9) {
      leader = (leader * 15 + h) / 16;
      run++;
    } else {
      leader = h;
      run = 1;
    }
  }
  if (i >= units.length) return undefined;
  while (i < units.length && units[i] * 10 > leader * 14) i++;
  const cycleLimit = leader * 2;
  const bytes: number[] = [];
  const readByte = (): number | undefined => {
    let value = 0;
    for (let b = 0; b < 8; b++) {
      if (i + 1 >= units.length) return undefined;
      const cycle = units[i] + units[i + 1];
      i += 2;
      if (cycle < cycleLimit) value |= 1 << b;
    }
    return value;
  };
  const dummy = readByte();
  const marker = readByte();
  if (dummy === undefined || marker !== 0x6a) return undefined;
  // --- The chunk: the block count, then each block's length, bytes and CRC
  const count = readByte();
  if (count === undefined || (count !== 0xff && count > 16)) return undefined;
  bytes.push(count);
  for (let block = 0; block < (count === 0xff ? 1 : count); block++) {
    const lengthByte = readByte();
    if (lengthByte === undefined) return undefined;
    bytes.push(lengthByte);
    const length = lengthByte === 0 ? 256 : lengthByte;
    for (let k = 0; k < length + 2; k++) {
      const v = readByte();
      if (v === undefined) return undefined;
      bytes.push(v);
    }
  }
  const parsed = parseEpChunk(bytes, 0, true);
  if (!parsed) return undefined;
  const slow = leader * EP_SAVE_UNIT_TACTS > (EP_TAPE_FAST.leader + EP_TAPE_SLOW.leader) / 2;
  return { ...parsed, bytes: Uint8Array.from(bytes), slow };
}

/**
 * Assembles files from decoded chunks: a header chunk, then data chunks up to the first shorter than
 * 4 KB. A file with a CRC error, or one that does not end, is left out.
 * @returns the whole files, and how many chunks they used (the rest waits for more)
 */
export function epSavedFilesOf(chunks: readonly (EpDecodedChunk | undefined)[]): { files: EpSavedFile[]; used: number } {
  const files: EpSavedFile[] = [];
  let used = 0;
  let i = 0;
  while (i < chunks.length) {
    const header = chunks[i];
    if (!header || !header.header) {
      i++;
      used = i;
      continue;
    }
    const data: EpDecodedChunk[] = [];
    let j = i + 1;
    let ended = false;
    let broken = !header.crcOk;
    for (; j < chunks.length; j++) {
      const chunk = chunks[j];
      if (!chunk || chunk.header) {
        broken = true;
        break;
      }
      data.push(chunk);
      if (!chunk.crcOk) broken = true;
      if (chunk.blocks.reduce((n, b) => n + b.length, 0) < EP_CHUNK_BYTES) {
        ended = true;
        j++;
        break;
      }
    }
    if (!ended && !broken) break;
    if (ended && !broken) {
      const block = header.blocks[0] ?? new Uint8Array(0);
      const nameLength = Math.min(block[1] ?? 0, Math.max(0, block.length - 2));
      const name = String.fromCharCode(...block.subarray(2, 2 + nameLength));
      const payload = new Uint8Array(data.reduce((n, c) => n + c.blocks.reduce((m, b) => m + b.length, 0), 0));
      let at = 0;
      for (const c of data) for (const b of c.blocks) (payload.set(b, at), (at += b.length));
      const fileChunks = [header, ...data];
      files.push({ name, protect: block[0] ?? 0xff, payload, chunks: fileChunks, tap: buildEp128emuTap(fileChunks) });
    }
    i = j;
    used = i;
  }
  return { files, used };
}

/**
 * Collects the core's SAVE recording (`epTapeSavedDataPtr`, a ring of half-periods with 0 at each motor
 * stop) as it grows, and turns whole files into `EpSavedFile`s
 */
export class EpTapeRecorder {
  private run: number[] = [];
  private chunks: (EpDecodedChunk | undefined)[] = [];
  /** How many of the core's bytes were read */
  private read = 0;

  /** Starts over from the core's current count (a reset, a restored state) */
  sync(count: number): void {
    this.read = count;
    this.run = [];
    this.chunks = [];
  }

  /**
   * Reads what the core wrote since the last call
   * @param ring The core's ring
   * @param count The core's count of bytes ever written (`epTapeGetSavedLength`)
   * @returns the files that became whole
   */
  feed(ring: Uint8Array, count: number): EpSavedFile[] {
    const files: EpSavedFile[] = [];
    if (count - this.read > ring.length || count < this.read) {
      // --- The ring overflowed or went back: what was collected is lost
      this.sync(count);
      return files;
    }
    let ended = false;
    for (; this.read < count; this.read++) {
      const unit = ring[this.read % ring.length];
      if (unit === 0) {
        this.chunks.push(decodeEpChunkRun(this.run));
        this.run = [];
        ended = true;
      } else {
        this.run.push(unit);
        // --- A runaway recording without a motor stop
        if (this.run.length > 4_000_000) this.run = [];
      }
    }
    if (ended) {
      const result = epSavedFilesOf(this.chunks);
      files.push(...result.files);
      this.chunks = this.chunks.slice(result.used);
    }
    return files;
  }
}
