/*
 * The debug recording (`.klr`): a reverse-debugging timeline written to a file
 * (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.1, D1, D3-D6). Pure: no Node, no DOM.
 *
 *   "KLIVEREC" container (`chunkedContainer.ts`) · header JSON
 *   THMB  u16 width · u16 height · RGBA: the screen at the saved present
 *   PAGE  deflate(u32 count · u32 page size · pages): the keyframes' pool pages, shared pages once
 *   KEYF  deflate(per keyframe: seed, frame, journal index, flags, page table, meta JSON)
 *   JRNL  deflate(export-name table · entries)
 *   HITS  deflate(key table · per hit: position, key index)
 *   RING  deflate(the present's history ring: its header view and records)
 *   PRES  JSON: the present's host and breakpoint state (what replay cannot rebuild)
 *   BRKP  JSON: breakpoints and watches (D11)
 *   MEDI  JSON: media references (D14, D15), for display
 *   SRCS  JSON: the compilation's identity; deflated sources with `-sources` (D13)
 *   KLS   the `.kls` of the present (D16)
 *   NOTE  UTF-8: the user's description
 *   END   SHA-256 of every byte before this section
 *
 * Positions are stored as a u64 sequence, a varint sub and a phase byte; a sequence above
 * `Number.MAX_SAFE_INTEGER` is refused (T3). The reader checks the framing and the END hash, so a
 * truncated or edited file is refused rather than replayed.
 */

import { deflateSync, inflateSync } from "fflate";
import {
  concatBytes,
  encodeContainerStart,
  encodeSection,
  hasContainerMagic,
  readChunkedContainer,
  type ContainerSection
} from "../machineState/chunkedContainer";
import {
  decodeThumbnail,
  encodeThumbnail,
  type KliveStateMedia,
  type KliveStateThumbnail
} from "../machineState/kliveStateFile";

export const DEBUG_RECORDING_MAGIC = "KLIVEREC";
export const DEBUG_RECORDING_VERSION = 1;
export const DEBUG_RECORDING_EXTENSION = ".klr";

/** Is this a debug recording path (`.klr`, any case)? */
export function isDebugRecordingPath(path: string | undefined): boolean {
  return !!path && /\.klr$/i.test(path.trim());
}

/** A point of the instruction stream (`TimelinePosition`) */
export type RecordingPosition = { sequence: number; sub: number; phase: number };

/** What a reader needs before it touches a core */
export type DebugRecordingHeader = {
  machineId: string;
  modelId?: string;
  config?: Record<string, unknown>;
  machineName?: string;
  /** The Klive version that wrote the file */
  kliveVersion: string;
  /** The core ("sp48", "zxnext", ...) */
  coreId: string;
  /** The core build's layout fingerprint */
  fingerprint: string;
  /** SHA-256 of the core's code and data sections (D3, T1) */
  codeHash: string;
  /** Hash of the core's journaled export names (D3, T2) */
  contractHash: string;
  memorySize: number;
  /** The keyframe page size, in bytes */
  pageSize: number;
  /** When it was saved (ISO 8601) */
  savedAt: string;
  /** The user's one-line description (the NOTE section holds the full text) */
  description?: string;
  /** Where the recording starts: its first keyframe */
  base: RecordingPosition;
  /** Where the live run stood when it was saved */
  present: RecordingPosition;
  /** Where the machine stood, when the save was made in the past (the load can land there) */
  cursor?: RecordingPosition;
  /** The machine frames the recording spans */
  frames: number;
  /** ...in seconds of machine time */
  seconds: number;
  /** Instructions (history records) it spans */
  records: number;
  /** Keyframes saved */
  keyframes: number;
  /** Only keyframes about a second apart were saved (D7) */
  sparse: boolean;
  /** The save trimmed the front at this point (D8) */
  from?: RecordingPosition;
  /** PC at the present */
  pc: number;
};

/** A keyframe as saved: its page table indexes the recording's pages */
export type RecordingKeyframe = {
  seed: { position: RecordingPosition; newest?: Uint8Array };
  /** The machine frame counter (with its fraction) */
  frame: number;
  /** The journal entries before this index are already in the image */
  journalIndex: number;
  /** It holds the frame-boundary scratch too */
  complete: boolean;
  /** Memory page -> recording page, or -1 */
  pages: Int32Array;
  /** The owner's data: host fields, breakpoint state, hit-log index (JSON) */
  meta?: unknown;
};

export type RecordingCallEntry = {
  readonly kind: "call";
  readonly position: RecordingPosition;
  readonly exportName: string;
  readonly args: readonly number[];
};

export type RecordingWriteEntry = {
  readonly kind: "write";
  readonly position: RecordingPosition;
  readonly address: number;
  readonly length: number;
  readonly bytes?: Uint8Array;
  readonly fill?: number;
};

export type RecordingJournalEntry = RecordingCallEntry | RecordingWriteEntry;

/** A logged breakpoint hit (by breakpoint storage key) */
export type RecordingHit = { position: RecordingPosition; key: string };

/** The history ring as the present had it */
export type RecordingRing = {
  view: { count: number; writeIndex: number; newestLo: number; newestHi: number; generation: number };
  records: Uint8Array;
};

/** What replay cannot rebuild about the present (`Timeline`'s present) */
export type RecordingPresent = {
  /** The wrapper's fields */
  host: unknown;
  /** Hit counters and one-shots */
  debug?: unknown;
  /** The machine frame counter (with its fraction) */
  frames: number;
};

/** Breakpoints and watches (D11) */
export type RecordingBreakpoints = {
  schemaVersion: number;
  breakpoints: unknown[];
  watches?: unknown[];
};

/** A source file of the compilation (D13) */
export type RecordingSourceFile = { path: string; sha256: string; text?: string };

export type RecordingSources = {
  compiler?: string;
  mainFile?: string;
  files: RecordingSourceFile[];
};

/** A medium, for display only (D14, D15) */
export type RecordingMedia = KliveStateMedia & { kind?: string };

/** A whole recording */
export type DebugRecording = {
  header: DebugRecordingHeader;
  thumbnail?: KliveStateThumbnail;
  /** Pool pages, each `header.pageSize` bytes */
  pages: Uint8Array[];
  keyframes: RecordingKeyframe[];
  journal: RecordingJournalEntry[];
  hits: RecordingHit[];
  ring?: RecordingRing;
  present: RecordingPresent;
  breakpoints?: RecordingBreakpoints;
  media: RecordingMedia[];
  sources?: RecordingSources;
  /** The `.kls` of the present (D16) */
  kls?: Uint8Array;
  note?: string;
};

/** What reading gives besides the recording */
export type DebugRecordingReadResult = DebugRecording & {
  /** Section sizes as stored, by tag */
  sectionSizes: Record<string, number>;
  unknownSections: string[];
};

export type DeflateLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ------------------------------------------------------------------------------------------------
// Bytes

/** A growing little-endian byte buffer */
export class ByteWriter {
  private buf = new Uint8Array(1024);
  private view = new DataView(this.buf.buffer);
  length = 0;

  private ensure(n: number): void {
    if (this.length + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  u8(v: number): void {
    this.ensure(1);
    this.buf[this.length++] = v & 0xff;
  }

  u32(v: number): void {
    this.ensure(4);
    this.view.setUint32(this.length, v >>> 0, true);
    this.length += 4;
  }

  /** An unsigned integer below 2^53, as two u32 */
  u64(v: number): void {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error(`Not a position sequence: ${v}`);
    this.u32(v % 0x1_0000_0000);
    this.u32(Math.floor(v / 0x1_0000_0000));
  }

  f64(v: number): void {
    this.ensure(8);
    this.view.setFloat64(this.length, v, true);
    this.length += 8;
  }

  /** An unsigned LEB128 below 2^53 */
  varuint(v: number): void {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error(`Not an unsigned integer: ${v}`);
    do {
      let byte = v % 128;
      v = Math.floor(v / 128);
      if (v) byte |= 0x80;
      this.u8(byte);
    } while (v);
  }

  bytes(b: Uint8Array): void {
    this.ensure(b.length);
    this.buf.set(b, this.length);
    this.length += b.length;
  }

  /** A length-prefixed UTF-8 string */
  string(s: string): void {
    const b = encoder.encode(s);
    this.varuint(b.length);
    this.bytes(b);
  }

  position(p: RecordingPosition): void {
    this.u64(p.sequence);
    this.varuint(p.sub);
    this.u8(p.phase);
  }

  toBytes(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

/** Reads what `ByteWriter` wrote */
export class ByteReader {
  private readonly view: DataView;
  offset = 0;

  constructor(
    private readonly buf: Uint8Array,
    private readonly what: string
  ) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  get done(): boolean {
    return this.offset >= this.buf.length;
  }

  private need(n: number): void {
    if (this.offset + n > this.buf.length) throw new Error(`The debug recording's ${this.what} section is truncated`);
  }

  u8(): number {
    this.need(1);
    return this.buf[this.offset++];
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  u64(): number {
    const lo = this.u32();
    const hi = this.u32();
    const v = hi * 0x1_0000_0000 + lo;
    if (!Number.isSafeInteger(v)) throw new Error(`The debug recording holds a position beyond 2^53 (T3)`);
    return v;
  }

  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }

  varuint(): number {
    let result = 0;
    let scale = 1;
    for (;;) {
      const byte = this.u8();
      result += (byte & 0x7f) * scale;
      if (!(byte & 0x80)) break;
      scale *= 128;
      if (scale > 2 ** 56) throw new Error(`The debug recording's ${this.what} section holds a bad number`);
    }
    return result;
  }

  bytes(n: number): Uint8Array {
    this.need(n);
    const out = this.buf.slice(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }

  string(): string {
    return decoder.decode(this.bytes(this.varuint()));
  }

  position(): RecordingPosition {
    return { sequence: this.u64(), sub: this.varuint(), phase: this.u8() };
  }
}

// ------------------------------------------------------------------------------------------------
// Section encodings

/** An export argument: a safe integer as a zigzag varint, anything else as a float */
function writeArg(w: ByteWriter, a: number): void {
  if (Number.isSafeInteger(a) && Math.abs(a) < 2 ** 52) {
    w.u8(0);
    w.varuint(a >= 0 ? a * 2 : -a * 2 - 1);
  } else {
    w.u8(1);
    w.f64(a);
  }
}

function readArg(r: ByteReader): number {
  const tag = r.u8();
  if (tag === 1) return r.f64();
  if (tag !== 0) throw new Error("The debug recording's JRNL section holds a bad argument");
  const z = r.varuint();
  return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
}

/** JRNL: the export names once (T2), then the entries */
export function encodeJournal(entries: readonly RecordingJournalEntry[]): Uint8Array {
  const names: string[] = [];
  const nameIndex = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === "call" && !nameIndex.has(e.exportName)) {
      nameIndex.set(e.exportName, names.length);
      names.push(e.exportName);
    }
  }
  const w = new ByteWriter();
  w.varuint(names.length);
  for (const n of names) w.string(n);
  w.varuint(entries.length);
  for (const e of entries) {
    w.position(e.position);
    if (e.kind === "call") {
      w.u8(0);
      w.varuint(nameIndex.get(e.exportName)!);
      w.varuint(e.args.length);
      for (const a of e.args) writeArg(w, a);
    } else if (e.bytes) {
      w.u8(1);
      w.u32(e.address);
      w.varuint(e.bytes.length);
      w.bytes(e.bytes);
    } else {
      w.u8(2);
      w.u32(e.address);
      w.varuint(e.length);
      w.u8(e.fill ?? 0);
    }
  }
  return w.toBytes();
}

export function decodeJournal(bytes: Uint8Array): RecordingJournalEntry[] {
  const r = new ByteReader(bytes, "JRNL");
  const names: string[] = [];
  for (let n = r.varuint(); n > 0; n--) names.push(r.string());
  const out: RecordingJournalEntry[] = [];
  for (let n = r.varuint(); n > 0; n--) {
    const position = r.position();
    const kind = r.u8();
    if (kind === 0) {
      const exportName = names[r.varuint()];
      if (exportName === undefined) throw new Error("The debug recording's JRNL section names an unknown export");
      const args: number[] = [];
      for (let a = r.varuint(); a > 0; a--) args.push(readArg(r));
      out.push({ kind: "call", position, exportName, args });
    } else if (kind === 1) {
      const address = r.u32();
      const bytes = r.bytes(r.varuint());
      out.push({ kind: "write", position, address, length: bytes.length, bytes });
    } else if (kind === 2) {
      const address = r.u32();
      const length = r.varuint();
      out.push({ kind: "write", position, address, length, fill: r.u8() });
    } else {
      throw new Error("The debug recording's JRNL section holds an unknown entry");
    }
  }
  return out;
}

/** KEYF: per keyframe its seed, frame, journal index, flags, page table and meta */
export function encodeKeyframes(keyframes: readonly RecordingKeyframe[], pageCount: number): Uint8Array {
  const w = new ByteWriter();
  w.varuint(keyframes.length);
  w.varuint(pageCount);
  for (const k of keyframes) {
    if (k.pages.length !== pageCount) throw new Error("A keyframe's page table does not cover the memory");
    w.position(k.seed.position);
    w.u8((k.complete ? 1 : 0) | (k.seed.newest ? 2 : 0));
    if (k.seed.newest) w.bytes(k.seed.newest.subarray(0, 64));
    w.f64(k.frame);
    w.varuint(k.journalIndex);
    // --- Page indices + 1 (so -1 is 0), as varints: deflate does the rest
    for (let p = 0; p < pageCount; p++) w.varuint(k.pages[p] + 1);
    w.string(k.meta === undefined ? "" : JSON.stringify(k.meta));
  }
  return w.toBytes();
}

export function decodeKeyframes(bytes: Uint8Array, pages: number): RecordingKeyframe[] {
  const r = new ByteReader(bytes, "KEYF");
  const count = r.varuint();
  const pageCount = r.varuint();
  const out: RecordingKeyframe[] = [];
  for (let i = 0; i < count; i++) {
    const position = r.position();
    const flags = r.u8();
    const newest = flags & 2 ? r.bytes(64) : undefined;
    const frame = r.f64();
    const journalIndex = r.varuint();
    const table = new Int32Array(pageCount);
    for (let p = 0; p < pageCount; p++) {
      const ref = r.varuint() - 1;
      if (ref >= pages) throw new Error("A keyframe in the debug recording refers to a page it does not hold");
      table[p] = ref;
    }
    const metaText = r.string();
    out.push({
      seed: { position, newest },
      frame,
      journalIndex,
      complete: (flags & 1) !== 0,
      pages: table,
      meta: metaText ? JSON.parse(metaText) : undefined
    });
  }
  return out;
}

/** PAGE: the count, the page size, then the pages */
export function encodePages(pages: readonly Uint8Array[], pageSize: number): Uint8Array {
  const out = new Uint8Array(8 + pages.length * pageSize);
  const v = new DataView(out.buffer);
  v.setUint32(0, pages.length, true);
  v.setUint32(4, pageSize, true);
  pages.forEach((p, i) => {
    if (p.length !== pageSize) throw new Error("A pool page has the wrong size");
    out.set(p, 8 + i * pageSize);
  });
  return out;
}

export function decodePages(bytes: Uint8Array, pageSize: number): Uint8Array[] {
  if (bytes.length < 8) throw new Error("The debug recording's PAGE section is truncated");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = v.getUint32(0, true);
  if (v.getUint32(4, true) !== pageSize) throw new Error("The debug recording's pages are not of its page size");
  if (8 + count * pageSize !== bytes.length) throw new Error("The debug recording's PAGE section is truncated");
  const out: Uint8Array[] = [];
  for (let i = 0; i < count; i++) out.push(bytes.slice(8 + i * pageSize, 8 + (i + 1) * pageSize));
  return out;
}

/** HITS: the storage keys once, then per hit a position and a key index */
export function encodeHits(hits: readonly RecordingHit[]): Uint8Array {
  const keys: string[] = [];
  const index = new Map<string, number>();
  for (const h of hits) {
    if (!index.has(h.key)) {
      index.set(h.key, keys.length);
      keys.push(h.key);
    }
  }
  const w = new ByteWriter();
  w.varuint(keys.length);
  for (const k of keys) w.string(k);
  w.varuint(hits.length);
  for (const h of hits) {
    w.position(h.position);
    w.varuint(index.get(h.key)!);
  }
  return w.toBytes();
}

export function decodeHits(bytes: Uint8Array): RecordingHit[] {
  const r = new ByteReader(bytes, "HITS");
  const keys: string[] = [];
  for (let n = r.varuint(); n > 0; n--) keys.push(r.string());
  const out: RecordingHit[] = [];
  for (let n = r.varuint(); n > 0; n--) {
    const position = r.position();
    const key = keys[r.varuint()];
    if (key === undefined) throw new Error("The debug recording's HITS section names an unknown breakpoint");
    out.push({ position, key });
  }
  return out;
}

export function encodeRing(ring: RecordingRing): Uint8Array {
  const w = new ByteWriter();
  const v = ring.view;
  for (const n of [v.count, v.writeIndex, v.newestLo, v.newestHi, v.generation]) w.u32(n);
  w.u32(ring.records.length);
  w.bytes(ring.records);
  return w.toBytes();
}

export function decodeRing(bytes: Uint8Array): RecordingRing {
  const r = new ByteReader(bytes, "RING");
  const view = { count: r.u32(), writeIndex: r.u32(), newestLo: r.u32(), newestHi: r.u32(), generation: r.u32() };
  return { view, records: r.bytes(r.u32()) };
}

// ------------------------------------------------------------------------------------------------
// The file

/** SHA-256 (the platform's: Web Crypto, in Node and in the renderer) */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SHA-256 is not available here");
  return new Uint8Array(await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
}

/** SHA-256 as hex */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return Array.from(await sha256(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (value: unknown) => encoder.encode(JSON.stringify(value));

/**
 * Writes a recording
 * @param recording The recording
 * @param level The deflate level of the bulk sections (D6)
 */
export async function writeDebugRecording(recording: DebugRecording, level: DeflateLevel = 6): Promise<Uint8Array> {
  const h = recording.header;
  const pageCount = Math.ceil(h.memorySize / h.pageSize);
  const sections: ContainerSection[] = [];
  const add = (tag: string, payload: Uint8Array) => sections.push({ tag, payload });
  const deflate = (bytes: Uint8Array) => deflateSync(bytes, { level });
  if (recording.thumbnail) add("THMB", encodeThumbnail(recording.thumbnail));
  add("PAGE", deflate(encodePages(recording.pages, h.pageSize)));
  add("KEYF", deflate(encodeKeyframes(recording.keyframes, pageCount)));
  add("JRNL", deflate(encodeJournal(recording.journal)));
  add("HITS", deflate(encodeHits(recording.hits)));
  if (recording.ring) add("RING", deflate(encodeRing(recording.ring)));
  add("PRES", json(recording.present));
  if (recording.breakpoints) add("BRKP", json(recording.breakpoints));
  add("MEDI", json(recording.media ?? []));
  if (recording.sources) {
    // --- The texts (with -sources) are deflated; the identity stays readable
    const { files, ...rest } = recording.sources;
    const texts = files.map((f) => f.text ?? null);
    add(
      "SRCS",
      json({
        ...rest,
        files: files.map(({ text: _t, ...f }) => f),
        texts: texts.some((t) => t !== null) ? Array.from(deflate(json(texts))) : undefined
      })
    );
  }
  if (recording.kls) add("KLS ", recording.kls);
  if (recording.note) add("NOTE", encoder.encode(recording.note));
  const body = concatBytes([
    encodeContainerStart(DEBUG_RECORDING_MAGIC, DEBUG_RECORDING_VERSION, h),
    ...sections.map((s) => encodeSection(s.tag, s.payload))
  ]);
  return concatBytes([body, encodeSection("END ", await sha256(body))]);
}

/** Does this look like a debug recording? */
export function hasDebugRecordingMagic(bytes: Uint8Array): boolean {
  return hasContainerMagic(bytes, DEBUG_RECORDING_MAGIC);
}

/**
 * Reads a recording
 * @param bytes The file
 * @param options `headerOnly`: the header, thumbnail, note, media, breakpoints and sources, without
 * inflating the timeline (the viewer); the END hash is still checked unless `skipHash`
 * @throws When the file is not a recording, is of another container version, is truncated, or its
 * END hash does not match
 */
export async function readDebugRecording(
  bytes: Uint8Array,
  options: { headerOnly?: boolean; skipHash?: boolean } = {}
): Promise<DebugRecordingReadResult> {
  if (!options.skipHash) {
    const container = readChunkedContainer<DebugRecordingHeader>(
      bytes,
      DEBUG_RECORDING_MAGIC,
      DEBUG_RECORDING_VERSION,
      "debug recording",
      "Not a Klive debug recording: the KLIVEREC header is missing"
    );
    const end = container.sections[container.sections.length - 1];
    if (!end || end.tag !== "END ") throw new Error("The debug recording is truncated: it has no END section");
    const expected = await sha256(bytes.subarray(0, end.offset));
    if (end.payload.length !== expected.length || end.payload.some((b, i) => b !== expected[i])) {
      throw new Error("The debug recording is damaged: its contents do not match its END hash");
    }
  }
  return parseDebugRecording(bytes, options);
}

/**
 * Reads a recording without checking its END hash (synchronous: the viewer); `readDebugRecording`
 * checks the hash first
 */
export function parseDebugRecording(bytes: Uint8Array, options: { headerOnly?: boolean } = {}): DebugRecordingReadResult {
  const container = readChunkedContainer<DebugRecordingHeader>(
    bytes,
    DEBUG_RECORDING_MAGIC,
    DEBUG_RECORDING_VERSION,
    "debug recording",
    "Not a Klive debug recording: the KLIVEREC header is missing"
  );
  const header = container.header;
  if (!header?.machineId || !header.coreId || !header.fingerprint || !header.pageSize || !header.memorySize) {
    throw new Error("The debug recording's header lacks the machine, core, fingerprint or sizes");
  }
  const end = container.sections[container.sections.length - 1];
  if (!end || end.tag !== "END ") throw new Error("The debug recording is truncated: it has no END section");
  const result: DebugRecordingReadResult = {
    header,
    pages: [],
    keyframes: [],
    journal: [],
    hits: [],
    present: { host: {}, frames: 0 },
    media: [],
    sectionSizes: {},
    unknownSections: []
  };
  const inflate = (tag: string, payload: Uint8Array) => {
    try {
      return inflateSync(payload);
    } catch (err) {
      throw new Error(`The debug recording's ${tag.trim()} section cannot be decompressed (${(err as Error).message})`);
    }
  };
  const parse = (tag: string, payload: Uint8Array) => {
    try {
      return JSON.parse(decoder.decode(payload));
    } catch {
      throw new Error(`The debug recording's ${tag.trim()} section is not valid`);
    }
  };
  const timeline = !options.headerOnly;
  let sawPages = false;
  let keyframeBytes: Uint8Array | undefined;
  for (const { tag, payload } of container.sections) {
    result.sectionSizes[tag.trim()] = payload.length;
    switch (tag) {
      case "THMB":
        result.thumbnail = decodeThumbnail(payload);
        break;
      case "PAGE":
        sawPages = true;
        if (timeline) result.pages = decodePages(inflate(tag, payload), header.pageSize);
        break;
      case "KEYF":
        if (timeline) keyframeBytes = inflate(tag, payload);
        break;
      case "JRNL":
        if (timeline) result.journal = decodeJournal(inflate(tag, payload));
        break;
      case "HITS":
        if (timeline) result.hits = decodeHits(inflate(tag, payload));
        break;
      case "RING":
        if (timeline) result.ring = decodeRing(inflate(tag, payload));
        break;
      case "PRES":
        result.present = parse(tag, payload);
        break;
      case "BRKP":
        result.breakpoints = parse(tag, payload);
        break;
      case "MEDI":
        result.media = parse(tag, payload);
        break;
      case "SRCS": {
        const s = parse(tag, payload) as RecordingSources & { texts?: number[] };
        const texts: (string | null)[] | undefined = s.texts
          ? parse(tag, inflate(tag, Uint8Array.from(s.texts)))
          : undefined;
        result.sources = {
          compiler: s.compiler,
          mainFile: s.mainFile,
          files: (s.files ?? []).map((f, i) => (texts?.[i] != null ? { ...f, text: texts[i]! } : f))
        };
        break;
      }
      case "KLS ":
        result.kls = payload.slice();
        break;
      case "NOTE":
        result.note = decoder.decode(payload);
        break;
      case "END ":
        break;
      default:
        result.unknownSections.push(tag.trim());
    }
  }
  if (!sawPages) throw new Error("The debug recording has no keyframe pages (PAGE section)");
  if (timeline) {
    result.keyframes = decodeKeyframes(keyframeBytes ?? new Uint8Array(0), result.pages.length);
    if (!result.keyframes.length) throw new Error("The debug recording has no keyframes");
  }
  return result;
}
