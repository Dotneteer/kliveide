/*
 * Timeline positions over the execution-history recorder (`.plans/REVERSE_DEBUGGING_PLAN.md` D3, D4,
 * T6). Phase 0 spike: used by the spike's tests and measurements only, not by the IDE.
 *
 * A position is `(sequence, sub, phase)`: the newest history record's sequence, the units it holds
 * (its repeat count - HALTed cycles, forced NOPs, DMA-hold T-states coalesce into one record) and
 * how far into a prefixed instruction the CPU is. The recorder counts every instruction-boundary
 * event on every core, so a position names one instant of the instruction stream on every core,
 * including a mid-HALT frame boundary and a frame that ends between the cycles of `ED 78`.
 */

/** The recorder's position exports, the same in every core (`z80-history.c`) */
export interface HistoryPositionExports {
  memory: WebAssembly.Memory;
  z80HistoryGetHeaderOffset(): number;
  z80HistorySetEnabled(enabled: number): void;
  z80HistorySetTarget(sequenceLo: number, sequenceHi: number, sub: number, phase: number): void;
  z80HistoryClearTarget(): void;
  z80HistoryGetSub(): number;
  z80HistoryGetPhase(): number;
  z80HistorySetPosition(sequenceLo: number, sequenceHi: number, hasRecord: number): void;
  z80HistoryRewind(sequenceLo: number, sequenceHi: number): number;
  z80HistorySetVerify(on: number): void;
  z80HistoryCheckStop(): number;
}

/** The ring header's view of the history: which records it says it holds (the present's, say) */
export type RingView = { count: number; writeIndex: number; newestLo: number; newestHi: number; generation: number };

/** The ring and its header as they were at a moment: what navigation puts back */
export type RingSnapshot = { view: RingView; records: Uint8Array };

/** A point of the instruction stream */
export type TimelinePosition = {
  /** The newest record's sequence (below 2^53) */
  sequence: number;
  /** The units the newest record holds; 0 when the ring holds no record */
  sub: number;
  /**
   * How far into a prefixed instruction the CPU is: 0 at an instruction boundary, 1 after a
   * CB/ED/DD/FD prefix, 2 after DD CB / FD CB. A frame can end, and a debugger step can stop, between
   * the cycles of one instruction (record); within a record the phases come as 1, 2, then 0.
   */
  phase: number;
};

/** What a keyframe needs to put the recorder back where it was (T6) */
export type PositionSeed = {
  position: TimelinePosition;
  /** The newest record (64 bytes), or undefined when the ring was empty */
  newest?: Uint8Array;
};

const RECORD_SIZE = 64;
const H_ENABLED = 12;
const H_COUNT = 16;
const H_WRITE_INDEX = 20;
const H_NEWEST_LO = 24;
const H_NEWEST_HI = 28;
const H_CAPACITY = 8;
const H_RING_OFFSET = 36;
const H_GENERATION = 32;
const H_STOP_STATE = 52;
const H_VERIFY_STATE = 60;
const STOP_REACHED = 0x02;
const VERIFY_MISMATCH = 0x02;

/** A phase's place within its record: the boundary (0) comes after the prefix phases */
function phaseOrder(phase: number): number {
  return phase === 0 ? 3 : phase;
}

/** Orders two positions */
export function comparePositions(a: TimelinePosition, b: TimelinePosition): number {
  if (a.sequence !== b.sequence) return a.sequence - b.sequence;
  if (a.sub !== b.sub) return a.sub - b.sub;
  return phaseOrder(a.phase) - phaseOrder(b.phase);
}

/** The instruction boundary a given number of records later (the record's first unit) */
export function positionAfter(p: TimelinePosition, records: number): TimelinePosition {
  return records <= 0 ? p : { sequence: p.sequence + records, sub: 1, phase: 0 };
}

/** Reads and steers a core's recorder position */
export class HistoryPositionPort {
  private readonly headerOffset: number;

  constructor(private readonly exports: HistoryPositionExports) {
    this.headerOffset = exports.z80HistoryGetHeaderOffset();
  }

  private get view(): DataView {
    return new DataView(this.exports.memory.buffer);
  }

  private u32(offset: number): number {
    return this.view.getUint32(this.headerOffset + offset, true);
  }

  get enabled(): boolean {
    return this.u32(H_ENABLED) !== 0;
  }

  setEnabled(on: boolean): void {
    this.exports.z80HistorySetEnabled(on ? 1 : 0);
  }

  /** The current position */
  get position(): TimelinePosition {
    const sequence = this.u32(H_NEWEST_HI) * 0x1_0000_0000 + this.u32(H_NEWEST_LO);
    return { sequence, sub: this.exports.z80HistoryGetSub(), phase: this.exports.z80HistoryGetPhase() };
  }

  /** Arms the core's stop target: a fast frame returns once the position reaches it */
  setTarget(p: TimelinePosition): void {
    this.exports.z80HistorySetTarget(p.sequence >>> 0, Math.floor(p.sequence / 0x1_0000_0000) >>> 0, p.sub >>> 0, p.phase >>> 0);
  }

  clearTarget(): void {
    this.exports.z80HistoryClearTarget();
  }

  /** The armed target has been reached (the frame loop noticed it) */
  get targetReached(): boolean {
    return (this.u32(H_STOP_STATE) & STOP_REACHED) !== 0;
  }

  /** What a keyframe records about the recorder */
  captureSeed(): PositionSeed {
    const position = this.position;
    if (this.u32(H_COUNT) === 0) return { position };
    const capacity = this.u32(H_CAPACITY);
    const slot = (this.u32(H_WRITE_INDEX) - 1 + capacity) % capacity;
    const at = this.u32(H_RING_OFFSET) + slot * RECORD_SIZE;
    return { position, newest: new Uint8Array(this.exports.memory.buffer, at, RECORD_SIZE).slice() };
  }

  /**
   * Puts the recorder at a keyframe's position. When the ring still holds that point it is rewound,
   * so the later records stay for a verifying replay to compare with (D9); otherwise it restarts
   * with the keyframe's newest record as its only one (T6).
   * @returns true when the ring was rewound
   */
  moveTo(seed: PositionSeed): boolean {
    const s = seed.position.sequence;
    if (this.exports.z80HistoryRewind(s >>> 0, Math.floor(s / 0x1_0000_0000) >>> 0) === 0) {
      this.reseed(seed);
      return false;
    }
    // --- The record as it was at the keyframe: its repeat count may have grown since
    if (seed.newest) {
      const capacity = this.u32(H_CAPACITY);
      const slot = (this.u32(H_WRITE_INDEX) - 1 + capacity) % capacity;
      new Uint8Array(this.exports.memory.buffer, this.u32(H_RING_OFFSET) + slot * RECORD_SIZE, RECORD_SIZE).set(seed.newest);
    }
    return true;
  }

  /**
   * What the ring header says it holds. A navigation replay rewinds the ring; putting the present's
   * view back afterwards keeps the history document and G4.3's walkers on the whole recorded run -
   * the records after the replay point are still in their slots, and the ones before it were rewritten
   * byte for byte (`.plans/REVERSE_DEBUGGING_PLAN.md` D17, Phase 4).
   */
  captureView(): RingView {
    return {
      count: this.u32(H_COUNT),
      writeIndex: this.u32(H_WRITE_INDEX),
      newestLo: this.u32(H_NEWEST_LO),
      newestHi: this.u32(H_NEWEST_HI),
      generation: this.u32(H_GENERATION)
    };
  }

  restoreView(view: RingView): void {
    const v = this.view;
    v.setUint32(this.headerOffset + H_COUNT, view.count, true);
    v.setUint32(this.headerOffset + H_WRITE_INDEX, view.writeIndex, true);
    v.setUint32(this.headerOffset + H_NEWEST_LO, view.newestLo, true);
    v.setUint32(this.headerOffset + H_NEWEST_HI, view.newestHi, true);
    v.setUint32(this.headerOffset + H_GENERATION, view.generation, true);
  }

  /**
   * The whole ring and its header. A navigation replay rewrites the ring - and when it starts from a
   * keyframe older than the oldest record the ring holds, it restarts the ring and its records land in
   * other slots - so navigation puts the present's ring back afterwards.
   */
  snapshotRing(): RingSnapshot {
    const bytes = this.u32(H_CAPACITY) * RECORD_SIZE;
    return {
      view: this.captureView(),
      records: new Uint8Array(this.exports.memory.buffer, this.u32(H_RING_OFFSET), bytes).slice()
    };
  }

  restoreRing(snapshot: RingSnapshot): void {
    new Uint8Array(this.exports.memory.buffer, this.u32(H_RING_OFFSET), snapshot.records.length).set(snapshot.records);
    this.restoreView(snapshot.view);
  }

  /** Rewinds the ring to a sequence it holds (the machine's real position before it runs again) */
  rewindTo(sequence: number): boolean {
    return this.exports.z80HistoryRewind(sequence >>> 0, Math.floor(sequence / 0x1_0000_0000) >>> 0) !== 0;
  }

  /** A held record's repeat count (the units it ended with), or undefined when the ring does not hold it */
  recordRepeat(sequence: number): number | undefined {
    const count = this.u32(H_COUNT);
    const newest = this.u32(H_NEWEST_HI) * 0x1_0000_0000 + this.u32(H_NEWEST_LO);
    const back = newest - sequence;
    if (back < 0 || back >= count) return undefined;
    const capacity = this.u32(H_CAPACITY);
    const slot = (this.u32(H_WRITE_INDEX) - 1 - back + capacity * 2) % capacity;
    return this.view.getUint16(this.u32(H_RING_OFFSET) + slot * RECORD_SIZE + 14, true);
  }

  /** Turns replay verification on or off; turning it on clears a reported mismatch (D9) */
  setVerify(on: boolean): void {
    this.exports.z80HistorySetVerify(on ? 1 : 0);
  }

  /** A verifying replay met a record that disagrees with the recorded run */
  get verifyMismatch(): boolean {
    return (this.u32(H_VERIFY_STATE) & VERIFY_MISMATCH) !== 0;
  }

  /** Restarts the ring at a keyframe's position, its newest record the only one (T6) */
  reseed(seed: PositionSeed): void {
    if (seed.newest) {
      new Uint8Array(this.exports.memory.buffer, this.u32(H_RING_OFFSET), RECORD_SIZE).set(seed.newest);
    }
    const s = seed.position.sequence;
    this.exports.z80HistorySetPosition(s >>> 0, Math.floor(s / 0x1_0000_0000) >>> 0, seed.newest ? 1 : 0);
  }
}
