import { describe, expect, it } from "vitest";

import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  testRom
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;
const LAYER2_PORT = 0x123b;

describe("ZX Spectrum Next WASM v2 early boot/storage/ULA smoke", () => {
  it("returns the TypeScript fallback value and records the owner step for unsupported ports", async () => {
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(),
      createOracleZxNextMachine()
    ]);
    const wasm = wasmMachine.wasmV2Runtime!.exports;

    expect(wasm.zxnextReadPort(LAYER2_PORT)).toBe(oracleMachine.doReadPort(LAYER2_PORT));

    const diagnostics = wasmMachine.getWasmV2Diagnostics();
    expect(diagnostics.unsupportedPortReadCount).toBe(1);
    expect(diagnostics.unsupportedPortWriteCount).toBe(0);
    expect(diagnostics.firstUnsupportedPortAddress).toBe(LAYER2_PORT);
    expect(diagnostics.firstUnsupportedPortValue).toBe(0x00);
    expect(diagnostics.firstUnsupportedPortIsWrite).toBe(false);
    expect(diagnostics.firstUnsupportedPortOwnerStep).toBe(22);
    expect(diagnostics.diagnosticFlags & 0x01).toBe(0x01);
  });

  it("executes ROM frames, renders visible ULA pixels, and logs unsupported boot-time ports", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet({
      next: testRom([
        0x31, 0xff, 0xff,       // LD SP,0xffff
        0x21, 0x00, 0x40,       // LD HL,0x4000
        0x36, 0x80,             // LD (HL),0x80
        0x21, 0x00, 0x58,       // LD HL,0x5800
        0x36, 0x47,             // LD (HL),0x47
        0x01, 0x3b, 0x12,       // LD BC,0x123b
        0xed, 0x78,             // IN A,(C)
        0xed, 0x79,             // OUT (C),A
        0xc3, 0x10, 0x00        // JP 0x0010
      ], 0x10000)
    }));

    machine.executeMachineFrame();

    const diagnostics = machine.getWasmV2Diagnostics();
    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(diagnostics.frames).toBe(1);
    expect(diagnostics.cpuPc).not.toBe(0);
    expect(diagnostics.screenRenderCount).toBe(1);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(15));
    expect(diagnostics.unsupportedPortReadCount).toBeGreaterThan(0);
    expect(diagnostics.unsupportedPortWriteCount).toBeGreaterThan(0);
    expect(diagnostics.firstUnsupportedPortAddress).toBe(LAYER2_PORT);
    expect(diagnostics.firstUnsupportedPortOwnerStep).toBe(22);
    expect(machine.wasmV2Runtime!.diagnosticBuffer[1]).toBe(diagnostics.unsupportedPortReadCount);
    expect(machine.wasmV2Runtime!.diagnosticBuffer[2]).toBe(diagnostics.unsupportedPortWriteCount);
  });
});

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
