import { describe, expect, it } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "../../zxnext/TestNextMachine";
import type { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * The WASM DMA against DmaDevice.ts, driven by real Z80 code.
 *
 * Each scenario sends a DMA program with OTIR, optionally reads the status back with IN, then idles
 * in `JR $`. Both backends run the same instructions one at a time, and after every instruction the
 * DMA state, the destination memory, and the elapsed time must agree. Time matters as much as data:
 * the DMA charges its clocks to the frame, and burst mode's pacing depends on it.
 */

const PROGRAM_ADDRESS = 0x8100;
const STATUS_ADDRESS = 0x8200;
const SOURCE_ADDRESS = 0x9000;
const DEST_ADDRESS = 0xa000;
const SOURCE = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc];

type Scenario = {
  port?: number;
  program: number[];
  instructions?: number;
  readStatus?: boolean;
  // --- How many bytes of the read sequence to fetch with IN (default 1).
  readCount?: number;
  compareBytes?: number;
};

function z80Code(port: number, programLength: number, readStatus: boolean, readCount = 1): number[] {
  const code = [
    0xf3, // DI
    0x21, PROGRAM_ADDRESS & 0xff, PROGRAM_ADDRESS >> 8, // LD HL,program
    0x01, port, programLength, // LD BC,(length << 8) | port
    0xed, 0xb3 // OTIR
  ];
  if (readStatus) {
    code.push(0x01, port, 0x00); // LD BC,port
    for (let i = 0; i < readCount; i++) {
      code.push(0xed, 0x78); // IN A,(C)
      code.push(0x32, (STATUS_ADDRESS + i) & 0xff, (STATUS_ADDRESS + i) >> 8); // LD (status+i),A
    }
  }
  code.push(0x18, 0xfe); // JR $
  return code;
}

function dmaState(ts: TestZxNextMachine) {
  const dma = ts.dmaDevice;
  return {
    seq: dma.getDmaSeq(),
    bus: dma.getBusState(),
    addressA: dma.getAddressA(),
    addressB: dma.getAddressB(),
    count: dma.getMameCount(),
    byteCounter: dma.getTransferState().byteCounter,
    status: dma.getStatus(),
    ip: dma.getIp(),
    vector: dma.getMVector(),
    delay: dma.getDmaDelay() ? 1 : 0,
    enabled: dma.getRegisters().dmaEnabled ? 1 : 0
  };
}

function wasmDmaState(wasm: ZxNextWasmV2Machine) {
  const e = wasm.wasmV2Runtime!.exports;
  return {
    seq: e.zxnextGetDmaSeq(),
    bus: e.zxnextGetDmaBusState(),
    addressA: e.zxnextGetDmaAddressA(),
    addressB: e.zxnextGetDmaAddressB(),
    count: e.zxnextGetDmaCount(),
    byteCounter: e.zxnextGetDmaByteCounter(),
    status: e.zxnextGetDmaStatus(),
    ip: e.zxnextGetDmaIp(),
    vector: e.zxnextGetDmaVector(),
    delay: e.zxnextGetDmaDelay(),
    enabled: e.zxnextGetDmaEnabled()
  };
}

async function runScenario(scenario: Scenario) {
  const port = scenario.port ?? 0x6b;
  const code = z80Code(port, scenario.program.length, !!scenario.readStatus, scenario.readCount);
  const ts = await createTestNextMachine();
  const wasm = await createTestZxNextWasmMachine();

  const load = (write: (address: number, value: number) => void) => {
    code.forEach((value, i) => write(0x8000 + i, value));
    scenario.program.forEach((value, i) => write(PROGRAM_ADDRESS + i, value));
    SOURCE.forEach((value, i) => write(SOURCE_ADDRESS + i, value));
    for (let i = 0; i < 0x20; i++) write(DEST_ADDRESS + i, 0);
    for (let i = 0; i < 8; i++) write(STATUS_ADDRESS + i, 0);
  };
  load((address, value) => ts.memoryDevice.writeMemory(address, value));
  load((address, value) => wasm.doWriteMemory(address, value));
  ts.pc = 0x8000;
  wasm.pc = 0x8000;

  const tsStart = { tacts: ts.tacts, frames: ts.frames };
  const exports = wasm.wasmV2Runtime!.exports;
  const wasmStart = { tacts: exports.zxnextGetTacts(), frames: exports.zxnextGetFrames() };
  return compare(ts, wasm, tsStart, wasmStart, scenario);
}

// --- One whole instruction, prefixes included, the way MachineFrameRunner steps the machine.
function runTsInstruction(ts: TestZxNextMachine): void {
  ts.beforeInstructionExecuted();
  do {
    ts.executeCpuCycle();
  } while (ts.instructionExecutionInProgress());
}

function compare(
  ts: TestZxNextMachine,
  wasm: ZxNextWasmV2Machine,
  tsStart: { tacts: number; frames: number },
  wasmStart: { tacts: number; frames: number },
  scenario: Scenario
) {
  const instructions = scenario.instructions ?? 40;
  const compareBytes = scenario.compareBytes ?? SOURCE.length + 2;
  for (let i = 0; i < instructions; i++) {
    runTsInstruction(ts);
    wasm.executeWasmV2Instruction();
    const context = `after instruction ${i + 1}`;
    expect({ context, pc: wasm.pc, ...wasmDmaState(wasm) }).toEqual({ context, pc: ts.pc, ...dmaState(ts) });
    // --- CPU T-states round DMA clocks up, so also compare the frame position, which moves in
    // --- 28 MHz clocks (reported as ULA tacts, a quarter of that).
    expect({
      context,
      elapsed: wasm.tacts - wasmStart.tacts,
      frames: wasm.frames - wasmStart.frames,
      frameTact: wasm.wasmV2Runtime!.exports.zxnextGetCurrentFrameTact()
    }).toEqual({
      context,
      elapsed: ts.tacts - tsStart.tacts,
      frames: ts.frames - tsStart.frames,
      frameTact: ts.currentFrameTact
    });
  }
  const tsDest = Array.from({ length: compareBytes }, (_, i) => ts.memoryDevice.readMemory(DEST_ADDRESS + i));
  const wasmDest = Array.from({ length: compareBytes }, (_, i) => wasm.doReadMemory(DEST_ADDRESS + i));
  expect(wasmDest).toEqual(tsDest);
  const tsStatus = Array.from({ length: 8 }, (_, i) => ts.memoryDevice.readMemory(STATUS_ADDRESS + i));
  const wasmStatus = Array.from({ length: 8 }, (_, i) => wasm.doReadMemory(STATUS_ADDRESS + i));
  expect(wasmStatus).toEqual(tsStatus);
  return { tsDest, status: tsStatus, dma: dmaState(ts), elapsed: ts.tacts - tsStart.tacts };
}

// --- DMA program pieces.
const lo = (value: number) => value & 0xff;
const hi = (value: number) => (value >> 8) & 0xff;
const wr0 = (direction: number, source: number, length: number) => [
  0x79 | direction, lo(source), hi(source), lo(length), hi(length)
];

describe("WASM DMA parity with DmaDevice.ts, running Z80 code", () => {
  it("continuous memory-to-memory copy: ScrollNutter's DmaCopy program", async () => {
    const { tsDest } = await runScenario({
      program: [
        0x83, ...wr0(0x04, SOURCE_ADDRESS, 5), 0x54, 0x01, 0x50, 0x01,
        0xad, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0x82, 0xcf, 0x87
      ],
      readStatus: true
    });
    expect(tsDest.slice(0, 6)).toEqual([0x11, 0x22, 0x33, 0x44, 0x55, 0x00]);
  });

  it("legacy port $0B copies length + 1 bytes", async () => {
    const { tsDest } = await runScenario({
      port: 0x0b,
      program: [
        0x83, ...wr0(0x04, SOURCE_ADDRESS, 5), 0x14, 0x10,
        0xad, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0x82, 0xcf, 0x87
      ],
      readStatus: true,
      instructions: 60
    });
    expect(tsDest[5]).toBe(0x66);
  });

  it("B-to-A copy with decrementing addresses", async () => {
    // --- Port A is the destination (counting down from DEST+4), port B the source (down from SOURCE+4).
    await runScenario({
      program: [
        0x83, ...wr0(0x00, DEST_ADDRESS + 4, 5), 0x04, 0x00,
        0xad, lo(SOURCE_ADDRESS + 4), hi(SOURCE_ADDRESS + 4), 0x82, 0xcf, 0x87
      ]
    });
  });

  it("byte mode moves one byte per instruction", async () => {
    const { tsDest } = await runScenario({
      program: [
        0x83, ...wr0(0x04, SOURCE_ADDRESS, 8), 0x14, 0x10,
        0x8d, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0x82, 0xcf, 0x87
      ],
      instructions: 30
    });
    expect(tsDest.slice(0, 9)).toEqual([...SOURCE.slice(0, 8), 0x00]);
  });

  it("burst mode without a prescaler", async () => {
    await runScenario({
      program: [
        0x83, ...wr0(0x04, SOURCE_ADDRESS, 8), 0x14, 0x10,
        0xcd, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0x82, 0xcf, 0x87
      ]
    });
  });

  it("paced burst mode: the WR2 prescaler spaces the bytes out in time", async () => {
    const { tsDest } = await runScenario({
      program: [
        0x83, ...wr0(0x04, SOURCE_ADDRESS, 6), 0x14, 0x50, 0x22, 0x80,
        0xcd, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0x82, 0xcf, 0x87
      ],
      instructions: 400
    });
    expect(tsDest.slice(0, 7)).toEqual([...SOURCE.slice(0, 6), 0x00]);
  });

  it("memory to a fixed I/O port: bytes land in the Next register selected through $243B", async () => {
    await runScenario({
      program: [
        0x83, ...wr0(0x04, SOURCE_ADDRESS, 3), 0x54, 0x02, 0x68, 0x02,
        0xad, 0x3b, 0x24, 0x82, 0xcf, 0x87
      ]
    });
  });

  it("search and transfer sets the match bit and keeps copying", async () => {
    const { tsDest, dma } = await runScenario({
      program: [
        // --- WR0 D1-D0 = 11: search and transfer.
        0x83, 0x7f, lo(SOURCE_ADDRESS), hi(SOURCE_ADDRESS), 10, 0x00, 0x14, 0x10,
        // --- WR3 with mask $00 and match $44. ($86 is not WR5 "stop on match": with D2 set it fails
        // --- MAME's WR5 mask and decodes as an unknown WR6 command, in both backends.)
        0x98, 0x00, 0x44,
        0xad, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0x86, 0xcf, 0x87
      ],
      readStatus: true
    });
    expect(tsDest.slice(0, 11)).toEqual([...SOURCE.slice(0, 10), 0x00]);
    expect(dma.status & 0x04).toBe(0x04);
  });

  it("auto-restart reloads the block after it finishes", async () => {
    await runScenario({
      program: [
        0x83, ...wr0(0x04, SOURCE_ADDRESS, 4), 0x14, 0x10,
        0xad, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0xa2, 0xcf, 0x87
      ],
      instructions: 20
    });
  });

  it("end-of-block interrupt sets IP and the status-affected vector", async () => {
    const { dma } = await runScenario({
      program: [
        0x83, ...wr0(0x04, SOURCE_ADDRESS, 4), 0x14, 0x10,
        // --- WR4: port B, interrupt control $22 (end of block, status affects vector), vector $f0.
        0xbd, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0x32, 0xf0,
        0x82, 0xab, 0xcf, 0x87
      ],
      readStatus: true
    });
    expect(dma.ip).toBe(1);
    expect(dma.vector).toBe(0xf0);
  });

  it("status read sequence after RESET, READ_MASK_FOLLOWS and INITIALIZE_READ_SEQUENCE", async () => {
    await runScenario({
      program: [
        0xc3, 0xc3, ...wr0(0x04, SOURCE_ADDRESS, 3), 0x14, 0x10,
        0xad, lo(DEST_ADDRESS), hi(DEST_ADDRESS), 0x82, 0xcf, 0x87,
        0xbb, 0x7f, 0xa7
      ],
      readStatus: true,
      readCount: 8,
      instructions: 60
    });
  });
});
