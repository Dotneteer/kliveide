import { describe, expect, it } from "vitest";

import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;

describe("ZX Spectrum Next WASM v2 palette, Timex, and ULA+", () => {
  it("matches TypeScript for Next palette register state", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);
    const wasm = wasmMachine.wasmV2Runtime!.exports;

    for (const machine of [wasmMachine, oracleMachine]) {
      machine.nextRegDevice.directSetRegValue(0x43, 0x00);
      machine.nextRegDevice.directSetRegValue(0x40, 0x08);
      machine.nextRegDevice.directSetRegValue(0x44, 0x30);
      machine.nextRegDevice.directSetRegValue(0x44, 0x81);
      machine.nextRegDevice.directSetRegValue(0x40, 0x08);
    }

    expect(wasmMachine.nextRegDevice.directGetRegValue(0x40)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0x40));
    expect(wasmMachine.nextRegDevice.directGetRegValue(0x43)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0x43));
    expect(wasmMachine.nextRegDevice.directGetRegValue(0x44)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0x44));
    expect(wasmMachine.nextRegDevice.directGetRegValue(0x28)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0x28));
    expect(wasm.zxnextReadPaletteEntry(0, 0x08)).toBe(0x261);
    expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
      paletteIndex: 0x08,
      paletteControl: 0x00,
      paletteStoredValue: 0x30
    });
  });

  it("applies Next palette writes through the WASM-owned ULA renderer", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextWritePhysical(BANK_5_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x1800, 0x47);
    machine.renderInstantScreen();
    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    const before = machine.getPixelBuffer()[displayPixel];

    machine.nextRegDevice.directSetRegValue(0x43, 0x00);
    machine.nextRegDevice.directSetRegValue(0x40, 15);
    machine.nextRegDevice.directSetRegValue(0x41, 0x00);
    machine.renderInstantScreen();

    expect(machine.getPixelBuffer()[displayPixel]).toBe(0xff000000);
    expect(machine.getPixelBuffer()[displayPixel]).not.toBe(before);
  });

  it("uses the active second ULA palette during rendering", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextWritePhysical(BANK_5_BASE + 0x0000, 0x80);
    wasm.zxnextWritePhysical(BANK_5_BASE + 0x1800, 0x47);
    machine.nextRegDevice.directSetRegValue(0x43, 0x42);
    machine.nextRegDevice.directSetRegValue(0x40, 15);
    machine.nextRegDevice.directSetRegValue(0x41, 0x00);
    machine.renderInstantScreen();

    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(machine.getPixelBuffer()[displayPixel]).toBe(0xff000000);
    expect(wasm.zxnextReadPaletteEntry(4, 15)).toBe(0x000);
    expect(machine.getWasmV2Diagnostics().paletteSecondUla).toBe(true);
  });

  it("owns Timex and ULA+ public ports in WASM", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x00ff, 0x48);
    expect(machine.doReadPort(0x00ff)).toBe(0x48);
    expect(machine.nextRegDevice.directGetRegValue(0x22) & 0x04).toBe(0x04);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      timexPortValue: 0x48,
      timexPortBits: 0x08
    });

    machine.doWritePort(0xbf3b, 0x05);
    expect(machine.doReadPort(0xbf3b)).toBe(0xff);
    machine.doWritePort(0xff3b, 0xe3);
    expect(machine.doReadPort(0xff3b)).toBe(0xe3);
    expect(wasm.zxnextReadPaletteEntry(0, 197)).toBe((0x00 << 6) | (0x07 << 3) | (0x03 << 1) | 0x01);

    machine.nextRegDevice.directSetRegValue(0x43, 0x02);
    machine.doWritePort(0xbf3b, 0x07);
    machine.doWritePort(0xff3b, 0x9c);
    expect(wasm.zxnextReadPaletteEntry(4, 199)).toBe((0x07 << 6) | (0x04 << 3));

    machine.doWritePort(0xbf3b, 0x40);
    machine.doWritePort(0xff3b, 0x01);
    expect(machine.doReadPort(0xff3b)).toBe(0x01);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      ulaPlusMode: 1,
      ulaPlusPaletteIndex: 7,
      ulaPlusEnabled: true
    });
  });
});
