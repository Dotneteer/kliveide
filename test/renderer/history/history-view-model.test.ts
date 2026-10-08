import { describe, expect, it } from "vitest";

import { HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import type { ExecutionHistoryInfo } from "@common/history/historyTypes";
import {
  foldedHistoryRows,
  foldsServiceByDefault,
  readFoldPreference,
  writeFoldPreference,
  HISTORY_PAGE_SIZE,
  historyCountText,
  historyEmptyMessage,
  historyPageOf,
  historyRecordAt,
  historyRowCount,
  historyRowMatches,
  historyRowOf,
  historySequenceAt,
  historyStepOf,
  initialHistoryViewState,
  missingHistoryPages,
  parseHistoryFilter,
  reduceHistoryView,
  type HistoryViewState
} from "@renderer/features/history/historyViewModel";

/* `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §6.3: the Execution History document's model */

function info(overrides: Partial<ExecutionHistoryInfo> = {}): ExecutionHistoryInfo {
  const count = overrides.count ?? 1000;
  const newestSequence = overrides.newestSequence ?? 1000;
  return {
    machineId: "zxnext",
    capacity: 131072,
    count,
    newestSequence,
    oldestSequence: newestSequence - count + 1,
    generation: 0,
    enabled: true,
    ...overrides
  };
}

function rec(sequence: number, pc = 0x8000): HistoryRecord {
  return {
    sequence,
    frame: 0,
    frameTact: 0,
    kind: HistoryKind.Instruction,
    repeat: 1,
    intPending: false,
    bytesTruncated: false,
    bytes: [0, 0, 0, 0],
    context: new Uint8Array(16),
    regs: {
      pc,
      af: 0,
      bc: 0,
      de: 0,
      hl: 0,
      af_: 0,
      bc_: 0,
      de_: 0,
      hl_: 0,
      ix: 0,
      iy: 0,
      sp: 0,
      ir: 0,
      wz: 0,
      iff1: false,
      iff2: false,
      interruptMode: 0
    }
  };
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => rec(from + i));

function loaded(i: ExecutionHistoryInfo, from: number, to: number): HistoryViewState {
  const s = reduceHistoryView(initialHistoryViewState, { type: "infoLoaded", info: i });
  return reduceHistoryView(s, { type: "pageLoaded", generation: i.generation, firstSequence: from, records: range(from, to) });
}

describe("history view model: rows by sequence", () => {
  it("maps rows to sequences, oldest first, and numbers steps from the newest", () => {
    const s = reduceHistoryView(initialHistoryViewState, { type: "infoLoaded", info: info({ count: 10, newestSequence: 109 }) });
    expect(historyRowCount(s)).toBe(10);
    expect(historySequenceAt(s, 0)).toBe(100);
    expect(historySequenceAt(s, 9)).toBe(109);
    expect(historySequenceAt(s, 10)).toBeUndefined();
    expect(historyRowOf(s, 105)).toBe(5);
    expect(historyRowOf(s, 99)).toBe(-1);
    expect(historyStepOf(s, 109)).toBe(-1);
    expect(historyStepOf(s, 100)).toBe(-10);
  });

  it("files a read under its pages, and finds records in them", () => {
    const s = loaded(info({ count: 2000, newestSequence: 2000 }), 500, 1100);
    expect(historyRecordAt(s, 500)?.sequence).toBe(500);
    expect(historyRecordAt(s, 1100)?.sequence).toBe(1100);
    expect(historyRecordAt(s, 1101)).toBeUndefined();
    expect([...s.pages.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(historyPageOf(1100)).toBe(2);
  });

  it("asks only for the pages it lacks, clipped to the ring", () => {
    const i = info({ count: 2000, newestSequence: 2000 });
    const s = loaded(i, 512, 1023);
    expect(missingHistoryPages(s, 600, 1100)).toEqual([[1024, HISTORY_PAGE_SIZE]]);
    // --- The first page is partly outside the ring (oldest = 1)
    expect(missingHistoryPages(s, 0, 10)).toEqual([[1, 511]]);
    // --- The newest page ends at the newest record
    expect(missingHistoryPages(s, 1990, 5000)).toEqual([[1536, 465]]);
  });
});

describe("history view model: refreshes", () => {
  it("drops every cached page and the selection when the generation changes (a clear)", () => {
    const i = info({ count: 1000, newestSequence: 1000 });
    let s = loaded(i, 1, 1000);
    s = reduceHistoryView(s, { type: "selected", sequence: 700 });
    s = reduceHistoryView(s, { type: "infoLoaded", info: { ...i, generation: 1, count: 3, newestSequence: 1003, oldestSequence: 1001 } });
    expect(s.pages.size).toBe(0);
    expect(s.selected).toBeUndefined();
  });

  it("after a stop, keeps settled pages but rereads the one the newest record was on (it may have coalesced)", () => {
    const i = info({ count: 1500, newestSequence: 1500 });
    let s = loaded(i, 1, 1500);
    expect([...s.pages.keys()]).toEqual([0, 1, 2]);
    s = reduceHistoryView(s, { type: "infoLoaded", info: info({ count: 1600, newestSequence: 1600 }) });
    expect([...s.pages.keys()]).toEqual([0, 1]);
    expect(missingHistoryPages(s, 1, 1600)).toEqual([[1024, 512], [1536, 65]]);
  });

  it("drops pages that left the ring, and a selection that did", () => {
    let s = loaded(info({ count: 1500, newestSequence: 1500 }), 1, 1500);
    s = reduceHistoryView(s, { type: "selected", sequence: 3 });
    s = reduceHistoryView(s, { type: "infoLoaded", info: info({ count: 1500, newestSequence: 2100 }) });
    expect(s.pages.has(0)).toBe(false);
    expect(s.pages.has(1)).toBe(true);
    expect(s.selected).toBeUndefined();
  });

  it("returns the same state for an unchanged info (no needless re-render)", () => {
    const i = info();
    const s = reduceHistoryView(initialHistoryViewState, { type: "infoLoaded", info: i });
    expect(reduceHistoryView(s, { type: "infoLoaded", info: { ...i } })).toBe(s);
  });

  it("ignores a page read under an older generation", () => {
    const s = reduceHistoryView(initialHistoryViewState, { type: "infoLoaded", info: info({ generation: 2 }) });
    expect(reduceHistoryView(s, { type: "pageLoaded", generation: 1, firstSequence: 1, records: range(1, 5) })).toBe(s);
  });
});

describe("history view model: selection", () => {
  it("selects by sequence, which stops following the newest", () => {
    let s = reduceHistoryView(initialHistoryViewState, { type: "infoLoaded", info: info() });
    expect(s.followNewest).toBe(true);
    s = reduceHistoryView(s, { type: "selected", sequence: 500 });
    expect(s.selected).toBe(500);
    expect(s.followNewest).toBe(false);
    // --- The selection survives a stop while its record is held: it is a sequence, not a row
    s = reduceHistoryView(s, { type: "infoLoaded", info: info({ newestSequence: 1200 }) });
    expect(s.selected).toBe(500);
    expect(historyRowOf(s, 500)).toBe(299);
  });
});

describe("history view model: the filter", () => {
  it("parses addresses, ranges and labels, and falls back to text", () => {
    expect(parseHistoryFilter("")).toEqual({ kind: "none" });
    expect(parseHistoryFilter("$8000")).toEqual({ kind: "address", from: 0x8000, to: 0x8000 });
    expect(parseHistoryFilter("$8000-$80FF")).toEqual({ kind: "address", from: 0x8000, to: 0x80ff });
    expect(parseHistoryFilter("80ffh..8000h")).toEqual({ kind: "address", from: 0x8000, to: 0x80ff });
    expect(parseHistoryFilter("0x38")).toEqual({ kind: "address", from: 0x38, to: 0x38 });
    expect(parseHistoryFilter("MainLoop", { mainloop: 0x8123 })).toEqual({ kind: "address", from: 0x8123, to: 0x8123 });
    expect(parseHistoryFilter("Start-End", { start: 0x8000, end: 0x8010 })).toEqual({ kind: "address", from: 0x8000, to: 0x8010 });
    expect(parseHistoryFilter("LD A,")).toEqual({ kind: "text", text: "ld a," });
    expect(parseHistoryFilter("djnz")).toEqual({ kind: "text", text: "djnz" });
  });

  it("matches rows by PC or by instruction text", () => {
    const r = rec(1, 0x8040);
    expect(historyRowMatches(parseHistoryFilter("$8000-$80FF"), r)).toBe(true);
    expect(historyRowMatches(parseHistoryFilter("$8041"), r)).toBe(false);
    expect(historyRowMatches(parseHistoryFilter("call"), r, "call PrintChar")).toBe(true);
    expect(historyRowMatches(parseHistoryFilter("call"), r, "ret")).toBe(false);
    expect(historyRowMatches(parseHistoryFilter(""), r)).toBe(true);
  });
});

describe("history view model: empty states", () => {
  it("names why there is nothing to show, per machine and run mode", () => {
    expect(historyEmptyMessage({ supported: false, running: false, debugging: false }, undefined)).toBe(
      "This machine does not record execution history"
    );
    expect(historyEmptyMessage({ supported: true, running: true, debugging: true }, info())).toBe(
      "Running — history updates at the next stop"
    );
    expect(historyEmptyMessage({ supported: true, running: false, debugging: false }, info({ count: 0, enabled: false }))).toBe(
      "History is recorded only when the machine is started with debugging"
    );
    expect(historyEmptyMessage({ supported: true, running: false, debugging: true }, info({ count: 0 }))).toBe("No history yet");
    expect(historyEmptyMessage({ supported: true, running: false, debugging: true }, info())).toBeUndefined();
    expect(historyCountText(info({ count: 12345 }))).toBe("12,345 of 131,072 recorded");
  });
});

describe("folded interrupt service rows (EXECUTION_HISTORY_ALL_CORES_PLAN D10)", () => {
  // --- 100 records, 1..100; spans 10-14 (5 records) and 50-59 (10 records)
  const held = info({ count: 100, newestSequence: 100 });
  const spans = [
    { first: 10, last: 14, kind: HistoryKind.Int, instructions: 4 },
    { first: 50, last: 59, kind: HistoryKind.Nmi, instructions: 9 }
  ] as const;

  it("folds each span into the row of its INT or NMI record", () => {
    const rows = foldedHistoryRows(held, [...spans]);
    expect(rows.count).toBe(100 - 4 - 9);
    expect([0, 8, 9, 10, 11, 44, 45, 46, rows.count - 1].map((row) => rows.sequenceAt(row))).toEqual([
      1, 9, 10, 15, 16, 49, 50, 60, 100
    ]);
    expect([1, 10, 12, 14, 15, 50, 55, 60, 100].map((s) => rows.rowOf(s))).toEqual([0, 9, 9, 9, 10, 45, 45, 46, 86]);
    expect(rows.foldedAt(10)?.instructions).toBe(4);
    expect(rows.foldedAt(11)).toBeUndefined();
    expect(rows.sequenceAt(rows.count)).toBeUndefined();
  });

  it("round-trips every row", () => {
    const rows = foldedHistoryRows(held, [...spans], new Set([50]));
    expect(rows.count).toBe(100 - 4);
    for (let row = 0; row < rows.count; row++) expect(rows.rowOf(rows.sequenceAt(row)!)).toBe(row);
    expect(rows.foldedAt(50)).toBeUndefined();
  });

  it("ignores spans partly out of the ring", () => {
    const rows = foldedHistoryRows(info({ count: 90, newestSequence: 100 }), [...spans]);
    expect(rows.count).toBe(90 - 9);
    expect(rows.sequenceAt(0)).toBe(11);
  });

  it("folds by default on the ZX80/81 only, and remembers the choice per machine", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(foldsServiceByDefault("zx81")).toBe(true);
    expect(foldsServiceByDefault("zx80")).toBe(true);
    expect(foldsServiceByDefault("sp48")).toBe(false);
    expect(readFoldPreference("sp48", storage)).toBe(false);
    writeFoldPreference("sp48", true, storage);
    writeFoldPreference("zx81", false, storage);
    expect([readFoldPreference("sp48", storage), readFoldPreference("zx81", storage), readFoldPreference("zx80", storage)]).toEqual([
      true,
      false,
      true
    ]);
    const broken = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
    expect(readFoldPreference("zx81", broken)).toBe(true);
    expect(() => writeFoldPreference("zx81", false, broken)).not.toThrow();
  });
});
