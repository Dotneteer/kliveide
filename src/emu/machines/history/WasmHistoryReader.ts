import {
  HISTORY_RECORD_SIZE,
  type ExecutionHistoryInfo,
  type ExecutionHistoryPage
} from "@common/history/historyTypes";

/*
 * Reads the execution-history ring of any WASM core (`src/emu/z80/wasm/z80-history.c`,
 * `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` D11): the same three exports on every core, and a
 * header that says everything else.
 *
 * Reads are by sequence number. The ring overwrites its oldest record, so a sequence the caller
 * learnt from an earlier `info()` may be gone by the time it asks for it: then the page says so
 * rather than handing back the newer record in that slot (trap T11).
 */

/** The exports every history-recording core has (`scripts/z80-history-exports.cjs`) */
export const Z80_HISTORY_CORE_EXPORTS = [
  "z80HistoryGetHeaderOffset",
  "z80HistorySetEnabled",
  "z80HistoryClear"
] as const;

/** The recorder's exports, as a core's export type includes them */
export type Z80HistoryCoreExports = {
  z80HistoryGetHeaderOffset(): number;
  z80HistorySetEnabled(enabled: number): void;
  z80HistoryClear(): void;
};

/** What the reader needs of a core */
export type WasmHistoryExports = Z80HistoryCoreExports & { readonly memory: WebAssembly.Memory };

/** "KHST" */
export const HISTORY_MAGIC = 0x5453484b;
export const HISTORY_VERSION = 1;

/** The header's field offsets (`Z80HistoryHeader`) */
const H_MAGIC = 0;
const H_VERSION = 4;
const H_RECORD_SIZE = 6;
const H_CAPACITY = 8;
const H_ENABLED = 12;
const H_COUNT = 16;
const H_WRITE_INDEX = 20;
const H_NEWEST_LO = 24;
const H_NEWEST_HI = 28;
const H_GENERATION = 32;
const H_RING_OFFSET = 36;

type RawHeader = ExecutionHistoryInfo & { writeIndex: number; ringOffset: number };

export class WasmHistoryReader {
  private readonly headerOffset: number;

  /**
   * @param exports The core's exports
   * @param machineId The machine whose context decoder reads the records
   */
  constructor(
    private readonly exports: WasmHistoryExports,
    readonly machineId: string
  ) {
    this.headerOffset = exports.z80HistoryGetHeaderOffset();
    const view = this.view();
    if (view.getUint32(this.headerOffset + H_MAGIC, true) !== HISTORY_MAGIC) {
      throw new Error("The core's execution-history header is missing its magic number.");
    }
    if (view.getUint16(this.headerOffset + H_VERSION, true) !== HISTORY_VERSION) {
      throw new Error("The core's execution-history format has an unknown version.");
    }
    if (view.getUint16(this.headerOffset + H_RECORD_SIZE, true) !== HISTORY_RECORD_SIZE) {
      throw new Error("The core's execution-history records have an unexpected size.");
    }
  }

  /** What the ring holds now */
  info(): ExecutionHistoryInfo {
    const { writeIndex: _w, ringOffset: _r, ...info } = this.header();
    return info;
  }

  /**
   * Copies up to `count` consecutive records starting at `fromSequence`. A start older than the
   * oldest record held is "gone": the page then starts at the oldest record instead.
   */
  read(fromSequence: number, count: number): ExecutionHistoryPage {
    const header = this.header();
    const { writeIndex: _w, ringOffset: _r, ...info } = header;
    if (header.count === 0 || count <= 0 || fromSequence > header.newestSequence) {
      return { info, firstSequence: fromSequence, records: new Uint8Array(0), gone: false };
    }
    const gone = fromSequence < header.oldestSequence;
    const first = gone ? header.oldestSequence : fromSequence;
    const n = Math.min(count, header.newestSequence - first + 1);
    const records = new Uint8Array(n * HISTORY_RECORD_SIZE);
    const all = new Uint8Array(this.exports.memory.buffer);
    const mask = header.capacity - 1;
    const newestSlot = (header.writeIndex - 1) & mask;
    let slot = (newestSlot - (header.newestSequence - first)) & mask;
    let written = 0;
    while (written < n) {
      // --- Copy the longest stretch before the ring wraps in one go
      const run = Math.min(n - written, header.capacity - slot);
      const from = header.ringOffset + slot * HISTORY_RECORD_SIZE;
      records.set(all.subarray(from, from + run * HISTORY_RECORD_SIZE), written * HISTORY_RECORD_SIZE);
      written += run;
      slot = (slot + run) & mask;
    }
    return { info, firstSequence: first, records, gone };
  }

  /** Empties the ring; the generation moves on */
  clear(): void {
    this.exports.z80HistoryClear();
  }

  /** Turns recording on or off */
  setEnabled(enabled: boolean): void {
    this.exports.z80HistorySetEnabled(enabled ? 1 : 0);
  }

  private view(): DataView {
    return new DataView(this.exports.memory.buffer);
  }

  private header(): RawHeader {
    const v = this.view();
    const o = this.headerOffset;
    const count = v.getUint32(o + H_COUNT, true);
    const newestSequence = v.getUint32(o + H_NEWEST_HI, true) * 0x1_0000_0000 + v.getUint32(o + H_NEWEST_LO, true);
    return {
      machineId: this.machineId,
      capacity: v.getUint32(o + H_CAPACITY, true),
      count,
      newestSequence,
      oldestSequence: count === 0 ? newestSequence : newestSequence - count + 1,
      generation: v.getUint32(o + H_GENERATION, true),
      enabled: v.getUint32(o + H_ENABLED, true) !== 0,
      writeIndex: v.getUint32(o + H_WRITE_INDEX, true),
      ringOffset: v.getUint32(o + H_RING_OFFSET, true)
    };
  }
}
