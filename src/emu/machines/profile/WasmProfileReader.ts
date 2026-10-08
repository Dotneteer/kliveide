import {
  PROFILE_EDGE_SIZE,
  PROFILE_ENTRY_SIZE,
  PROFILE_FRAME_SIZE,
  PROFILE_PAGE_SIZE,
  type ProfileCounts,
  type ProfileEdge,
  type ProfileEdgeKind,
  type ProfileInfo,
  type ProfileTouchedByte
} from "@common/profile/profileTypes";

/*
 * Reads the access profile of any WASM core (`src/emu/z80/wasm/z80-profile.c`,
 * `.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.2): the same exports on every core, and a header that
 * says where the flags, the page map and the counter pool are. The reader views them in place, as the
 * history reader views its ring.
 */

/** The exports every profiling core has (`scripts/z80-profile-exports.cjs`) */
export const Z80_PROFILE_CORE_EXPORTS = [
  "z80ProfileGetHeaderOffset",
  "z80ProfileGetFlagsOffset",
  "z80ProfileGetPageMapOffset",
  "z80ProfileGetPoolOffset",
  "z80ProfileSetEnabled",
  "z80ProfileReset",
  "z80ProfileMergeByte",
  "z80ProfileMergeTotals",
  "z80ProfileSetCalls",
  "z80ProfileArm",
  "z80ProfileGetEdgesOffset",
  "z80ProfileGetStackOffset"
] as const;

/** The profile's exports, as a core's export type includes them */
export type Z80ProfileCoreExports = {
  z80ProfileGetHeaderOffset(): number;
  z80ProfileGetFlagsOffset(): number;
  z80ProfileGetPageMapOffset(): number;
  z80ProfileGetPoolOffset(): number;
  z80ProfileSetEnabled(on: number, counters: number): void;
  z80ProfileReset(): void;
  z80ProfileMergeByte(phys: number, flags: number, exec: number, read: number, write: number, timeLo: number, timeHi: number): void;
  z80ProfileMergeTotals(instructionsLo: number, instructionsHi: number, timeLo: number, timeHi: number): void;
  z80ProfileSetCalls(on: number): void;
  z80ProfileArm(start: number, stop: number): void;
  z80ProfileGetEdgesOffset(): number;
  z80ProfileGetStackOffset(): number;
};

/** What the reader needs of a core */
export type WasmProfileExports = Z80ProfileCoreExports & { readonly memory: WebAssembly.Memory };

/** Whether a core's exports include the profile (a core built before it does not) */
export function hasProfileExports(exports: unknown): exports is WasmProfileExports {
  const e = exports as Partial<Record<string, unknown>> | undefined;
  return !!e && Z80_PROFILE_CORE_EXPORTS.every((name) => typeof e[name] === "function");
}

/** "KPRF" */
export const PROFILE_MAGIC = 0x4652504b;
export const PROFILE_VERSION = 2;

/** The header's field offsets (`Z80ProfileHeader`) */
const H_MAGIC = 0;
const H_VERSION = 4;
const H_ENTRY_SIZE = 6;
const H_ENABLED = 8;
const H_COUNTERS = 9;
const H_MUTED = 10;
const H_FLAG_BYTES = 12;
const H_POOL_PAGES = 16;
const H_PAGES_USED = 20;
const H_PAGES_DROPPED = 24;
const H_FIRST_DROPPED = 28;
const H_TIME_INT = 32;
const H_TIME_NMI = 40;
const H_TIME_DMA = 48;
const H_TIME_SNOOZE = 56;
const H_TIME_HALT = 64;
const H_TIME_TOTAL = 72;
const H_INSTRUCTIONS = 80;
const H_GENERATION = 88;
const H_FLAGS_OFFSET = 100;
const H_PAGE_MAP_OFFSET = 104;
const H_POOL_OFFSET = 108;
const H_PAGE_MAP_ENTRIES = 112;
// --- The call tracker (version 2, `.plans/PROFILER_PLAN.md` §4.2)
const H_CALLS_ON = 11;
const H_STACK_RESYNCS = 116;
const H_DEPTH_OVERFLOWS = 120;
const H_EDGES_DROPPED = 124;
const H_EDGES_OFFSET = 128;
const H_EDGE_CAPACITY = 132;
const H_EDGES_USED = 136;
const H_STACK_OFFSET = 140;
const H_DEPTH = 148;
const H_CALLS = 152;
const H_INTERRUPTS = 160;
const H_ARMED_START = 168;
const H_ARMED_STOP = 172;
const H_WINDOW_CLOSED = 176;

/** Edge field offsets (`Z80ProfileEdge`) */
const G_CALLER = 0;
const G_CALLEE = 4;
const G_CALLS = 8;
const G_CALLEE_ADDR = 12;
const G_KIND = 14;
const G_INCLUSIVE = 16;
const G_EXCLUSIVE = 24;

/** Frame field offsets (`Z80ProfileFrame`) */
const F_EDGE = 4;
const F_START = 8;
const F_CHILD = 16;
const F_EXCLUDED = 24;
const F_IS_INT = 36;
const F_NESTED = 37;

const EDGE_KINDS: Record<number, ProfileEdgeKind> = { 1: "call", 2: "rst", 3: "int", 4: "im2", 5: "nmi" };
const NONE = 0xffffffff;

/** A page map entry for a page that found the pool full */
const PAGE_DROPPED = 0xffff;

/** Entry field offsets */
const E_EXEC = 0;
const E_READ = 4;
const E_WRITE = 8;
const E_TIME = 16;

export class WasmProfileReader {
  private readonly headerOffset: number;

  /**
   * @param exports The core's exports
   * @param machineId The machine whose layout names the offsets
   * @param timeUnit What the core's time counts in (D8)
   */
  constructor(
    private readonly exports: WasmProfileExports,
    readonly machineId: string,
    readonly timeUnit = "T-states"
  ) {
    this.headerOffset = exports.z80ProfileGetHeaderOffset();
    const view = this.view();
    if (view.getUint32(this.headerOffset + H_MAGIC, true) !== PROFILE_MAGIC) {
      throw new Error("The core's access-profile header is missing its magic number.");
    }
    if (view.getUint16(this.headerOffset + H_VERSION, true) !== PROFILE_VERSION) {
      throw new Error("The core's access-profile format has an unknown version.");
    }
    if (view.getUint16(this.headerOffset + H_ENTRY_SIZE, true) !== PROFILE_ENTRY_SIZE) {
      throw new Error("The core's access-profile entries have an unexpected size.");
    }
  }

  /** What the profile holds now */
  info(): ProfileInfo {
    const v = this.view();
    const o = this.headerOffset;
    const firstDropped = v.getUint32(o + H_FIRST_DROPPED, true);
    return {
      machineId: this.machineId,
      enabled: v.getUint8(o + H_ENABLED) !== 0,
      counters: v.getUint8(o + H_COUNTERS) !== 0,
      muted: v.getUint8(o + H_MUTED) !== 0,
      flagBytes: v.getUint32(o + H_FLAG_BYTES, true),
      poolPages: v.getUint32(o + H_POOL_PAGES, true),
      pagesUsed: v.getUint32(o + H_PAGES_USED, true),
      pagesDropped: v.getUint32(o + H_PAGES_DROPPED, true),
      firstDroppedPage: firstDropped === 0xffffffff ? -1 : firstDropped,
      timeIntAck: u64(v, o + H_TIME_INT),
      timeNmiAck: u64(v, o + H_TIME_NMI),
      timeDma: u64(v, o + H_TIME_DMA),
      timeSnooze: u64(v, o + H_TIME_SNOOZE),
      timeHalt: u64(v, o + H_TIME_HALT),
      timeTotal: u64(v, o + H_TIME_TOTAL),
      instructions: u64(v, o + H_INSTRUCTIONS),
      generation: v.getUint32(o + H_GENERATION, true),
      timeUnit: this.timeUnit,
      callsOn: v.getUint8(o + H_CALLS_ON) !== 0,
      depth: v.getUint32(o + H_DEPTH, true),
      stackResyncs: v.getUint32(o + H_STACK_RESYNCS, true),
      depthOverflows: v.getUint32(o + H_DEPTH_OVERFLOWS, true),
      edgesDropped: v.getUint32(o + H_EDGES_DROPPED, true),
      edgesUsed: v.getUint32(o + H_EDGES_USED, true),
      edgeCapacity: v.getUint32(o + H_EDGE_CAPACITY, true),
      calls: u64(v, o + H_CALLS),
      interrupts: u64(v, o + H_INTERRUPTS),
      armedStart: marker(v.getUint32(o + H_ARMED_START, true)),
      armedStop: marker(v.getUint32(o + H_ARMED_STOP, true)),
      windowClosed: v.getUint32(o + H_WINDOW_CLOSED, true)
    };
  }

  /** Turns the call tracker on or off (D1); on starts an empty stack, off closes the open frames */
  setCalls(on: boolean): void {
    this.exports.z80ProfileSetCalls(on ? 1 : 0);
  }

  /**
   * Arms the profiling window (D2): counting waits for the first instruction at `start`; profiling
   * stops at the next instruction at `stop` after that. Undefined disarms a marker.
   */
  arm(start: number | undefined, stop: number | undefined): void {
    this.exports.z80ProfileArm(start === undefined ? NONE : start & 0xffff, stop === undefined ? NONE : stop & 0xffff);
  }

  /**
   * The call graph's edges (G5.4), with the frames still open folded in as if they returned now:
   * a profile stopped inside a routine (D1 freezes it) still shows that routine's time so far. The
   * fold follows the core's own pop: an open interrupt's time is excluded from what it interrupted
   * (D11), and recursion counts inclusive time once (D12).
   */
  edges(): ProfileEdge[] {
    const v = this.view();
    const o = this.headerOffset;
    const edgesOffset = v.getUint32(o + H_EDGES_OFFSET, true);
    const capacity = v.getUint32(o + H_EDGE_CAPACITY, true);
    const bySlot = new Map<number, ProfileEdge>();
    for (let slot = 0; slot < capacity; slot++) {
      const e = edgesOffset + slot * PROFILE_EDGE_SIZE;
      const calls = v.getUint32(e + G_CALLS, true);
      if (calls === 0) continue;
      bySlot.set(slot, {
        caller: v.getUint32(e + G_CALLER, true),
        callee: v.getUint32(e + G_CALLEE, true),
        calleeAddress: v.getUint16(e + G_CALLEE_ADDR, true),
        kind: EDGE_KINDS[v.getUint8(e + G_KIND)] ?? "call",
        calls,
        inclusive: u64(v, e + G_INCLUSIVE),
        exclusive: u64(v, e + G_EXCLUSIVE)
      });
    }
    // --- The open frames, newest first, as `z80ProfileCallPop` would close them now
    const depth = v.getUint32(o + H_DEPTH, true);
    const stack = v.getUint32(o + H_STACK_OFFSET, true);
    const now = u64(v, o + H_TIME_TOTAL);
    let pendingChild = 0;
    let pendingExcluded = 0;
    for (let i = depth - 1; i >= 0; i--) {
      const f = stack + i * PROFILE_FRAME_SIZE;
      const excluded = u64(v, f + F_EXCLUDED) + pendingExcluded;
      const spent = Math.max(0, now - u64(v, f + F_START));
      const inclusive = Math.max(0, spent - excluded);
      const exclusive = Math.max(0, inclusive - (u64(v, f + F_CHILD) + pendingChild));
      const edge = bySlot.get(v.getUint32(f + F_EDGE, true));
      if (edge) {
        if (v.getUint8(f + F_NESTED) === 0) edge.inclusive += inclusive;
        edge.exclusive += exclusive;
        edge.open = (edge.open ?? 0) + 1;
      }
      if (v.getUint8(f + F_IS_INT) !== 0) {
        pendingChild = 0;
        pendingExcluded = excluded + inclusive;
      } else {
        pendingChild = inclusive;
        pendingExcluded = excluded;
      }
    }
    return [...bySlot.values()];
  }

  /** Turns profiling on or off; `counters` keeps the counter pool too (D2) */
  setEnabled(enabled: boolean, counters = true): void {
    this.exports.z80ProfileSetEnabled(enabled ? 1 : 0, counters ? 1 : 0);
  }

  /** Clears every flag, counter and time bucket; the generation moves on */
  reset(): void {
    this.exports.z80ProfileReset();
  }

  /**
   * Merges a saved run into the profile (D16): flags OR-ed, counters and time added
   * @param bytes The saved run's touched bytes
   * @param totals Its instruction count and total time
   */
  merge(bytes: readonly ProfileTouchedByte[], totals: { instructions: number; timeTotal: number }): void {
    for (const b of bytes) {
      const time = b.time ?? 0;
      this.exports.z80ProfileMergeByte(
        b.offset,
        b.flags,
        b.exec ?? 0,
        b.read ?? 0,
        b.write ?? 0,
        time % 0x1_0000_0000,
        Math.floor(time / 0x1_0000_0000)
      );
    }
    this.exports.z80ProfileMergeTotals(
      totals.instructions % 0x1_0000_0000,
      Math.floor(totals.instructions / 0x1_0000_0000),
      totals.timeTotal % 0x1_0000_0000,
      Math.floor(totals.timeTotal / 0x1_0000_0000)
    );
  }

  /** A copy of the flags of `length` bytes from `start` (clipped to the core's span) */
  flags(start: number, length: number): Uint8Array {
    const { from, to } = this.clip(start, length);
    const out = new Uint8Array(Math.max(0, length));
    if (to > from) out.set(this.flagView().subarray(from, to), from - start);
    return out;
  }

  /** The flag byte of one offset */
  flagAt(offset: number): number {
    const span = this.flagBytes();
    return offset >= 0 && offset < span ? this.flagView()[offset] : 0;
  }

  /** The counters of `length` bytes from `start`; a byte whose page has none reads 0 and is not `counted` */
  counts(start: number, length: number): ProfileCounts {
    const n = Math.max(0, length);
    const result: ProfileCounts = {
      start,
      exec: new Uint32Array(n),
      read: new Uint32Array(n),
      write: new Uint32Array(n),
      time: new Float64Array(n),
      counted: new Uint8Array(n)
    };
    const { from, to } = this.clip(start, length);
    if (to <= from) return result;
    const v = this.view();
    const pageMap = this.pageMapView();
    const pool = this.poolOffset();
    let offset = from;
    while (offset < to) {
      const page = Math.floor(offset / PROFILE_PAGE_SIZE);
      const pageEnd = Math.min(to, (page + 1) * PROFILE_PAGE_SIZE);
      const slot = pageMap[page];
      if (slot !== 0 && slot !== PAGE_DROPPED) {
        const base = pool + (slot - 1) * PROFILE_PAGE_SIZE * PROFILE_ENTRY_SIZE;
        for (let o = offset; o < pageEnd; o++) {
          const e = base + (o % PROFILE_PAGE_SIZE) * PROFILE_ENTRY_SIZE;
          const i = o - start;
          result.exec[i] = v.getUint32(e + E_EXEC, true);
          result.read[i] = v.getUint32(e + E_READ, true);
          result.write[i] = v.getUint32(e + E_WRITE, true);
          result.time[i] = u64(v, e + E_TIME);
          result.counted[i] = 1;
        }
      }
      offset = pageEnd;
    }
    return result;
  }

  /**
   * Every byte with a flag set, in offset order, with its counters where its page has them: the
   * exports and the self-modifying-code report read this
   * @param mask Only bytes with one of these flags (all touched bytes by default)
   */
  touched(mask = 0xff): ProfileTouchedByte[] {
    const flags = this.flagView();
    const span = this.flagBytes();
    const v = this.view();
    const pageMap = this.pageMapView();
    const pool = this.poolOffset();
    const result: ProfileTouchedByte[] = [];
    for (let page = 0; page * PROFILE_PAGE_SIZE < span; page++) {
      const from = page * PROFILE_PAGE_SIZE;
      const to = Math.min(span, from + PROFILE_PAGE_SIZE);
      const slot = pageMap[page];
      const base = slot !== 0 && slot !== PAGE_DROPPED ? pool + (slot - 1) * PROFILE_PAGE_SIZE * PROFILE_ENTRY_SIZE : -1;
      for (let o = from; o < to; o++) {
        const f = flags[o];
        if ((f & mask) === 0) continue;
        if (base < 0) {
          result.push({ offset: o, flags: f });
        } else {
          const e = base + (o - from) * PROFILE_ENTRY_SIZE;
          result.push({
            offset: o,
            flags: f,
            exec: v.getUint32(e + E_EXEC, true),
            read: v.getUint32(e + E_READ, true),
            write: v.getUint32(e + E_WRITE, true),
            time: u64(v, e + E_TIME)
          });
        }
      }
    }
    return result;
  }

  private clip(start: number, length: number): { from: number; to: number } {
    const span = this.flagBytes();
    return { from: Math.max(0, start), to: Math.min(span, start + Math.max(0, length)) };
  }

  private view(): DataView {
    return new DataView(this.exports.memory.buffer);
  }

  private flagBytes(): number {
    return this.view().getUint32(this.headerOffset + H_FLAG_BYTES, true);
  }

  private flagView(): Uint8Array {
    const v = this.view();
    return new Uint8Array(this.exports.memory.buffer, v.getUint32(this.headerOffset + H_FLAGS_OFFSET, true), this.flagBytes());
  }

  private pageMapView(): Uint16Array {
    const v = this.view();
    return new Uint16Array(
      this.exports.memory.buffer,
      v.getUint32(this.headerOffset + H_PAGE_MAP_OFFSET, true),
      v.getUint32(this.headerOffset + H_PAGE_MAP_ENTRIES, true)
    );
  }

  private poolOffset(): number {
    return this.view().getUint32(this.headerOffset + H_POOL_OFFSET, true);
  }
}

/** An armed-window marker: -1 when not armed */
function marker(value: number): number {
  return value === NONE ? -1 : value;
}

/** A little-endian u64 as a number (exact up to 2^53) */
function u64(v: DataView, offset: number): number {
  return v.getUint32(offset + 4, true) * 0x1_0000_0000 + v.getUint32(offset, true);
}
