import { describe, expect, it } from "vitest";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const CTC_STATE_CONTROL_WORD = 0;
const CTC_STATE_RUNNING = 3;

describe("ZX Spectrum Next WASM v2 CTC", () => {
  it("programs and reads channels 0-3 through the CTC ports", async () => {
    const machine = await createTestZxNextWasmMachine();

    programTimer(machine, 0x183b, 0x10);
    programTimer(machine, 0x193b, 0x20);
    programTimer(machine, 0x1a3b, 0x30);
    programTimer(machine, 0x1b3b, 0x40);

    expect(machine.doReadPort(0x183b)).toBe(0x10);
    expect(machine.doReadPort(0x193b)).toBe(0x20);
    expect(machine.doReadPort(0x1a3b)).toBe(0x30);
    expect(machine.doReadPort(0x1b3b)).toBe(0x40);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      ctcChannel0State: CTC_STATE_RUNNING,
      ctcChannel0TimeConstant: 0x10,
      ctcChannel0Count: 0x10
    });
  });

  it("returns disabled and hardwired channel values like the TypeScript CTC", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.writeNextReg(0x85, 0x07);
    machine.doWritePort(0x183b, 0x05);
    machine.doWritePort(0x183b, 0x10);

    expect(machine.doReadPort(0x183b)).toBe(0xff);
    expect(wasm.zxnextGetCtcChannelState(0)).toBe(CTC_STATE_CONTROL_WORD);

    machine.writeNextReg(0x85, 0x08);
    expect(machine.doReadPort(0x1c3b)).toBe(0x00);
    expect(machine.doReadPort(0x1f3b)).toBe(0x00);
  });

  it("advances timer channels lazily to an explicit system clock and raises enabled interrupts", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    programTimer(machine, 0x183b, 0x01);
    machine.writeNextReg(0xc5, 0x01);

    const startClock = wasm.zxnextGetCtcLastSyncClock();
    wasm.zxnextCtcAdvanceToSysClock(startClock + 16);

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      interruptCtcEnabledMask: 0x01,
      interruptCtcStatusMask: 0x01
    });
    expect(wasm.zxnextGetCtcCount(0)).toBe(0x01);
    expect(wasm.zxnextGetCtcLastSyncClock()).toBe(startClock + 16);
  });

  it("single-clock stepping preserves ZC/TO timing and channel chaining", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    programTimer(machine, 0x183b, 0x01);
    programCounter(machine, 0x193b, 0x03);

    for (let i = 0; i < 16; i++) wasm.zxnextCtcClockTick();
    expect(wasm.zxnextGetCtcCount(0)).toBe(0);
    expect(wasm.zxnextGetCtcCount(1)).toBe(3);
    expect(machine.getWasmV2Diagnostics().interruptCtcStatusMask & 0x01).toBe(0);

    wasm.zxnextCtcClockTick();
    expect(wasm.zxnextGetCtcZcTo(0)).toBe(1);
    expect(machine.getWasmV2Diagnostics().interruptCtcStatusMask & 0x01).toBe(0x01);
    expect(wasm.zxnextGetCtcCount(1)).toBe(3);

    wasm.zxnextCtcClockTick();
    expect(wasm.zxnextGetCtcCount(1)).toBe(2);
  });

  it("distinguishes IM2 vector writes from time-constant bytes", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x183b, 0xfe);
    expect(wasm.zxnextGetCtcIm2VectorWrite()).toBe(1);

    machine.wasmV2Runtime!.exports.zxnextNextRegReset();
    machine.doWritePort(0x183b, 0x05);
    expect(wasm.zxnextGetCtcExpectingTimeConstant(0)).toBe(1);
    machine.doWritePort(0x183b, 0xfe);

    expect(wasm.zxnextGetCtcIm2VectorWrite()).toBe(0);
    expect(wasm.zxnextGetCtcTimeConstant(0)).toBe(0xfe);
    expect(wasm.zxnextGetCtcChannelState(0)).toBe(CTC_STATE_RUNNING);
  });

  it("reset clears CTC channel and sync state", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    programTimer(machine, 0x183b, 0x10);
    wasm.zxnextCtcClockTick();
    expect(wasm.zxnextGetCtcChannelState(0)).toBe(CTC_STATE_RUNNING);

    wasm.zxnextNextRegReset();
    expect(wasm.zxnextGetCtcChannelState(0)).toBe(CTC_STATE_CONTROL_WORD);
    expect(wasm.zxnextGetCtcCount(0)).toBe(0);
    expect(wasm.zxnextGetCtcControlReg(0)).toBe(0);
    expect(wasm.zxnextGetCtcLastSyncClock()).toBe(0);
  });
});

function programTimer(machine: { doWritePort: (address: number, value: number) => void }, port: number, tc: number): void {
  machine.doWritePort(port, 0x05);
  machine.doWritePort(port, tc & 0xff);
}

function programCounter(machine: { doWritePort: (address: number, value: number) => void }, port: number, tc: number): void {
  machine.doWritePort(port, 0x55);
  machine.doWritePort(port, tc & 0xff);
}
