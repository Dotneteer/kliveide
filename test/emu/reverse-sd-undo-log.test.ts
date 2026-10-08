import { describe, expect, it } from "vitest";

import { revertSdWrites, SdUndoLog } from "@emu/machines/reverse/SdUndoLog";

/*
 * The SD undo log (`.plans/REVERSE_DEBUGGING_PLAN.md` D14): writes keyed by the journal index their
 * acknowledgement was journaled at, taken back newest first from a fork's journal end.
 */
describe("SdUndoLog", () => {
  const bytes = (v: number) => new Uint8Array(4).fill(v);

  it("keeps the writes before a fork's journal end and hands back the rest newest first", () => {
    let journal = 0;
    const log = new SdUndoLog(() => journal);
    journal = 3;
    log.record(0, 10, bytes(1));
    journal = 7;
    log.record(0, 11, bytes(2));
    journal = 9;
    log.record(1, 10, bytes(3));
    expect(log.length).toBe(3);
    expect(log.countFrom(7)).toBe(2);
    expect(log.countFrom(10)).toBe(0);
    const taken = log.takeFrom(7);
    expect(taken.map((e) => [e.journalIndex, e.card, e.sector])).toEqual([
      [9, 1, 10],
      [7, 0, 11]
    ]);
    expect(log.length).toBe(1);
  });

  it("copies the old bytes, so a later change to the caller's buffer does not leak in", () => {
    const log = new SdUndoLog(() => 0);
    const before = bytes(5);
    log.record(0, 1, before);
    before.fill(9);
    expect(Array.from(log.takeFrom(0)[0].before!)).toEqual([5, 5, 5, 5]);
  });

  it("reverts in the order given and reports the writes it could not undo", async () => {
    const written: [number, number][] = [];
    const log = new SdUndoLog(() => 0);
    log.record(0, 4, bytes(1));
    log.record(0, 4, bytes(2));
    log.record(0, 5, undefined);
    log.record(0, 6, bytes(3));
    const result = await revertSdWrites(log.takeFrom(0), {
      writeSector: async (_card, sector, data) => {
        if (sector === 6) return false;
        written.push([sector, data[0]]);
        return true;
      }
    });
    // --- Sector 4 ends with what it held before its first write
    expect(written).toEqual([[4, 2], [4, 1]]);
    expect(result.reverted).toBe(2);
    expect(result.failed.map((e) => e.sector)).toEqual([6, 5]);
  });
});
