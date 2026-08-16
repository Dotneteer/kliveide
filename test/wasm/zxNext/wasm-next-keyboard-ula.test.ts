import { describe, expect, it } from "vitest";

import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine
} from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM v2 keyboard and ULA port", () => {
  it("stores keyboard rows as pressed-bit rows and reads selected rows as active-low ULA input", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    for (let row = 0; row < 8; row++) {
      wasm.zxnextSetKeyboardRow(row, 0x01);
      expect(wasm.zxnextGetKeyboardRow(row)).toBe(0x01);
      expect(wasm.zxnextReadPort(rowAddress(row))).toBe(0xbe);
      expect(wasm.zxnextReadPort(0xfffe)).toBe(0xbf);
      wasm.zxnextSetKeyboardRow(row, 0x00);
    }
  });

  it("uploads only changed keyboard rows before public ULA port reads", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    expect(machine.doReadPort(0xfefe)).toBe(0xbf);
    expect(wasm.zxnextGetKeyboardRowWrites()).toBe(0);

    machine.keyboardDevice.setKeyStatus(0, true);
    expect(machine.doReadPort(0xfefe)).toBe(0xbe);
    expect(wasm.zxnextGetKeyboardRow(0)).toBe(0x01);
    expect(wasm.zxnextGetKeyboardRowWrites()).toBe(1);

    expect(machine.doReadPort(0xfefe)).toBe(0xbe);
    expect(wasm.zxnextGetKeyboardRowWrites()).toBe(1);

    machine.keyboardDevice.setKeyStatus(0, false);
    expect(machine.doReadPort(0xfefe)).toBe(0xbf);
    expect(wasm.zxnextGetKeyboardRow(0)).toBe(0x00);
    expect(wasm.zxnextGetKeyboardRowWrites()).toBe(2);
  });

  it("matches TypeScript keyboard matrix reads for every Spectrum row", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    for (let row = 0; row < 8; row++) {
      const key = row * 5;
      wasmMachine.keyboardDevice.setKeyStatus(key, true);
      oracleMachine.keyboardDevice.setKeyStatus(key, true);

      expect(wasmMachine.doReadPort(rowAddress(row)), `row ${row}`).toBe(
        oracleMachine.doReadPort(rowAddress(row))
      );

      wasmMachine.keyboardDevice.setKeyStatus(key, false);
      oracleMachine.keyboardDevice.setKeyStatus(key, false);
    }
  });

  it("tracks border, EAR, MIC, and beeper latches on ULA writes", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x00fe, 0x1d);

    expect(machine.composedScreenDevice.borderColor).toBe(0x05);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      ulaBorderColor: 0x05,
      ulaEarBit: true,
      ulaMicBit: true,
      ulaBeeperEar: true,
      ulaBeeperMic: true
    });
    expect(wasm.zxnextReadPort(0xfffe)).toBe(0xff);

    machine.doWritePort(0x00fe, 0x02);
    expect(machine.composedScreenDevice.borderColor).toBe(0x02);
    expect(wasm.zxnextGetUlaEarBit()).toBe(0);
    expect(wasm.zxnextGetUlaMicBit()).toBe(0);
    expect(wasm.zxnextReadPort(0xfffe)).toBe(0xbf);
  });

  it("matches TypeScript issue 2 and issue 3 behavior for MIC contribution to bit 6", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    wasmMachine.doWritePort(0x00fe, 0x08);
    oracleMachine.doWritePort(0x00fe, 0x08);
    expect(wasmMachine.doReadPort(0xfffe)).toBe(oracleMachine.doReadPort(0xfffe));
    expect(wasmMachine.doReadPort(0xfffe)).toBe(0xbf);

    wasmMachine.nextRegDevice.directSetRegValue(0x08, 0x1b);
    oracleMachine.nextRegDevice.directSetRegValue(0x08, 0x1b);
    wasmMachine.doWritePort(0x00fe, 0x08);
    oracleMachine.doWritePort(0x00fe, 0x08);

    expect(wasmMachine.doReadPort(0xfffe)).toBe(oracleMachine.doReadPort(0xfffe));
    expect(wasmMachine.doReadPort(0xfffe)).toBe(0xff);
  });

  it("matches TypeScript analog EAR decay across tact deltas", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);
    const wasm = wasmMachine.wasmV2Runtime!.exports;

    setMachineTacts(wasmMachine, 100);
    setMachineTacts(oracleMachine, 100);
    wasmMachine.doWritePort(0x00fe, 0x10);
    oracleMachine.doWritePort(0x00fe, 0x10);

    setMachineTacts(wasmMachine, 110);
    setMachineTacts(oracleMachine, 110);
    wasmMachine.doWritePort(0x00fe, 0x00);
    oracleMachine.doWritePort(0x00fe, 0x00);

    expect(wasm.zxnextGetUlaBit4ChangedFrom0Tacts()).toBe(100);
    expect(wasm.zxnextGetUlaBit4ChangedFrom1Tacts()).toBe(110);

    setMachineTacts(wasmMachine, 149);
    setMachineTacts(oracleMachine, 149);
    expect(wasmMachine.doReadPort(0xfffe)).toBe(oracleMachine.doReadPort(0xfffe));
    expect(wasmMachine.doReadPort(0xfffe) & 0x40).toBe(0x40);

    setMachineTacts(wasmMachine, 150);
    setMachineTacts(oracleMachine, 150);
    expect(wasmMachine.doReadPort(0xfffe)).toBe(oracleMachine.doReadPort(0xfffe));
    expect(wasmMachine.doReadPort(0xfffe) & 0x40).toBe(0x00);
  });

  it("bridges extended keyboard NextRegs 0xB0..0xB2 through public APIs", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);
    const wasmKeyboard = wasmMachine.keyboardDevice;
    const oracleKeyboard = oracleMachine.keyboardDevice;

    wasmKeyboard.semicolonPressed = true;
    wasmKeyboard.dotPressed = true;
    wasmKeyboard.rightPressed = true;
    oracleKeyboard.semicolonPressed = true;
    oracleKeyboard.dotPressed = true;
    oracleKeyboard.rightPressed = true;

    wasmKeyboard.deletePressed = true;
    wasmKeyboard.graphPressed = true;
    oracleKeyboard.deletePressed = true;
    oracleKeyboard.graphPressed = true;

    wasmKeyboard.rightPadXPressed = true;
    wasmKeyboard.leftPadModePressed = true;
    oracleKeyboard.rightPadXPressed = true;
    oracleKeyboard.leftPadModePressed = true;

    for (const reg of [0xb0, 0xb1, 0xb2]) {
      expect(wasmMachine.nextRegDevice.directGetRegValue(reg), `direct ${reg.toString(16)}`).toBe(
        oracleMachine.nextRegDevice.directGetRegValue(reg)
      );
    }

    wasmMachine.doWritePort(0x243b, 0xb1);
    oracleMachine.doWritePort(0x243b, 0xb1);
    expect(wasmMachine.doReadPort(0x253b)).toBe(oracleMachine.doReadPort(0x253b));
    expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetExtendedKeyReg(1)).toBe(
      oracleMachine.nextRegDevice.directGetRegValue(0xb1)
    );
  });
});

function rowAddress(row: number): number {
  return (0xffff & ~(1 << (8 + row))) & 0xfffe;
}

function setMachineTacts(
  machine: { tacts: number; wasmV2Runtime?: { exports: { zxnextSetTacts: (...args: number[]) => number } } },
  tacts: number
): void {
  machine.tacts = tacts;
  machine.wasmV2Runtime?.exports.zxnextSetTacts(tacts);
}
