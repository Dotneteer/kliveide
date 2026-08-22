import { describe, expect, it } from "vitest";
import { CtcChannel } from "@emu/machines/zxNext/CtcDevice";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { createTestZxNextWasmMachine, createZxNextOracleHarness } from "./wasm-next-test-helpers";

type CtcPortMachine = TestZxNextMachine | ZxNextWasmV2Machine;

describe("ZX Next WASM CTC device", () => {
  it("matches TypeScript channel control/time-constant/run state", async () => {
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;
    const oracle = new CtcChannel();

    const clock = (iowr: boolean, data: number, clkTrg = false, intEnWr = false, intEn = false): void => {
      oracle.clock(iowr, data, clkTrg, intEnWr, intEn);
      exports.zxnextCtcClock(0, iowr ? 1 : 0, data, clkTrg ? 1 : 0, intEnWr ? 1 : 0, intEn ? 1 : 0);
    };

    clock(true, 0x05);
    clock(false, 0x05);
    clock(true, 0x03);
    clock(false, 0x03);
    for (let i = 0; i < 20; i++) clock(false, 0x00);
    clock(false, 0x00, false, true, true);

    expect(exports.zxnextGetCtcState(0)).toBe(oracle.state);
    expect(exports.zxnextGetCtcControlReg(0)).toBe(oracle.controlReg);
    expect(exports.zxnextGetCtcTimeConstant(0)).toBe(oracle.timeConstantReg);
    expect(exports.zxnextGetCtcCount(0)).toBe(oracle.count);
    expect(Boolean(exports.zxnextGetCtcZcTo(0))).toBe(oracle.zcTo);
    expect(Boolean(exports.zxnextGetCtcIntEnabled(0))).toBe(oracle.intEnabled);
    expect(Boolean(exports.zxnextGetCtcExpectingTimeConstant(0))).toBe(oracle.expectingTimeConstant);
  });

  it("routes public CTC ports with TypeScript-compatible gating", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x85, 0x08);
      machine.doWritePort(0x183b, 0x05);
      machine.doWritePort(0x183b, 0x40);
    }

    expect(wasm.doReadPort(0x183b)).toBe(oracle.doReadPort(0x183b));
    expect(wasm.wasmV2Runtime!.exports.zxnextGetCtcState(0)).toBe(oracle.ctcDevice.channels[0].state);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetCtcCount(0)).toBe(oracle.ctcDevice.channels[0].count);

    for (const machine of [oracle, wasm]) writeNextReg(machine, 0x85, 0x07);
    expect(wasm.doReadPort(0x183b)).toBe(oracle.doReadPort(0x183b));
  });

  it("lazy-syncs timer-mode CTC advancement before public port reads", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    oracle.hardReset();
    wasm.hardReset();

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x85, 0x08);
      machine.doWritePort(0x183b, 0x05);
      machine.doWritePort(0x183b, 0x01);
    }

    oracle.frameTacts = 24;
    wasm.wasmV2Runtime!.exports.zxnextSetTacts(3);

    expect(wasm.doReadPort(0x183b)).toBe(oracle.doReadPort(0x183b));
    expect(wasm.wasmV2Runtime!.exports.zxnextGetCtcCount(0)).toBe(oracle.ctcDevice.channels[0].count);
  });
});

function writeNextReg(machine: CtcPortMachine, reg: number, value: number): void {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  machine.nextRegDevice.setNextRegisterValue(value);
}
