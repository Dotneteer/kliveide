import { describe, expect, it } from "vitest";

import {
  decodeDmaState,
  dmaBytesMoved,
  dmaBytesToMove,
  dmaCycleClocks,
  dmaPacing,
  dmaPendingFollowers,
  dmaStatusByte,
  DmaWrSeq,
  NEXT_DMA_STATE_SIZE,
  type NextDmaState
} from "@common/zxnext/dma/dmaState";
import { buildDmaModel, physicalPage, portAddresses, stepAsideSources } from "@renderer/features/dma/dmaViewModel";

/*
 * The DMA panel's view model (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3.3, §3.4) and the snapshot
 * helpers, without a core. The core-backed scenarios are test/zxnext-hw/dma/dma-debugging.test.ts.
 */

const port = (start: number, working = start) => ({ start, working, isIo: false, step: "up" as const, timingCode: 1, cycleClocks: 3 });

/** An idle zxnDMA after a reset, with every NextReg at its reset value */
function idle(over: Partial<NextDmaState> = {}): NextDmaState {
  return {
    dialect: "zxn",
    seq: "idle",
    busRequested: false,
    busAcknowledged: false,
    aToB: true,
    portA: port(0),
    portB: port(0),
    blockLength: 16,
    counter: 0,
    prescaler: 0,
    operatingMode: "continuous",
    autoRestart: false,
    readMask: 0x7f,
    nextRead: "status",
    endOfBlockN: true,
    atLeastOne: false,
    wrSeq: 0,
    regTemp: 0,
    startsSinceLoad: false,
    enableNote: 0,
    wasDelayed: false,
    delayActive: false,
    cpuSpeed: 0,
    nextRegs: { r82: 0xff, r85: 0x8f, rC0: 0, rCC: 0, rCD: 0, rCE: 0 },
    tactsInFrame: 70908 * 8,
    ...over
  };
}

const ids = (s: NextDmaState) => buildDmaModel(s).diagnostics.map((d) => d.id);

describe("DMA snapshot helpers", () => {
  it("decodes the 64-byte layout", () => {
    const b = new Uint8Array(NEXT_DMA_STATE_SIZE);
    b[0] = 1; // Z80 DMA
    b[1] = 3; // burst wait
    b[4] = 0; // B -> A
    b[5] = 1; // port A I/O
    b[6] = 2; // fixed
    b[7] = 2; // 2 clocks
    b[9] = 0; // port B down
    b[10] = 0; // 4 clocks
    b[11] = 55;
    b[12] = 2;
    b[14] = 0x18;
    b[15] = 3;
    b.set([0x34, 0x12, 0x78, 0x56, 0x00, 0x08, 0x05, 0x00, 0x11, 0x11, 0x22, 0x22], 16);
    b[28] = 0;
    b[29] = 1;
    b[32] = 1;
    b[33] = 3;
    b[60] = 2;
    const s = decodeDmaState(b, { nextReg82: 0x20, nextReg85: 2, nextRegC0: 1, nextRegCC: 1, nextRegCD: 0, nextRegCE: 0, tactsInFrame: 1000 });
    expect(s).toMatchObject({
      dialect: "z80",
      seq: "burstWait",
      aToB: false,
      blockLength: 0x0800,
      counter: 5,
      prescaler: 55,
      operatingMode: "burst",
      readMask: 0x18,
      nextRead: "portALo",
      endOfBlockN: false,
      atLeastOne: true,
      startsSinceLoad: true,
      enableNote: 3,
      cpuSpeed: 2,
      ddma: undefined
    });
    // --- B -> A: the source ($1111) is port B's working address, the destination ($2222) port A's
    expect(s.portA).toEqual({ start: 0x1234, working: 0x2222, isIo: true, step: "fixed", timingCode: 2, cycleClocks: 2 });
    expect(s.portB).toEqual({ start: 0x5678, working: 0x1111, isIo: false, step: "down", timingCode: 0, cycleClocks: 4 });
    b[37] = 1;
    b[38] = 0x03;
    b[48] = 32;
    b[50] = 32;
    expect(decodeDmaState(b, { nextReg82: 0, nextReg85: 0, nextRegC0: 0, nextRegCC: 0, nextRegCD: 0, nextRegCE: 0, tactsInFrame: 0 }).ddma).toMatchObject({
      flags: 3,
      rowLength: 32,
      rowCount: 32
    });
  });

  it("cycle clocks: 00 and 11 = 4, 01 = 3, 10 = 2", () => {
    expect([0, 1, 2, 3].map(dmaCycleClocks)).toEqual([4, 3, 2, 4]);
  });

  it("the status byte is 00E1101T", () => {
    expect(dmaStatusByte({ endOfBlockN: true, atLeastOne: false })).toBe(0x3a);
    expect(dmaStatusByte({ endOfBlockN: true, atLeastOne: true })).toBe(0x3b);
    expect(dmaStatusByte({ endOfBlockN: false, atLeastOne: false })).toBe(0x1a);
  });

  it("pending followers follow the base byte's announce bits", () => {
    const at = (wrSeq: number, regTemp = 0) => dmaPendingFollowers({ wrSeq, regTemp });
    expect(at(DmaWrSeq.Idle)).toBeUndefined();
    expect(at(DmaWrSeq.R4Byte2Deaf)).toBeUndefined();
    expect(at(DmaWrSeq.R0Byte0, 0x7d)).toEqual({ group: "WR0", roles: ["portALo", "portAHi", "lengthLo", "lengthHi"] });
    expect(at(DmaWrSeq.R0Byte0, 0x6d)).toEqual({ group: "WR0", roles: ["portALo", "lengthLo", "lengthHi"] });
    expect(at(DmaWrSeq.R0Byte2, 0x7d)).toEqual({ group: "WR0", roles: ["lengthLo", "lengthHi"] });
    expect(at(DmaWrSeq.R1Byte1)).toEqual({ group: "WR1", roles: ["timingExtra"] });
    expect(at(DmaWrSeq.R2Byte1)).toEqual({ group: "WR2", roles: ["prescaler"] });
    expect(at(DmaWrSeq.R3Byte0, 0x98)).toEqual({ group: "WR3", roles: ["mask", "match"] });
    expect(at(DmaWrSeq.R4Byte0, 0xcd)).toEqual({ group: "WR4", roles: ["portBLo", "portBHi"] });
    expect(at(DmaWrSeq.R6Byte0)).toEqual({ group: "WR6", roles: ["readMask"] });
    expect(
      dmaPendingFollowers({ wrSeq: DmaWrSeq.Ddma, regTemp: 0, ddma: { ...idleDdma(), commandBytes: 2, commandBytesReceived: 1 } })
    ).toEqual({ group: "zxnDDMA", roles: ["ddma"] });
  });

  it("pacing: 875 kHz / P nominal, 32 x P / s + 3 clocks exact, no effect when the wait is not longer than a byte", () => {
    expect(dmaPacing(0, 0, 6)).toBeUndefined();
    expect(dmaPacing(100, 0, 6)).toMatchObject({ nominalHz: 8750, waitClocks: 400, effective: true, periodClocks: 403 });
    expect(dmaPacing(100, 3, 6)).toMatchObject({ waitClocks: 3200, periodClocks: 3203 });
    expect(dmaPacing(55, 0, 6)!.exactHz).toBeCloseTo(3_500_000 / 223, 3);
    expect(dmaPacing(1, 0, 6)!.effective).toBe(false);
    expect(dmaPacing(1, 1, 6)!.effective).toBe(true);
  });

  it("bytes to move and moved: N or N + 1, 0 moves one, a rectangle", () => {
    expect(dmaBytesToMove({ dialect: "zxn", blockLength: 16 })).toBe(16);
    expect(dmaBytesToMove({ dialect: "z80", blockLength: 16 })).toBe(17);
    expect(dmaBytesToMove({ dialect: "z80", blockLength: 0 })).toBe(1);
    expect(dmaBytesMoved({ dialect: "z80", counter: 0xffff })).toBe(0);
    expect(dmaBytesMoved({ dialect: "z80", counter: 4 })).toBe(5);
    const rect = { ...idleDdma(), flags: 0x02, rowLength: 32, rowCount: 4, row: 2, rowByte: 5 };
    expect(dmaBytesToMove({ dialect: "zxn", blockLength: 0, ddma: rect })).toBe(128);
    expect(dmaBytesMoved({ dialect: "zxn", counter: 0, ddma: rect })).toBe(69);
  });
});

function idleDdma() {
  return {
    flags: 0,
    extA: 0,
    extB: 0,
    srcHi: 0,
    destHi: 0,
    rowLength: 0,
    rowCount: 0,
    strideA: 0,
    strideB: 0,
    transparent: 0,
    fill: 0,
    row: 0,
    rowByte: 0,
    command: 0,
    commandBytes: 0,
    commandBytesReceived: 0
  };
}

describe("DMA view model: the header state (first match wins)", () => {
  it.each([
    ["deaf", idle({ wrSeq: DmaWrSeq.R4Byte2Deaf, seq: "transfer", autoRestart: true })],
    ["locked", idle({ seq: "transfer", autoRestart: true, busAcknowledged: true })],
    ["locked", idle({ seq: "transfer", autoRestart: true, operatingMode: "burst", prescaler: 0 })],
    ["holding", idle({ seq: "transfer", busAcknowledged: true })],
    ["steppedAside", idle({ seq: "start", wasDelayed: true })],
    ["waiting", idle({ seq: "burstWait", operatingMode: "burst", prescaler: 55 })],
    ["starting", idle({ seq: "start" })],
    ["idle", idle()]
  ] as const)("%s", (header, s) => {
    expect(buildDmaModel(s).header).toBe(header);
  });

  it("burst with a prescaler and auto restart is not locked", () => {
    expect(buildDmaModel(idle({ seq: "burstWait", operatingMode: "burst", prescaler: 10, autoRestart: true })).header).toBe("waiting");
  });

  it("finished: idle with the end of block reached", () => {
    expect(buildDmaModel(idle({ endOfBlockN: false })).finished).toBe(true);
  });
});

describe("DMA view model: diagnostics", () => {
  it("an idle DMA after a reset has none", () => {
    expect(ids(idle())).toEqual([]);
  });

  it("deaf", () => {
    expect(buildDmaModel(idle({ wrSeq: DmaWrSeq.R4Byte2Deaf, regTemp: 0x91 })).diagnostics).toEqual([
      { id: "deaf", severity: "warning", args: { base: "$91" } }
    ]);
  });

  it("lock names the step-aside sources", () => {
    const m = buildDmaModel(idle({ seq: "transfer", autoRestart: true, nextRegs: { ...idle().nextRegs, rC0: 1, rCC: 0x01 } }));
    expect(m.diagnostics[0]).toEqual({ id: "lock", severity: "warning", args: { count: 1, sources: "ULA" } });
  });

  it("noLoad and afterEnd come from the enable note", () => {
    const m = buildDmaModel(idle({ enableNote: 3, portA: port(0xc000, 0xc010), portB: port(0xd000, 0xd010) }));
    expect(m.diagnostics.map((d) => d.id)).toEqual(["noLoad", "afterEnd"]);
    expect(m.diagnostics[0].args).toEqual({ portA: "$C010", portB: "$D010" });
  });

  it("partial", () => {
    expect(buildDmaModel(idle({ wrSeq: DmaWrSeq.R2Byte0, regTemp: 0x68 })).diagnostics).toEqual([
      { id: "partial", severity: "warning", args: { group: "WR2", count: 1 } }
    ]);
  });

  it("prescaler in continuous mode estimates the frozen frames", () => {
    // --- 2048 bytes x 403 T at 3.5 MHz over a 70908 T frame
    const m = buildDmaModel(idle({ seq: "transfer", busAcknowledged: true, prescaler: 100, blockLength: 2048 }));
    const d = m.diagnostics.find((x) => x.id === "prescalerContinuous")!;
    expect(d.args.frames).toBeCloseTo((2048 * 403) / 70908, 1);
  });

  it("portOff: the dialect's port switched off", () => {
    expect(ids(idle({ nextRegs: { ...idle().nextRegs, r82: 0xdf } }))).toEqual(["portOff"]);
    expect(buildDmaModel(idle({ dialect: "z80", nextRegs: { ...idle().nextRegs, r85: 0x8d } })).diagnostics[0]).toMatchObject({
      id: "portOff",
      args: { port: "$0B", reg: "$85", bit: 1 }
    });
  });

  it("stepAsideIm: enables without hardware IM2 mode; the NMI alone does not count", () => {
    expect(ids(idle({ nextRegs: { ...idle().nextRegs, rCD: 0x01 } }))).toEqual(["stepAsideIm"]);
    expect(ids(idle({ nextRegs: { ...idle().nextRegs, rCC: 0x80 } }))).toEqual([]);
    expect(ids(idle({ nextRegs: { ...idle().nextRegs, rCD: 0x01, rC0: 0x01 } }))).toEqual([]);
  });

  it("ddmaOn: zxnDDMA flags left on while idle", () => {
    expect(buildDmaModel(idle({ ddma: { ...idleDdma(), flags: 0x05 } })).diagnostics).toEqual([
      { id: "ddmaOn", severity: "info", args: { flags: "physical, transparent" } }
    ]);
  });

  it("prescalerNone: P = 1 at 3.5 MHz", () => {
    expect(ids(idle({ prescaler: 1, operatingMode: "burst" }))).toEqual(["prescalerNone"]);
  });

  it("z80: the extra byte", () => {
    expect(buildDmaModel(idle({ dialect: "z80" })).diagnostics).toEqual([{ id: "z80", severity: "info", args: { length: 16, bytes: 17 } }]);
  });

  it("zeroLength while active", () => {
    expect(ids(idle({ seq: "start", blockLength: 0 }))).toEqual(["zeroLength"]);
    expect(ids(idle({ blockLength: 0 }))).toEqual([]);
  });

  it("framePause when the pause found the bus held", () => {
    expect(ids(idle({ seq: "transfer", busAcknowledged: true }))).toEqual(["framePause"]);
  });
});

describe("DMA view model: helpers", () => {
  it("step-aside sources in chain order, NMI last", () => {
    expect(stepAsideSources({ r82: 0, r85: 0, rC0: 0, rCC: 0x83, rCD: 0x05, rCE: 0x77 })).toEqual([
      "Line",
      "UART 0 Rx",
      "UART 1 Rx",
      "CTC 0",
      "CTC 2",
      "ULA",
      "UART 0 Tx",
      "UART 1 Tx",
      "NMI"
    ]);
  });

  it("physical addresses: 22 bits, the RAM page from $40000", () => {
    const s = idle({ portA: port(0x0000, 0x0010), portB: port(0x2000, 0x2010), ddma: { ...idleDdma(), flags: 1, extA: 9, extB: 9, srcHi: 9, destHi: 9 } });
    expect(portAddresses(s, "A")).toEqual({ start: 0x090000, working: 0x090010 });
    expect(portAddresses(s, "B")).toEqual({ start: 0x092000, working: 0x092010 });
    expect(physicalPage(0x092010)).toEqual({ page: 41, offset: 0x10 });
    expect(physicalPage(0x01000)).toBeUndefined();
  });
});

describe("the dma command's text", () => {
  it("prints the panel's rows and diagnostics in English", async () => {
    const { formatDmaState } = await import("@renderer/features/dma/dmaText");
    const s = idle({
      seq: "burstWait",
      operatingMode: "burst",
      prescaler: 55,
      blockLength: 2048,
      counter: 1213,
      portA: port(0xc000, 0xc4bd),
      portB: { ...port(0x00df), isIo: true, step: "fixed" },
      dialect: "z80"
    });
    const lines = formatDmaState(s, buildDmaModel(s));
    expect(lines[0]).toBe("Z80 DMA ($0B) · waiting, bus free · burst · A → B · 1214 / 2049");
    expect(lines[1]).toBe("A  start $C000  working $C4BD  memory  up     3 clk");
    expect(lines[2]).toBe("B  start $00DF  working $00DF  I/O     fixed  3 clk");
    expect(lines[3]).toBe("prescaler 55 · nominal 15909 Hz · exact 223 T a byte (15695 Hz)");
    expect(lines[4]).toBe("status $3A · read mask $7F · next read: status · decoder: ready");
    expect(lines).toContain("info: z80 (length=2048 bytes=2049)");
  });
});
