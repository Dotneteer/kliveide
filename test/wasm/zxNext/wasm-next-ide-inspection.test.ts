import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  executeOneInstruction,
  initCodeBytes
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;

describe("ZX Spectrum Next WASM v2 IDE inspection baseline", () => {
  it("exposes CPU state, memory, ports, NextRegs, screen state, and code injection through public APIs", async () => {
    const romSet = createTestZxNextRomSet({ next: patternedBytes(0x10000, 0x21) });
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    initCodeBytes(wasmMachine, [0x3e, 0x42, 0x32, 0x00, 0x80], 0x8000);
    initCodeBytes(oracleMachine, [0x3e, 0x42, 0x32, 0x00, 0x80], 0x8000);
    expectPublicCpuFields(wasmMachine.getCpuState(), oracleMachine.getCpuState(), [
      "pc", "sp", "af", "bc", "de", "hl", "ix", "iy", "ir", "wz", "tacts"
    ]);

    executeOneInstruction(wasmMachine);
    executeOneInstruction(oracleMachine);
    expectPublicCpuFields(wasmMachine.getCpuState(), oracleMachine.getCpuState(), [
      "pc", "sp", "af", "bc", "de", "hl", "tacts"
    ]);

    wasmMachine.doWriteMemory(0x8000, 0x66);
    oracleMachine.doWriteMemory(0x8000, 0x66);
    expect(wasmMachine.doReadMemory(0x8000)).toBe(oracleMachine.doReadMemory(0x8000));
    expect(wasmMachine.get64KFlatMemory()[0x8000]).toBe(0x66);
    expect(wasmMachine.getMemoryPartition(4)[0]).toBe(0x66);
    expect(wasmMachine.getCurrentPartitions()).toEqual(oracleMachine.getCurrentPartitions());
    expect(wasmMachine.getPartition(0x8000)).toBe(oracleMachine.getPartition(0x8000));
    expect(wasmMachine.parsePartitionLabel("02")).toBe(oracleMachine.parsePartitionLabel("02"));
    expect(wasmMachine.getPartitionLabels()[2]).toBe(oracleMachine.getPartitionLabels()[2]);

    wasmMachine.doWriteMemory(0x9000, 0xcd);
    wasmMachine.doWriteMemory(0x9001, 0x34);
    wasmMachine.doWriteMemory(0x9002, 0x12);
    expect([0, 1, 2].map((offset) => wasmMachine.doReadMemory(0x9000 + offset))).toEqual([0xcd, 0x34, 0x12]);

    wasmMachine.doWritePort(0x00fe, 0x03);
    oracleMachine.doWritePort(0x00fe, 0x03);
    expect(wasmMachine.getCpuState().lastIoWritePort).toBe(0x00fe);
    expect(wasmMachine.getCpuState().lastIoWriteValue).toBe(0x03);
    expect(wasmMachine.getWasmV2Diagnostics().ulaBorderColor).toBe(0x03);

    expect(wasmMachine.doReadPort(0x123b)).toBe(oracleMachine.doReadPort(0x123b));
    expect(wasmMachine.getCpuState().lastIoReadPort).toBe(0x123b);
    expect(wasmMachine.getCpuState().lastIoReadValue).toBe(0x00);

    wasmMachine.doWritePort(0x243b, 0x52);
    wasmMachine.doWritePort(0x253b, 0x12);
    expect(wasmMachine.doReadPort(0x243b)).toBe(0x52);
    expect(wasmMachine.doReadPort(0x253b)).toBe(0x12);
    expect(wasmMachine.nextRegDevice.directGetRegValue(0x52)).toBe(0x12);
    expect(wasmMachine.getCurrentPartitions()[2]).toBe(0x09);

    expect(wasmMachine.screenWidthInPixels).toBe(SCREEN_WIDTH);
    expect(wasmMachine.screenHeightInPixels).toBe(288);
    wasmMachine.wasmV2Runtime!.exports.zxnextWritePhysical(BANK_5_BASE, 0x80);
    wasmMachine.wasmV2Runtime!.exports.zxnextWritePhysical(BANK_5_BASE + 0x1800, 0x47);
    expect(wasmMachine.readScreenMemory(0)).toBe(0x80);
    expect(wasmMachine.readScreenMemory(0x1800)).toBe(0x47);
    wasmMachine.renderInstantScreen();
    expect(wasmMachine.getPixelBuffer()[DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X]).toBe(defaultUlaBgra(15));
    expect(wasmMachine.getWasmV2Diagnostics().screenNonBlankPixelCount).toBeGreaterThan(0);

    const codeToInject: CodeToInject = {
      model: "zxnext",
      entryAddress: 0x8100,
      segments: [
        { startAddress: 0x8100, bankOffset: 0, emittedCode: [0x3e, 0x99, 0x76] }
      ],
      options: { noCls: true }
    };
    expect(wasmMachine.injectCodeToRun(codeToInject)).toBe(0x8100);
    expect(wasmMachine.doReadMemory(0x8100)).toBe(0x3e);
    expect(wasmMachine.doReadMemory(0x8101)).toBe(0x99);
    expect(wasmMachine.get64KFlatMemory()[0x8102]).toBe(0x76);
  });
});

function expectPublicCpuFields(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  fields: string[]
): void {
  for (const field of fields) {
    expect(actual[field], field).toEqual(expected[field]);
  }
}

function patternedBytes(size: number, seed: number): Uint8Array {
  const result = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    result[i] = (seed + i * 13) & 0xff;
  }
  return result;
}

function defaultUlaBgra(index: number): number {
  return bgraFromRgb333(DEFAULT_ULA_COLORS[index & 0x0f]);
}

function bgraFromRgb333(rgb333: number): number {
  return (
    0xff000000 |
    (level(rgb333 & 0x07) << 16) |
    (level((rgb333 >> 3) & 0x07) << 8) |
    level((rgb333 >> 6) & 0x07)
  ) >>> 0;
}

function level(value: number): number {
  return [0, 36, 73, 109, 146, 182, 219, 255][value & 0x07];
}

const DEFAULT_ULA_COLORS = [
  0x000, 0x005, 0x140, 0x145, 0x028, 0x02d, 0x168, 0x16d,
  0x000, 0x007, 0x1c0, 0x1cf, 0x038, 0x03f, 0x1f8, 0x1ff
];
