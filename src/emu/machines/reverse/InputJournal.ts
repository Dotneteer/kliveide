/*
 * The input journal (`.plans/REVERSE_DEBUGGING_PLAN.md` D7, D8, T1): everything the host fed into a
 * core during a timeline, in order, each with the position it arrived at. `JournalingExports.ts`
 * fills it; replay applies it.
 *
 * Two kinds of entry: a call into a `journaled` export (`exportContract.ts`), and a write the host made
 * straight into the core's memory (`coreMemoryWrites.ts`).
 */

import type { TimelinePosition } from "./timelinePosition";

/** A call into a journaled export */
export type JournalCallEntry = {
  readonly kind: "call";
  readonly position: TimelinePosition;
  readonly exportName: string;
  readonly args: readonly number[];
};

/** Bytes the host wrote into the core's memory (`bytes`), or a fill of `length` bytes with `fill` */
export type JournalWriteEntry = {
  readonly kind: "write";
  readonly position: TimelinePosition;
  readonly address: number;
  readonly length: number;
  readonly bytes?: Uint8Array;
  readonly fill?: number;
};

export type JournalEntry = JournalCallEntry | JournalWriteEntry;

/**
 * - `record`: live input reaches the core and is journaled;
 * - `mute`: a replay runs, so live input is dropped and the journal supplies the input (D8).
 */
export type JournalMode = "record" | "mute";

/** The host's input to a core, in order */
export class InputJournal {
  readonly entries: JournalEntry[] = [];
  mode: JournalMode = "record";
  /** Live calls and writes dropped while muted (the status bar's "input ignored", D12) */
  dropped = 0;

  get length(): number {
    return this.entries.length;
  }

  append(entry: JournalEntry): void {
    this.entries.push(entry);
  }

  /** Drops the entries from `index` on (a fork discards the future, D12) */
  truncate(index: number): void {
    this.entries.length = Math.max(0, Math.min(this.entries.length, index));
  }

  /** The bytes the journal holds (for the budget display) */
  get byteSize(): number {
    let size = 0;
    for (const e of this.entries) size += e.kind === "write" ? 32 + (e.bytes?.length ?? 0) : 32 + e.args.length * 8;
    return size;
  }
}
