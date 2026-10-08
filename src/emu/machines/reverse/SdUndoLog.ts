/*
 * The Next SD card's undo log (`.plans/REVERSE_DEBUGGING_PLAN.md` D14, T3, Phase 6).
 *
 * The SD card is a host file outside the core's image, so a timeline cannot rewind it the way it
 * rewinds the machine. Reads need nothing here: the sector data the host answered with is journaled
 * (`writeCoreBytes`), so a replay never re-reads a file that later writes changed. Writes do: before
 * the machine writes a sector in a live timeline it reads the old one, and this log keeps it. A fork
 * (Take over here) discards the future, so the writes the future made are reverted - newest first -
 * and the host file is again what it was at the fork point, byte for byte.
 *
 * Each entry carries the journal index the write's acknowledgement was journaled at: the fork keeps
 * the journal entries before `appliedJournalEnd`, and the same index decides whether a write stays.
 */

/** One sector write in a live timeline, with what the sector held before */
export type SdUndoEntry = {
  /** The journal length when the write was made: its acknowledgement is the entry at this index */
  readonly journalIndex: number;
  /** The card (0 or 1) */
  readonly card: number;
  readonly sector: number;
  /** The sector's bytes before the write; undefined when they could not be read (the fork reports it) */
  readonly before?: Uint8Array;
};

/** What the machine needs to put sectors back */
export interface SdSectorWriter {
  writeSector(card: number, sector: number, data: Uint8Array): Promise<boolean>;
}

/** The outcome of reverting a fork's discarded writes */
export type SdRevertResult = {
  /** Sectors written back */
  reverted: number;
  /** Writes that could not be undone: the old bytes were unknown, or writing them back failed */
  failed: SdUndoEntry[];
};

export class SdUndoLog {
  private readonly entries: SdUndoEntry[] = [];

  /** @param journalLength The timeline journal's current length */
  constructor(private readonly journalLength: () => number) {}

  /** The writes logged so far */
  get length(): number {
    return this.entries.length;
  }

  /** Logs a write the machine is about to make */
  record(card: number, sector: number, before: Uint8Array | undefined): void {
    this.entries.push({ journalIndex: this.journalLength(), card, sector, before: before?.slice() });
  }

  /** How many logged writes a fork that keeps the journal up to `journalIndex` would discard */
  countFrom(journalIndex: number): number {
    return this.entries.length - this.firstFrom(journalIndex);
  }

  /**
   * Removes the writes a fork discards - those at or after `journalIndex` - and returns them newest
   * first, the order to revert them in
   */
  takeFrom(journalIndex: number): SdUndoEntry[] {
    return this.entries.splice(this.firstFrom(journalIndex)).reverse();
  }

  clear(): void {
    this.entries.length = 0;
  }

  private firstFrom(journalIndex: number): number {
    let i = this.entries.length;
    while (i > 0 && this.entries[i - 1].journalIndex >= journalIndex) i--;
    return i;
  }
}

/**
 * Writes the old bytes of `entries` back, in the given order (newest first: a sector written twice
 * ends with what it held before the first write)
 */
export async function revertSdWrites(entries: readonly SdUndoEntry[], writer: SdSectorWriter): Promise<SdRevertResult> {
  const result: SdRevertResult = { reverted: 0, failed: [] };
  for (const entry of entries) {
    if (!entry.before) {
      result.failed.push(entry);
      continue;
    }
    let ok = false;
    try {
      ok = await writer.writeSector(entry.card, entry.sector, entry.before);
    } catch {
      ok = false;
    }
    if (ok) result.reverted++;
    else result.failed.push(entry);
  }
  return result;
}
