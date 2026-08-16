import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const MODE_STOPPED = 0;
const MODE_START_FROM_ZERO_AND_LOOP = 1;
const MODE_START_FROM_LAST_AND_LOOP = 2;
const MODE_START_FROM_ZERO_RESTART_ON_ZERO = 3;

describe("ZX Spectrum Next WASM v2 Copper", () => {
  it("loads program bytes through NextReg 0x60 and wraps the byte address", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.writeNextReg(0x61, 0xfe);
    machine.writeNextReg(0x62, 0x07);
    machine.writeNextReg(0x60, 0xaa);
    machine.writeNextReg(0x60, 0x55);

    expect(wasm.zxnextReadCopperMemory(0x7fe)).toBe(0xaa);
    expect(wasm.zxnextReadCopperMemory(0x7ff)).toBe(0x55);
    expect(machine.readNextReg(0x61)).toBe(0x00);
    expect(machine.readNextReg(0x62)).toBe(0x00);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      copperInstructionAddress: 0x000,
      copperStartMode: MODE_STOPPED
    });
  });

  it("stages aligned 16-bit instruction writes through NextReg 0x63", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.writeNextReg(0x61, 0x00);
    machine.writeNextReg(0x62, 0x00);
    machine.writeNextReg(0x63, 0x12);
    machine.writeNextReg(0x63, 0x34);

    expect(wasm.zxnextReadCopperMemory(0x000)).toBe(0x12);
    expect(wasm.zxnextReadCopperMemory(0x001)).toBe(0x34);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      copperInstructionAddress: 0x002,
      copperStoredByte: 0x34
    });
  });

  it("preserves the list pointer when the same start mode is written again", async () => {
    const machine = await createTestZxNextWasmMachine();

    writeCopperInstruction(machine, 0, moveInstr(0, 0));
    setCopperMode(machine, MODE_START_FROM_ZERO_AND_LOOP);
    machine.wasmV2Runtime!.exports.zxnextCopperExecuteTick(0, 0);

    expect(machine.getWasmV2Diagnostics().copperListAddr).toBe(1);
    machine.writeNextReg(0x62, MODE_START_FROM_ZERO_AND_LOOP << 6);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      copperStartMode: MODE_START_FROM_ZERO_AND_LOOP,
      copperListAddr: 1
    });
  });

  it("delays MOVE output by one tick and routes it through the NextReg write path", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    writeCopperInstruction(machine, 0, moveInstr(0x14, 0xa5));
    setCopperMode(machine, MODE_START_FROM_ZERO_AND_LOOP);

    wasm.zxnextCopperExecuteTick(0, 0);
    expect(machine.readNextReg(0x14)).toBe(0xe3);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      copperListAddr: 1,
      copperDout: true,
      copperWriteCount: 0
    });

    wasm.zxnextCopperExecuteTick(0, 1);
    expect(machine.readNextReg(0x14)).toBe(0xa5);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      globalTransparencyColor: 0xa5,
      copperDout: false,
      copperWriteCount: 1
    });
  });

  it("stalls WAIT instructions until the matching raster line and column", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    writeCopperInstruction(machine, 0, waitInstr(0, 10));
    setCopperMode(machine, MODE_START_FROM_ZERO_AND_LOOP);

    wasm.zxnextCopperExecuteTick(9, 12);
    expect(machine.getWasmV2Diagnostics().copperListAddr).toBe(0);

    wasm.zxnextCopperExecuteTick(10, 11);
    expect(machine.getWasmV2Diagnostics().copperListAddr).toBe(0);

    wasm.zxnextCopperExecuteTick(10, 12);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      copperListAddr: 1,
      copperDout: false
    });
  });

  it("restarts mode 3 at adjusted raster zero using the vertical line offset", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    writeCopperInstruction(machine, 0, moveInstr(0, 0));
    machine.writeNextReg(0x64, 10);
    setCopperMode(machine, MODE_START_FROM_ZERO_RESTART_ON_ZERO);
    wasm.zxnextCopperExecuteTick(1, 1);
    expect(machine.getWasmV2Diagnostics().copperListAddr).toBe(1);

    wasm.zxnextCopperExecuteTick(301, 0);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      copperStartMode: MODE_START_FROM_ZERO_RESTART_ON_ZERO,
      copperVerticalLineOffset: 10,
      copperListAddr: 0,
      copperDout: false
    });
  });

  it("continues from the current list pointer when mode 2 starts execution", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    writeCopperInstruction(machine, 0, moveInstr(0, 0));
    setCopperMode(machine, MODE_START_FROM_LAST_AND_LOOP);

    wasm.zxnextCopperExecuteTick(0, 0);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      copperStartMode: MODE_START_FROM_LAST_AND_LOOP,
      copperListAddr: 1
    });
  });

  it("ticks Copper during instant screen rendering", async () => {
    const machine = await createTestZxNextWasmMachine();

    writeCopperInstruction(machine, 0, moveInstr(0x14, 0x6d));
    writeCopperInstruction(machine, 1, waitInstr(63, 300));
    setCopperMode(machine, MODE_START_FROM_ZERO_AND_LOOP);
    machine.renderInstantScreen();

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      globalTransparencyColor: 0x6d,
      copperTickCount: 456 * 311,
      copperWriteCount: 1,
      screenRenderCount: 1
    });
  });
});

function writeCopperInstruction(
  machine: { writeNextReg: (reg: number, value: number) => void },
  listIndex: number,
  word: number
): void {
  const byteAddress = (listIndex * 2) & 0x7ff;
  machine.writeNextReg(0x61, byteAddress & 0xff);
  machine.writeNextReg(0x62, (byteAddress >> 8) & 0x07);
  machine.writeNextReg(0x60, (word >> 8) & 0xff);
  machine.writeNextReg(0x60, word & 0xff);
}

function setCopperMode(machine: { writeNextReg: (reg: number, value: number) => void }, mode: number): void {
  machine.writeNextReg(0x62, 0x00);
  machine.writeNextReg(0x62, (mode & 0x03) << 6);
}

function moveInstr(reg: number, value: number): number {
  return ((reg & 0x7f) << 8) | (value & 0xff);
}

function waitInstr(hc6: number, vc9: number): number {
  return 0x8000 | ((hc6 & 0x3f) << 9) | (vc9 & 0x1ff);
}
