import { describe, expect, it } from "vitest";

import { HistoryKind } from "@common/history/historyRecord";
import { findServiceSpans, serviceSpanText, type ServiceSpanInput } from "@common/history/serviceSpans";
import { historyContextDecoder } from "@common/history/contexts";
import { decodeTimexContext, timexPartitionFor } from "@common/history/contexts/timexContext";
import { sp128PartitionFor, describeSp128Context } from "@common/history/contexts/sp128Context";
import { spp3ePartitionFor } from "@common/history/contexts/spp3eContext";
import { describeZ88Context } from "@common/history/contexts/z88Context";
import { describeZx8081Context } from "@common/history/contexts/zx8081Context";
import { describeSp48Context } from "@common/history/contexts/sp48Context";

/*
 * The pure parts of execution history on every core (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`):
 * the context decoders against hand-built bytes, and the interrupt service spans the viewer folds
 * (D10). The decoders are checked against the live machines' `getPartition` in `test/wasm/history/`.
 */

describe("history contexts of every core", () => {
  it("has a decoder for every machine that records history, in its own T-states but the Next", () => {
    for (const id of ["sp48", "timex", "sp128", "scorpion", "spp3e", "z88", "zx80", "zx81"]) {
      expect(historyContextDecoder(id), id).toMatchObject({ frameTactUnit: "T-states", frameTactsPerBaseT: 1 });
    }
    expect(historyContextDecoder("c64")).toBeUndefined();
  });

  it("decodes the Timex chunk sources and names their partitions", () => {
    // --- Chunk 0 EXROM (2), chunk 1 nothing (3), chunks 2-5 HOME, chunk 6 DOCK (1), chunk 7 nothing
    const context = new Uint8Array(16);
    context.set([0xc3, 0x80, 0b00001110, 0b11010000, 2]);
    expect(decodeTimexContext(context)).toMatchObject({ portF4: 0xc3, portFf: 0x80, model: 2, chunkSources: [2, 3, 0, 0, 0, 0, 1, 3] });
    const partitions = [0, 1, 2, 3, 4, 5, 6, 7].map((chunk) => timexPartitionFor(context, chunk * 0x2000));
    // --- An empty chunk is named after the bank port $FF selects: the EXROM's here
    expect(partitions).toEqual([-3, -4, 2, 3, 4, 5, 14, -10]);
    context[1] = 0x00;
    expect(timexPartitionFor(context, 0xe000)).toBe(15);
  });

  it("reads the 128K's and the +3's slot partitions as signed bytes", () => {
    const sp128 = new Uint8Array(16);
    sp128.set([0x17, 1, 7, 0x01, 1, 0, 0, 0, 0xfd, 5, 2, 7]);
    expect([0x0000, 0x4000, 0x8000, 0xc000].map((a) => sp128PartitionFor(sp128, a))).toEqual([-3, 5, 2, 7]);
    expect(describeSp128Context(sp128, { [-3]: "R2", 5: "B5", 2: "B2", 7: "B7" })).toBe(
      "Slots 0:R2 1:B5 2:B2 3:B7 · $7FFD=$17 · TR-DOS paged in · Pentagon"
    );
    const p3 = new Uint8Array(16);
    p3.set([0x10, 0x01, 4, 7, 6, 3, 1]);
    expect([0x0000, 0x4000, 0x8000, 0xc000].map((a) => spp3ePartitionFor(p3, a))).toEqual([4, 7, 6, 3]);
  });

  it("describes the machines without partitions", () => {
    expect(describeSp48Context(new Uint8Array(16))).toBe("ZX Spectrum 16K");
    const z88 = new Uint8Array(16);
    z88.set([0x21, 0x40, 0x22, 0x23, 0x20, 0x21, 0x40, 0x40, 0x22, 0x22, 0x23, 0x23, 0x04]);
    expect(describeZ88Context(z88)).toBe(
      "SR0=$21 SR1=$40 SR2=$22 SR3=$23 · Pages 0:$20 1:$21 2:$40 3:$40 4:$22 5:$22 6:$23 7:$23 · RAMS"
    );
    const zx81 = new Uint8Array(16);
    zx81.set([0x31, 0x01]);
    expect(describeZx8081Context(zx81)).toBe("ZX81 16K · NMI generator on (SLOW)");
    zx81.set([0x20, 0x00]);
    expect(describeZx8081Context(zx81)).toBe("ZX80 1K, 8K ROM");
  });
});

/** A record for the span finder: kind, PC, SP, the first two bytes */
function r(sequence: number, kind: number, pc: number, sp: number, bytes: number[] = [0, 0], frameTact = sequence * 4): ServiceSpanInput {
  return { sequence, kind: kind as ServiceSpanInput["kind"], frame: 1, frameTact, regs: { pc, sp }, bytes: [...bytes, 0, 0] };
}

const I = HistoryKind.Instruction;

describe("interrupt service spans (D10)", () => {
  it("folds an INT and its handler, ending with the RET that restores the stack", () => {
    const records = [
      r(10, I, 0x8000, 0xff00),
      r(11, HistoryKind.Int, 0x8001, 0xff00),
      r(12, I, 0x0038, 0xfefe, [0xf5]), // PUSH AF
      r(13, I, 0x0039, 0xfefc, [0xf1]), // POP AF
      r(14, I, 0x003a, 0xfefe, [0xfb]), // EI
      r(15, I, 0x003b, 0xfefe, [0xc9]), // RET
      r(16, I, 0x8001, 0xff00)
    ];
    expect(findServiceSpans(records)).toEqual([
      { first: 11, last: 15, kind: HistoryKind.Int, instructions: 4, frameTacts: 20 }
    ]);
  });

  it("nests an NMI inside an INT service, and folds only the outer span", () => {
    const records = [
      r(1, HistoryKind.Int, 0x8000, 0xff00),
      r(2, I, 0x0038, 0xfefe, [0x00]),
      r(3, HistoryKind.Nmi, 0x0039, 0xfefe),
      r(4, I, 0x0066, 0xfefc, [0xed, 0x45]), // RETN
      r(5, I, 0x0039, 0xfefe, [0xed, 0x4d]), // RETI
      r(6, I, 0x8000, 0xff00)
    ];
    expect(findServiceSpans(records)).toEqual([{ first: 1, last: 5, kind: HistoryKind.Int, instructions: 3, frameTacts: 20 }]);
  });

  it("ends a service that pops its return address and jumps (the ZX81 display's JP (HL))", () => {
    const records = [
      r(1, HistoryKind.Int, 0xc07d, 0x7ff2),
      r(2, I, 0x0038, 0x7ff0, [0x0d]), // DEC C
      r(3, I, 0x0039, 0x7ff0, [0xe1]), // POP HL: the stack is back, but the service goes on
      r(4, I, 0x003a, 0x7ff2, [0xc8]), // RET Z, not taken
      r(5, I, 0x003b, 0x7ff2, [0x18, 0x00]), // JR: still inside
      r(6, I, 0x003d, 0x7ff2, [0xe9]), // JP (HL)
      r(7, I, 0xc05c, 0x7ff2)
    ];
    expect(findServiceSpans(records)).toEqual([{ first: 1, last: 6, kind: HistoryKind.Int, instructions: 5, frameTacts: 24 }]);
  });

  it("does not fold a service still running at the newest record, nor end one at a RET not taken", () => {
    const records = [
      r(1, HistoryKind.Int, 0x8000, 0xff00),
      r(2, I, 0x0038, 0xfefe, [0xc8]), // RET Z, not taken
      r(3, I, 0x0039, 0xfefe, [0x00])
    ];
    expect(findServiceSpans(records)).toEqual([]);
  });

  it("folds the finished services nested in one still running at the newest record", () => {
    const records = [
      r(1, HistoryKind.Nmi, 0x0200, 0x7ffe),
      r(2, I, 0x0066, 0x7ffc, [0x00]),
      r(3, HistoryKind.Int, 0xc07d, 0x7ff2),
      r(4, I, 0x0038, 0x7ff0, [0xe1]), // POP HL
      r(5, I, 0x0039, 0x7ff2, [0xe9]), // JP (HL)
      r(6, I, 0xc05c, 0x7ff2)
    ];
    expect(findServiceSpans(records)).toEqual([{ first: 3, last: 5, kind: HistoryKind.Int, instructions: 2, frameTacts: 12 }]);
  });

  it("leaves the time out when the service crosses a frame", () => {
    const records = [r(1, HistoryKind.Nmi, 0x8000, 0xff00, [0, 0], 69000), r(2, I, 0x0066, 0xfefe, [0xc9], 69004), { ...r(3, I, 0x8000, 0xff00, [0, 0], 10), frame: 2 }];
    const [span] = findServiceSpans(records);
    expect(span.frameTacts).toBeUndefined();
    expect(serviceSpanText(span)).toBe("NMI service, 1 instruction");
    expect(serviceSpanText({ ...span, kind: HistoryKind.Int, instructions: 14, frameTacts: 768 }, 8)).toBe(
      "Interrupt service, 14 instructions, 96 T"
    );
  });
});
