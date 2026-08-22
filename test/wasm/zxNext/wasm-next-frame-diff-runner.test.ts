import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";
import {
  compareZxNextFrameTraces,
  formatZxNextFrameTraceDifference,
  readTraceHeader,
  readTraceRecord,
  writeTraceHeader,
  ZxNextFrameTraceRecorder,
  ZXNEXT_FRAME_TRACE_CAPACITY,
  ZXNEXT_FRAME_TRACE_HEADER_SIZE,
  ZXNEXT_FRAME_TRACE_MAGIC,
  ZXNEXT_FRAME_TRACE_RECORD_SIZE,
  ZXNEXT_FRAME_TRACE_TOTAL_BYTES,
  ZXNEXT_FRAME_TRACE_VERSION,
  ZxNextTraceHeaderOffset,
  ZxNextTraceRecordOffset,
  ZXNEXT_TRACE_RECORD_FIELDS
} from "@emu/machines/zxNext/diagnostics/ZxNextFrameTrace";

describe("ZX Spectrum Next frame diff trace layout", () => {
  it("keeps the binary trace ABI fixed and inside the 128-byte record", () => {
    expect(ZXNEXT_FRAME_TRACE_HEADER_SIZE).toBe(64);
    expect(ZXNEXT_FRAME_TRACE_RECORD_SIZE).toBe(128);
    expect(ZXNEXT_FRAME_TRACE_TOTAL_BYTES).toBe(
      ZXNEXT_FRAME_TRACE_HEADER_SIZE + ZXNEXT_FRAME_TRACE_CAPACITY * ZXNEXT_FRAME_TRACE_RECORD_SIZE
    );
    for (const field of ZXNEXT_TRACE_RECORD_FIELDS) {
      expect(field.offset).toBeGreaterThanOrEqual(0);
      expect(field.offset + field.byteLength).toBeLessThanOrEqual(ZXNEXT_FRAME_TRACE_RECORD_SIZE);
    }
  });

  it("writes and reads the fixed frame header", () => {
    const buffer = new ArrayBuffer(ZXNEXT_FRAME_TRACE_HEADER_SIZE + ZXNEXT_FRAME_TRACE_RECORD_SIZE);
    const view = new DataView(buffer);
    writeTraceHeader(view, {
      capacity: 1,
      count: 1,
      overflow: 0,
      frameIndex: 7,
      tactsInFrame28: 567_808,
      startTacts: 0x1_0000_0002,
      endTacts: 0x1_0000_0007
    });

    expect(readTraceHeader(buffer)).toEqual({
      magic: ZXNEXT_FRAME_TRACE_MAGIC,
      version: ZXNEXT_FRAME_TRACE_VERSION,
      recordSize: ZXNEXT_FRAME_TRACE_RECORD_SIZE,
      capacity: 1,
      count: 1,
      overflow: 0,
      frameIndex: 7,
      tactsInFrame28: 567_808,
      startTacts: 0x1_0000_0002,
      endTacts: 0x1_0000_0007
    });
  });
});

describe("ZX Spectrum Next TypeScript frame trace recorder", () => {
  it("collects a binary record through the normal frame runner instruction boundary", async () => {
    const machine = await createTestNextMachine();
    machine.hardReset();
    machine.pc = 0x8000;
    machine.setTacts(0);
    machine.frameTacts = 0;
    machine.currentFrameTact = 0;
    machine.frames = 0;
    machine.frameCompleted = false;
    machine.doWriteMemory(0x8000, 0x00);
    machine.executionContext.debugSupport = new DebugSupport(undefined, []);
    machine.executionContext.debugStepMode = DebugStepMode.StepInto;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

    const recorder = new ZxNextFrameTraceRecorder(machine, 4);
    machine.traceInstructionExecuted = (pcBefore) => recorder.recordInstruction(pcBefore);
    recorder.beginFrame(machine.frames);
    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    recorder.endFrame();
    machine.traceInstructionExecuted = undefined;

    expect(readTraceHeader(recorder.bytes)).toMatchObject({
      count: 1,
      overflow: 0,
      frameIndex: 0
    });
    expect(readTraceRecord(recorder.bytes, 0)).toMatchObject({
      sequence: 0,
      pcBefore: 0x8000,
      pcAfter: 0x8001,
      mmuRaw: [0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01]
    });
  });
});

describe("ZX Spectrum Next WASM frame trace recorder", () => {
  it("initializes CPU registers with TypeScript parity after hard reset", async () => {
    const oracle = await createTestNextMachine();
    const machine = await createTestZxNextWasmMachine();

    oracle.hardReset();
    machine.hardReset();

    expect(machine.getCpuState()).toMatchObject({
      af: oracle.af,
      bc: oracle.bc,
      de: oracle.de,
      hl: oracle.hl,
      af_: oracle.af_,
      bc_: oracle.bc_,
      de_: oracle.de_,
      hl_: oracle.hl_,
      ix: oracle.ix,
      iy: oracle.iy,
      ir: oracle.ir,
      wz: oracle.wz,
      pc: oracle.pc,
      sp: oracle.sp,
      iff1: oracle.iff1,
      iff2: oracle.iff2,
      interruptMode: oracle.interruptMode,
      halted: oracle.halted
    });
  });

  it("loads ROM images into WASM memory during setup and keeps them after hard reset", async () => {
    const machine = await createTestZxNextWasmMachine();
    const runtime = machine.wasmV2Runtime!;
    const romRoot = resolve(__dirname, "../../../src/public/roms");
    const nextRom = readFileSync(resolve(romRoot, "enNextZX.rom"));
    const divMmcRom = readFileSync(resolve(romRoot, "enNxtmmc.rom"));
    const multifaceRom = readFileSync(resolve(romRoot, "enNextMf.rom"));
    const altRom = readFileSync(resolve(romRoot, "enAltZX.rom"));

    expect(machine.doReadMemory(0x0000)).toBe(0xf3);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x00000)).toBe(nextRom[0]);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x10000)).toBe(divMmcRom[0]);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x14000)).toBe(multifaceRom[0]);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x18000)).toBe(altRom[0]);

    machine.hardReset();

    expect(machine.doReadMemory(0x0000)).toBe(0xf3);
    expect(runtime.exports.zxnextReadPhysicalMemory(0x00000)).toBe(0xf3);
  });

  it("collects a binary record in the static WASM trace buffer", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();
    machine.pc = 0x8000;
    machine.doWriteMemory(0x8000, 0x00);
    const runtime = machine.wasmV2Runtime!;

    runtime.exports.zxnextTraceClear(machine.frames);
    runtime.exports.zxnextTraceSetEnabled(1);
    machine.executeWasmV2Instruction();
    runtime.exports.zxnextTraceFinishFrame();
    runtime.exports.zxnextTraceSetEnabled(0);

    expect(runtime.exports.zxnextTraceGetCount()).toBe(1);
    expect(runtime.exports.zxnextTraceGetOverflow()).toBe(0);
    expect(readTraceHeader(runtime.frameTrace)).toMatchObject({
      count: 1,
      overflow: 0,
      frameIndex: 0
    });
    expect(readTraceRecord(runtime.frameTrace, 0)).toMatchObject({
      sequence: 0,
      pcBefore: 0x8000,
      pcAfter: 0x8001,
      mmuRaw: [0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01]
    });
  });

  it("records executed instruction counts relative to the captured frame", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();
    machine.pc = 0x8000;
    machine.doWriteMemory(0x8000, 0x00);
    const runtime = machine.wasmV2Runtime!;

    for (let i = 0; i < 3; i++) {
      machine.executeWasmV2Instruction();
    }

    runtime.exports.zxnextTraceClear(1);
    runtime.exports.zxnextTraceSetEnabled(1);
    machine.executeWasmV2Instruction();
    runtime.exports.zxnextTraceFinishFrame();
    runtime.exports.zxnextTraceSetEnabled(0);

    expect(readTraceRecord(runtime.frameTrace, 0)).toMatchObject({
      sequence: 0,
      executedInstructions: 1
    });
  });

  it("records the raw ULA interrupt pulse even while maskable interrupts are disabled", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();
    machine.pc = 0x8000;
    machine.doWriteMemory(0x8000, 0x00);
    const runtime = machine.wasmV2Runtime!;

    machine.executeMachineFrame();
    expect(runtime.exports.zxnextGetFrames()).toBe(1);

    machine.pc = 0x8000;
    machine.doWriteMemory(0x8000, 0x00);
    runtime.exports.zxnextSetCpuIff1(0);
    runtime.exports.zxnextSetTacts(298);
    expect(runtime.exports.zxnextGetCurrentFrameTact()).toBe(596);

    runtime.exports.zxnextTraceClear(1);
    runtime.exports.zxnextTraceSetEnabled(1);
    machine.executeWasmV2Instruction();
    runtime.exports.zxnextTraceFinishFrame();
    runtime.exports.zxnextTraceSetEnabled(0);

    const record = readTraceRecord(runtime.frameTrace, 0);
    expect(record.cpuFlagsPacked & 0x0200).toBe(0x0200);
    expect(record.cpuFlagsPacked & 0x0001).toBe(0);
    expect(record.pcBefore).toBe(0x8000);
  });

  it("clears the RET step-out helper flag before writing trace diagnostics", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();
    machine.pc = 0x8000;
    machine.sp = 0xc100;
    machine.doWriteMemory(0x8000, 0xc9);
    machine.doWriteMemory(0xc100, 0x34);
    machine.doWriteMemory(0xc101, 0x12);
    const runtime = machine.wasmV2Runtime!;

    runtime.exports.zxnextTraceClear(0);
    runtime.exports.zxnextTraceSetEnabled(1);
    machine.executeWasmV2Instruction();
    runtime.exports.zxnextTraceFinishFrame();
    runtime.exports.zxnextTraceSetEnabled(0);

    const record = readTraceRecord(runtime.frameTrace, 0);
    expect(record.pcBefore).toBe(0x8000);
    expect(record.pcAfter).toBe(0x1234);
    expect(record.cpuFlagsPacked & 0x0800).toBe(0);
  });

  it("keeps immediate operand fetches out of last-memory diagnostics", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    oracle.hardReset();
    wasm.hardReset();

    oracle.executionContext.debugSupport = new DebugSupport(undefined, []);
    oracle.executionContext.debugStepMode = DebugStepMode.StepInto;
    oracle.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    const oracleTrace = new ZxNextFrameTraceRecorder(oracle, 24);
    oracle.traceInstructionExecuted = pcBefore => oracleTrace.recordInstruction(pcBefore);
    oracleTrace.beginFrame(oracle.frames);
    for (let i = 0; i < 20; i++) {
      expect(oracle.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    }
    oracleTrace.endFrame();
    oracle.traceInstructionExecuted = undefined;

    const runtime = wasm.wasmV2Runtime!;
    runtime.exports.zxnextTraceClear(wasm.frames);
    runtime.exports.zxnextTraceSetEnabled(1);
    for (let i = 0; i < 20; i++) {
      wasm.executeWasmV2Instruction();
    }
    runtime.exports.zxnextTraceFinishFrame();
    runtime.exports.zxnextTraceSetEnabled(0);

    expect(readTraceRecord(oracleTrace.bytes, 1)).toMatchObject({
      pcBefore: 0x0001,
      pcAfter: 0x00ef,
      lastMemoryAddress: 0x0001,
      lastMemoryValue: 0xc3
    });
    expect(readTraceRecord(runtime.frameTrace, 1)).toMatchObject({
      pcBefore: 0x0001,
      pcAfter: 0x00ef,
      lastMemoryAddress: 0x0001,
      lastMemoryValue: 0xc3
    });
    expect(readTraceRecord(oracleTrace.bytes, 2)).toMatchObject({
      pcBefore: 0x00ef,
      pcAfter: 0x00f3,
      nextRegIndex: 0x07
    });
    expect(readTraceRecord(runtime.frameTrace, 2)).toMatchObject({
      pcBefore: 0x00ef,
      pcAfter: 0x00f3,
      nextRegIndex: 0x07
    });
    expect(readTraceRecord(oracleTrace.bytes, 18)).toMatchObject({
      pcBefore: 0x011d,
      pcAfter: 0x011e,
      lastPortAddress: 0
    });
    expect(readTraceRecord(runtime.frameTrace, 18)).toMatchObject({
      pcBefore: 0x011d,
      pcAfter: 0x011e,
      lastPortAddress: 0
    });
    expect(readTraceRecord(oracleTrace.bytes, 19)).toMatchObject({
      pcBefore: 0x011e,
      pcAfter: 0x0120,
      af: 0x9888,
      lastPortAddress: 0x253b,
      lastPortValue: 0x98
    });
    expect(readTraceRecord(runtime.frameTrace, 19)).toMatchObject({
      pcBefore: 0x011e,
      pcAfter: 0x0120,
      af: 0x9888,
      lastPortAddress: 0x253b,
      lastPortValue: 0x98
    });
  });

  it("preserves HALT opcode fetch diagnostics during halted dummy cycles", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    oracle.hardReset();
    wasm.hardReset();

    oracle.pc = 0x8000;
    wasm.pc = 0x8000;
    oracle.doWriteMemory(0x8000, 0x76);
    wasm.doWriteMemory(0x8000, 0x76);

    const oracleTrace = new ZxNextFrameTraceRecorder(oracle, 4);
    oracleTrace.beginFrame(oracle.frames);
    for (let i = 0; i < 2; i++) {
      const pcBefore = oracle.pc;
      oracle.executeCpuCycle();
      oracleTrace.recordInstruction(pcBefore);
    }
    oracleTrace.endFrame();

    const runtime = wasm.wasmV2Runtime!;
    runtime.exports.zxnextTraceClear(wasm.frames);
    runtime.exports.zxnextTraceSetEnabled(1);
    wasm.executeWasmV2Instruction();
    wasm.executeWasmV2Instruction();
    runtime.exports.zxnextTraceFinishFrame();
    runtime.exports.zxnextTraceSetEnabled(0);

    const oracleHaltRecord = readTraceRecord(oracleTrace.bytes, 1);
    const wasmHaltRecord = readTraceRecord(runtime.frameTrace, 1);
    expect(oracleHaltRecord).toMatchObject({
      pcBefore: 0x8000,
      pcAfter: 0x8000,
      lastMemoryAddress: 0x8000,
      lastMemoryValue: 0x76
    });
    expect(wasmHaltRecord).toMatchObject({
      pcBefore: oracleHaltRecord.pcBefore,
      pcAfter: oracleHaltRecord.pcAfter,
      lastMemoryAddress: oracleHaltRecord.lastMemoryAddress,
      lastMemoryValue: oracleHaltRecord.lastMemoryValue
    });
  });

  it("marks zero-valued memory reads at address zero in diagnostics", async () => {
    const oracle = await createTestNextMachine();
    const wasm = await createTestZxNextWasmMachine();
    oracle.hardReset();
    wasm.hardReset();

    for (const machine of [oracle, wasm]) {
      machine.nextRegDevice.setNextRegisterIndex(0x50);
      machine.nextRegDevice.setNextRegisterValue(0x00);
      machine.pc = 0x0000;
      machine.doWriteMemory(0x0000, 0x00);
    }

    const oracleTrace = new ZxNextFrameTraceRecorder(oracle, 1);
    oracleTrace.beginFrame(oracle.frames);
    const pcBefore = oracle.pc;
    oracle.executeCpuCycle();
    oracleTrace.recordInstruction(pcBefore);
    oracleTrace.endFrame();

    const runtime = wasm.wasmV2Runtime!;
    runtime.exports.zxnextTraceClear(wasm.frames);
    runtime.exports.zxnextTraceSetEnabled(1);
    wasm.executeWasmV2Instruction();
    runtime.exports.zxnextTraceFinishFrame();
    runtime.exports.zxnextTraceSetEnabled(0);

    expect(readTraceRecord(oracleTrace.bytes, 0)).toMatchObject({
      pcBefore: 0x0000,
      pcAfter: 0x0001,
      lastMemoryAddress: 0x0000,
      lastMemoryValue: 0x00,
      lastMemoryFlags: 0x01
    });
    expect(readTraceRecord(runtime.frameTrace, 0)).toMatchObject({
      pcBefore: 0x0000,
      pcAfter: 0x0001,
      lastMemoryAddress: 0x0000,
      lastMemoryValue: 0x00,
      lastMemoryFlags: 0x01
    });
  });
});

describe("ZX Spectrum Next frame diff comparator", () => {
  it("reports matching traces", () => {
    const left = createTrace(1);
    const right = createTrace(1);
    writeRecord(left, 0, {
      pcBefore: 0x1234,
      pcAfter: 0x1235,
      af: 0xabcd
    });
    writeRecord(right, 0, {
      pcBefore: 0x1234,
      pcAfter: 0x1235,
      af: 0xabcd
    });

    expect(compareZxNextFrameTraces(left, right, 12)).toMatchObject({
      kind: "match",
      frameCount: 12,
      frameIndex: 12
    });
  });

  it("reports the first CPU field mismatch with the previous matching PC", () => {
    const left = createTrace(2);
    const right = createTrace(2);
    writeRecord(left, 0, { pcBefore: 0x1000, pcAfter: 0x1001, af: 0x1111 });
    writeRecord(right, 0, { pcBefore: 0x1000, pcAfter: 0x1001, af: 0x1111 });
    writeRecord(left, 1, { pcBefore: 0x1001, pcAfter: 0x1002, af: 0x2222 });
    writeRecord(right, 1, { pcBefore: 0x1001, pcAfter: 0x2000, af: 0x2222 });

    const diff = compareZxNextFrameTraces(left, right, 12);

    expect(diff).toMatchObject({
      kind: "record",
      frameCount: 12,
      frameIndex: 12,
      instructionIndex: 1,
      fieldName: "pcAfter",
      lastMatchingRecord: {
        sequence: 0,
        pcBefore: 0x1000,
        pcAfter: 0x1001
      }
    });
    expect(formatZxNextFrameTraceDifference(diff)).toContain("frameCount=12");
    expect(formatZxNextFrameTraceDifference(diff)).toContain("TypeScript pcBefore=$1001 pcAfter=$1002");
    expect(formatZxNextFrameTraceDifference(diff)).toContain("WASM       pcBefore=$1001 pcAfter=$2000");
  });

  it("reports MMU field mismatch", () => {
    const left = createTrace(1);
    const right = createTrace(1);
    writeRecord(left, 0, { pcBefore: 0x0100, pcAfter: 0x0101, mmu0: 0xff });
    writeRecord(right, 0, { pcBefore: 0x0100, pcAfter: 0x0101, mmu0: 0x00 });

    expect(compareZxNextFrameTraces(left, right, 3)).toMatchObject({
      kind: "record",
      fieldName: "mmuRaw",
      instructionIndex: 0
    });
  });

  it("reports record count mismatch after comparing the common prefix", () => {
    const left = createTrace(2);
    const right = createTrace(1);
    writeRecord(left, 0, { pcBefore: 0x0100, pcAfter: 0x0101 });
    writeRecord(left, 1, { pcBefore: 0x0101, pcAfter: 0x0102 });
    writeRecord(right, 0, { pcBefore: 0x0100, pcAfter: 0x0101 });

    expect(compareZxNextFrameTraces(left, right, 5)).toMatchObject({
      kind: "record-count",
      instructionIndex: 1,
      typescriptValue: "2",
      wasmValue: "1"
    });
  });

  it("reports overflow before comparing records", () => {
    const left = createTrace(1, 2);
    const right = createTrace(1);

    expect(compareZxNextFrameTraces(left, right, 9)).toMatchObject({
      kind: "overflow",
      frameCount: 9,
      typescriptValue: "2",
      wasmValue: "0"
    });
  });

  it("decodes instruction records", () => {
    const trace = createTrace(1);
    writeRecord(trace, 0, {
      pcBefore: 0x1234,
      pcAfter: 0x4567,
      af: 0xbeef,
      mmu0: 0xaa
    });

    expect(readTraceRecord(trace, 0)).toMatchObject({
      sequence: 0,
      pcBefore: 0x1234,
      pcAfter: 0x4567,
      af: 0xbeef,
      mmuRaw: [0xaa, 0, 0, 0, 0, 0, 0, 0]
    });
  });
});

function createTrace(count: number, overflow = 0): ArrayBuffer {
  const buffer = new ArrayBuffer(ZXNEXT_FRAME_TRACE_HEADER_SIZE + 4 * ZXNEXT_FRAME_TRACE_RECORD_SIZE);
  const view = new DataView(buffer);
  writeTraceHeader(view, {
    capacity: 4,
    count,
    overflow,
    frameIndex: 12,
    tactsInFrame28: 567_808,
    startTacts: 0,
    endTacts: 16
  });
  return buffer;
}

function writeRecord(
  buffer: ArrayBuffer,
  index: number,
  values: {
    pcBefore?: number;
    pcAfter?: number;
    af?: number;
    mmu0?: number;
  }
): void {
  const view = new DataView(buffer);
  const base = ZXNEXT_FRAME_TRACE_HEADER_SIZE + index * ZXNEXT_FRAME_TRACE_RECORD_SIZE;
  view.setUint32(base + ZxNextTraceRecordOffset.Sequence, index, true);
  view.setUint16(base + ZxNextTraceRecordOffset.PcBefore, values.pcBefore ?? 0, true);
  view.setUint16(base + ZxNextTraceRecordOffset.PcAfter, values.pcAfter ?? 0, true);
  view.setUint16(base + ZxNextTraceRecordOffset.Af, values.af ?? 0, true);
  view.setUint8(base + ZxNextTraceRecordOffset.MmuRaw, values.mmu0 ?? 0);
  expect(view.getUint32(ZxNextTraceHeaderOffset.Magic, true)).toBe(ZXNEXT_FRAME_TRACE_MAGIC);
}
