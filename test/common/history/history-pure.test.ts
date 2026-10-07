import { describe, expect, it } from "vitest";

import {
  decodeHistoryPage,
  decodeHistoryRecord,
  encodeHistoryRecord,
  HistoryKind,
  type HistoryRecord
} from "@common/history/historyRecord";
import { registerDiff, formatRegisterDiff } from "@common/history/registerDiff";
import { classifyFlow } from "@common/history/flowKind";
import { formatHistoryRow, historyRowCells } from "@common/history/historyRow";
import {
  decodeZxNextContext,
  decodeZxNextSlot,
  describeZxNextContext,
  describeZxNextDmaHold,
  zxNextPartitionFor
} from "@common/history/contexts/zxnextContext";
import { historyContextDecoder } from "@common/history/contexts";
import { WasmHistoryReader, HISTORY_MAGIC } from "@emu/machines/history/WasmHistoryReader";

/* `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §6.2: the pure modules against hand-built bytes */

function record(overrides: Partial<HistoryRecord> & { regs?: Partial<HistoryRecord["regs"]> } = {}): HistoryRecord {
  const { regs, ...rest } = overrides;
  return {
    sequence: 1,
    frame: 0,
    frameTact: 0,
    kind: HistoryKind.Instruction,
    repeat: 1,
    intPending: false,
    bytesTruncated: false,
    bytes: [0, 0, 0, 0],
    context: new Uint8Array(16),
    ...rest,
    regs: {
      pc: 0x8000,
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
      sp: 0xfffe,
      ir: 0,
      wz: 0,
      iff1: false,
      iff2: false,
      interruptMode: 0,
      ...regs
    }
  };
}

describe("historyRecord", () => {
  it("decodes every field at its offset", () => {
    const bytes = new Uint8Array(64);
    const v = new DataView(bytes.buffer);
    v.setUint32(0, 0x12345678, true);
    v.setUint32(4, 77, true);
    v.setUint32(8, 123456, true);
    v.setUint8(12, HistoryKind.Int);
    v.setUint8(13, 0x01 | 0x02 | (2 << 2) | 0x10);
    v.setUint16(14, 9, true);
    [0x8001, 0x1122, 0x3344, 0x5566, 0x7788, 0x99aa, 0xbbcc, 0xddee, 0xff00, 0x1357, 0x2468, 0xfff0].forEach((w, i) =>
      v.setUint16(16 + i * 2, w, true)
    );
    v.setUint8(40, 0x3f);
    v.setUint8(41, 0x55);
    v.setUint16(42, 0xbeef, true);
    bytes.set([0xff, 1, 2, 3], 44);
    bytes.set(Array.from({ length: 16 }, (_, i) => i + 1), 48);
    const r = decodeHistoryRecord(bytes);
    expect(r.sequence).toBe(0x12345678);
    expect([r.frame, r.frameTact, r.kind, r.repeat]).toEqual([77, 123456, HistoryKind.Int, 9]);
    expect([r.regs.iff1, r.regs.iff2, r.regs.interruptMode, r.intPending, r.bytesTruncated]).toEqual([true, true, 2, true, false]);
    expect(r.regs).toMatchObject({
      pc: 0x8001,
      af: 0x1122,
      bc: 0x3344,
      de: 0x5566,
      hl: 0x7788,
      af_: 0x99aa,
      bc_: 0xbbcc,
      de_: 0xddee,
      hl_: 0xff00,
      ix: 0x1357,
      iy: 0x2468,
      sp: 0xfff0,
      ir: 0x3f55,
      wz: 0xbeef
    });
    expect(r.bytes).toEqual([0xff, 1, 2, 3]);
    expect(Array.from(r.context)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("round-trips through the encoder, and a page gets full sequence numbers", () => {
    const a = record({ sequence: 5, regs: { pc: 0x1234, ir: 0x0a7f }, bytes: [0xed, 0x91, 0x7f, 0xa5] });
    const b = record({ sequence: 6, kind: HistoryKind.Halt, repeat: 1203 });
    const page = new Uint8Array(128);
    page.set(encodeHistoryRecord(a), 0);
    page.set(encodeHistoryRecord(b), 64);
    const decoded = decodeHistoryPage({ records: page, firstSequence: 2 ** 33 + 5 });
    expect(decoded[0]).toEqual({ ...a, sequence: 2 ** 33 + 5 });
    expect(decoded[1]).toEqual({ ...b, sequence: 2 ** 33 + 6 });
  });
});

describe("registerDiff", () => {
  it("reports changed registers and breaks the flags out", () => {
    const before = record({ regs: { af: 0x1000 | 0x41, hl: 0x8000, sp: 0xfffe } }).regs;
    const after = record({ regs: { af: 0x3f00 | 0x80, hl: 0x8001, sp: 0xfffc, ir: 0x0001 } }).regs;
    const diff = registerDiff(before, after);
    expect(diff.changes.map((c) => c.register)).toEqual(["af", "hl", "sp"]);
    expect(diff.flags).toEqual([
      { flag: "S", to: 1 },
      { flag: "Z", to: 0 },
      { flag: "C", to: 0 }
    ]);
    expect(formatRegisterDiff(diff)).toBe("A=3F HL=8001 SP=FFFC S↑ Z↓ C↓");
  });

  it("leaves R and WZ out unless asked", () => {
    const before = record().regs;
    const after = record({ regs: { ir: 0x0005, wz: 0x1234 } }).regs;
    expect(registerDiff(before, after).changes).toEqual([]);
    expect(registerDiff(before, after, { includeRefresh: true }).changes.map((c) => c.register)).toEqual(["ir", "wz"]);
  });

  it("a flag-only change does not report A", () => {
    const diff = registerDiff(record({ regs: { af: 0x1200 } }).regs, record({ regs: { af: 0x1240 } }).regs);
    expect(diff.changes).toEqual([]);
    expect(formatRegisterDiff(diff)).toBe("Z↑");
  });
});

describe("flowKind", () => {
  const at = (bytes: number[], pc = 0x8000) => record({ bytes: [...bytes, 0, 0, 0, 0].slice(0, 4), regs: { pc } });

  it("classifies calls, RSTs, returns and jumps", () => {
    expect(classifyFlow(at([0xcd, 0, 0x90]))).toEqual({ kind: "call", conditional: false });
    expect(classifyFlow(at([0xff])).kind).toBe("rst");
    expect(classifyFlow(at([0xc9])).kind).toBe("ret");
    expect(classifyFlow(at([0xed, 0x4d]))).toEqual({ kind: "ret", conditional: false, fromInterrupt: true });
    expect(classifyFlow(at([0xed, 0x45])).fromInterrupt).toBe(true);
    expect(classifyFlow(at([0xc3, 0, 0x90])).kind).toBe("jump");
    expect(classifyFlow(at([0xdd, 0xe9])).kind).toBe("jump");
    expect(classifyFlow(at([0xed, 0x98])).kind).toBe("jump");
    expect(classifyFlow(at([0x00])).kind).toBe("other");
    expect(classifyFlow(at([0xdd, 0xcb, 0x05, 0xc6])).kind).toBe("other");
  });

  it("decides taken or not for conditional instructions from the next PC", () => {
    expect(classifyFlow(at([0xc8]), 0x8001)).toEqual({ kind: "ret", conditional: true, taken: false });
    expect(classifyFlow(at([0xc8]), 0x1234)).toEqual({ kind: "ret", conditional: true, taken: true });
    expect(classifyFlow(at([0xc4, 0, 0x90]), 0x8003).taken).toBe(false);
    expect(classifyFlow(at([0xc4, 0, 0x90]), 0x9000).taken).toBe(true);
    expect(classifyFlow(at([0x20, 0xfe]), 0x8000).taken).toBe(true);
    expect(classifyFlow(at([0x10, 0x05]), 0x8002).taken).toBe(false);
    expect(classifyFlow(at([0xca, 0, 0x90])).taken).toBeUndefined();
    // --- Wraps at 64K
    expect(classifyFlow(at([0xd8], 0xffff), 0x0000).taken).toBe(false);
  });

  it("classifies event records by kind", () => {
    expect(classifyFlow(record({ kind: HistoryKind.Int })).kind).toBe("int");
    expect(classifyFlow(record({ kind: HistoryKind.Nmi })).kind).toBe("nmi");
    expect(classifyFlow(record({ kind: HistoryKind.Halt })).kind).toBe("halt");
    expect(classifyFlow(record({ kind: HistoryKind.DmaHold })).kind).toBe("dma");
  });
});

describe("the ZX Next context", () => {
  it("decodes slot partitions: RAM pages, the negative partitions, and none", () => {
    expect(decodeZxNextSlot(0x0a)).toBe(0x0a);
    expect(decodeZxNextSlot(223)).toBe(223);
    expect(decodeZxNextSlot(224)).toBeUndefined();
    expect(decodeZxNextSlot(255)).toBe(-1);
    expect(decodeZxNextSlot(233)).toBe(-23);
    const context = new Uint8Array([255, 255, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01, 0x10, 0x04, 0x00, 0x83, 0x09, 3, 0, 0]);
    expect(zxNextPartitionFor(context, 0x0000)).toBe(-1);
    expect(zxNextPartitionFor(context, 0x6000)).toBe(0x0b);
    expect(zxNextPartitionFor(context, 0xffff)).toBe(0x01);
    expect(decodeZxNextContext(context)).toMatchObject({
      port7ffd: 0x10,
      port1ffd: 0x04,
      divMmcE3: 0x83,
      divMmcMapped: true,
      romInSlot0: true,
      multifacePaged: false,
      cpuSpeed: 3
    });
    expect(describeZxNextContext(context, { [-1]: "R0", 10: "0A" })).toContain("Slots 0:R0 1:R0 2:0A 3:11");
    expect(describeZxNextContext(context)).toContain("DivMMC mapped ($E3=$83)");
    expect(describeZxNextContext(context)).toContain("28 MHz");
  });

  it("describes a DMA hold as its row reads", () => {
    const context = new Uint8Array(16);
    context.set([0x00, 0x40, 0x00, 0xc0, 0x00, 0x00, 0x01]);
    expect(describeZxNextDmaHold({ kind: HistoryKind.DmaHold, repeat: 3072, context })).toBe(
      "DMA held the bus for 3,072 T ($4000 → $C000, 0 left)"
    );
    context[6] = 0x08;
    expect(describeZxNextDmaHold({ kind: HistoryKind.DmaHold, repeat: 6, context })).toContain("port $C000");
    expect(historyContextDecoder("zxnext")?.partitionFor(context, 0)).toBe(0);
    expect(historyContextDecoder("c64")).toBeUndefined();
  });
});

describe("historyRow", () => {
  it("formats an instruction row, showing only the instruction's bytes", () => {
    const r = record({ frameTact: 4321, bytes: [0x21, 0x01, 0x80, 0xff], regs: { pc: 0x8003 } });
    const cells = historyRowCells({
      record: r,
      step: -2,
      instruction: "ld hl,$8001",
      length: 3,
      source: "main.asm:12",
      changes: "HL=8001",
      partitionLabel: "02"
    });
    expect(cells).toEqual({
      step: "−2",
      time: "4321",
      address: "02:8003",
      bytes: "21 01 80",
      instruction: "ld hl,$8001",
      source: "main.asm:12",
      changes: "HL=8001",
      separator: false
    });
    expect(formatHistoryRow({ record: r, step: -2, instruction: "ld hl,$8001", length: 3 })).toMatch(
      /^ {5}−2 {4}4321 {2}8003 {5}21 01 80 {5}ld hl,\$8001$/
    );
  });

  it("renders interrupts, NMIs and DMA holds as separators, and HALT with its count", () => {
    const int = historyRowCells({ record: record({ kind: HistoryKind.Int, bytes: [0xff, 0, 0, 0], regs: { interruptMode: 2 } }), step: -1 });
    expect(int).toMatchObject({ separator: true, instruction: "— IM 2 interrupt, vector $FF —", bytes: "" });
    expect(historyRowCells({ record: record({ kind: HistoryKind.Int, regs: { interruptMode: 1 } }), step: -1 }).instruction).toBe(
      "— IM 1 interrupt —"
    );
    expect(historyRowCells({ record: record({ kind: HistoryKind.Nmi }), step: -1 }).instruction).toBe("— NMI —");
    const halt = historyRowCells({ record: record({ kind: HistoryKind.Halt, repeat: 1203, bytes: [0x76, 0, 0, 0] }), step: -1 });
    expect(halt).toMatchObject({ separator: false, instruction: "HALT ×1,203", bytes: "76" });
    const context = new Uint8Array(16);
    context.set([0x00, 0x40, 0x00, 0xc0]);
    expect(
      historyRowCells({ record: record({ kind: HistoryKind.DmaHold, repeat: 3072, context }), step: -1, machineId: "zxnext" }).instruction
    ).toBe("— DMA held the bus for 3,072 T ($4000 → $C000, 0 left) —");
  });
});

describe("WasmHistoryReader", () => {
  /** A fake core: header at 64, a ring of `capacity` records at 1024 */
  function fakeCore(capacity: number) {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const v = new DataView(memory.buffer);
    const H = 64;
    const RING = 1024;
    v.setUint32(H, HISTORY_MAGIC, true);
    v.setUint16(H + 4, 1, true);
    v.setUint16(H + 6, 64, true);
    v.setUint32(H + 8, capacity, true);
    v.setUint32(H + 36, RING, true);
    let newest = 0;
    let write = 0;
    let count = 0;
    const exports = {
      memory,
      z80HistoryGetHeaderOffset: () => H,
      z80HistorySetEnabled: (on: number) => v.setUint32(H + 12, on, true),
      z80HistoryClear: () => {
        count = 0;
        write = 0;
        v.setUint32(H + 16, 0, true);
        v.setUint32(H + 20, 0, true);
        v.setUint32(H + 32, v.getUint32(H + 32, true) + 1, true);
      }
    };
    /** The core writing a record whose PC is its sequence's low 16 bits */
    const append = (n: number) => {
      for (let i = 0; i < n; i++) {
        newest++;
        const at = RING + write * 64;
        v.setUint32(at, newest, true);
        v.setUint16(at + 16, newest & 0xffff, true);
        write = (write + 1) % capacity;
        count = Math.min(capacity, count + 1);
      }
      v.setUint32(H + 16, count, true);
      v.setUint32(H + 20, write, true);
      v.setUint32(H + 24, newest, true);
    };
    return { exports, append };
  }

  it("reads across the wrap in sequence order", () => {
    const core = fakeCore(8);
    const reader = new WasmHistoryReader(core.exports, "zxnext");
    core.append(13);
    expect(reader.info()).toMatchObject({ capacity: 8, count: 8, newestSequence: 13, oldestSequence: 6, machineId: "zxnext" });
    const page = reader.read(6, 8);
    expect(page.gone).toBe(false);
    expect(decodeHistoryPage(page).map((r) => r.regs.pc)).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
    expect(decodeHistoryPage(reader.read(11, 100)).map((r) => r.sequence)).toEqual([11, 12, 13]);
  });

  it("says 'gone' when the requested sequence was overwritten between two reads (T11)", () => {
    const core = fakeCore(8);
    const reader = new WasmHistoryReader(core.exports, "zxnext");
    core.append(8);
    const info = reader.info();
    core.append(3);
    const page = reader.read(info.oldestSequence, 2);
    expect(page.gone).toBe(true);
    expect(page.firstSequence).toBe(4);
    expect(decodeHistoryPage(page).map((r) => r.regs.pc)).toEqual([4, 5]);
  });

  it("returns nothing past the newest, and clears", () => {
    const core = fakeCore(8);
    const reader = new WasmHistoryReader(core.exports, "zxnext");
    core.append(3);
    expect(reader.read(4, 5).records.length).toBe(0);
    reader.setEnabled(true);
    expect(reader.info().enabled).toBe(true);
    reader.clear();
    expect(reader.info()).toMatchObject({ count: 0, generation: 1, newestSequence: 3 });
    expect(reader.read(1, 3).records.length).toBe(0);
  });

  it("refuses a header without the magic number", () => {
    const core = fakeCore(8);
    new DataView(core.exports.memory.buffer).setUint32(64, 0, true);
    expect(() => new WasmHistoryReader(core.exports, "zxnext")).toThrow(/magic/);
  });
});
