/*
 * The execution history's shapes as they cross the Emu API (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md`
 * §4.4). The records stay raw 64-byte blocks until `decodeHistoryRecord` reads them.
 */

/** The size of one record, and of the header, in bytes (`z80-history.c`) */
export const HISTORY_RECORD_SIZE = 64;
export const HISTORY_HEADER_SIZE = 64;

/** What the ring holds */
export type ExecutionHistoryInfo = {
  /** The machine whose context decoder reads the records (`historyMachineId`) */
  machineId: string;
  /** Records the ring can hold */
  capacity: number;
  /** Records it holds now */
  count: number;
  /** The newest record's sequence number; 0 when nothing was ever recorded */
  newestSequence: number;
  /** The oldest held record's sequence number (newest when empty) */
  oldestSequence: number;
  /** Bumped by every clear: a reader's caches are stale when it changes */
  generation: number;
  /** Whether the core records now (debug sessions only, D8) */
  enabled: boolean;
};

/** A run of consecutive records */
export type ExecutionHistoryPage = {
  info: ExecutionHistoryInfo;
  /** The sequence number of the first record in `records` */
  firstSequence: number;
  /** `count` records of `HISTORY_RECORD_SIZE` bytes, oldest first */
  records: Uint8Array;
  /** The requested start was overwritten before it could be read (trap T11) */
  gone: boolean;
};
