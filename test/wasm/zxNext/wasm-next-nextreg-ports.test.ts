import { describe, expect, it } from "vitest";

import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const RESET_REGS = [
  0x00, 0x01, 0x02, 0x03, 0x05, 0x06, 0x08, 0x0a, 0x0e,
  0x12, 0x13, 0x14, 0x42, 0x43, 0x4b, 0x4c,
  0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57,
  0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8c,
  0xa9, 0xb8, 0xb9, 0xba, 0xbb
];

describe("ZX Spectrum Next WASM v2 NextReg ports", () => {
  it("matches TypeScript hard-reset defaults for boot-relevant NextRegs", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();
    wasmMachine.nextRegDevice.hardReset();
    oracleMachine.nextRegDevice.hardReset();

    for (const reg of RESET_REGS) {
      expect(wasmMachine.nextRegDevice.directGetRegValue(reg), `reg ${hex(reg)}`).toBe(
        oracleMachine.nextRegDevice.directGetRegValue(reg)
      );
    }
  });

  it("implements NextReg index/data ports through the public machine API", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.doWritePort(0x243b, 0x52);
    expect(machine.doReadPort(0x243b)).toBe(0x52);
    machine.doWritePort(0x253b, 0x12);

    expect(machine.doReadPort(0x253b)).toBe(0x12);
    expect(wasm.zxnextGetNextRegIndex()).toBe(0x52);
    expect(wasm.zxnextGetMmuReg(2)).toBe(0x12);
    expect(machine.getCurrentPartitions()[2]).toBe(0x09);
  });

  it("bridges nextRegDevice value/state reads to WASM-owned registers", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.nextRegDevice.setNextRegisterIndex(0x82);
    machine.nextRegDevice.setNextRegisterValue(0xfd);

    expect(machine.nextRegDevice.getNextRegisterIndex()).toBe(0x82);
    expect(machine.nextRegDevice.getNextRegisterValue()).toBe(0xfd);
    expect(machine.nextRegDevice.directGetRegValue(0x82)).toBe(0xfd);
    expect(machine.wasmV2Runtime!.exports.zxnextIsPortGroupEnabled(0, 1)).toBe(0);

    const descriptor = machine.nextRegDevice.getDescriptors().find((reg) => reg.id === 0x82);
    const state = machine.nextRegDevice.getNextRegDeviceState();
    const regState = state.regs.find((reg) => reg.id === 0x82);

    expect(descriptor?.description).toContain("Internal Port Decoding Enables #1");
    expect(state.lastRegisterIndex).toBe(0x82);
    expect(regState).toMatchObject({ id: 0x82, lastWrite: 0xfd, value: 0xfd });
  });

  it("blocks memory paging ports when the matching internal gates are cleared", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.nextRegDevice.directSetRegValue(0x82, 0xf1);
    machine.nextRegDevice.directSetRegValue(0x85, 0x0b);
    machine.doWritePort(0x7ffd, 0x05);
    machine.doWritePort(0xdffd, 0x03);
    machine.doWritePort(0x1ffd, 0x01);
    machine.doWritePort(0xeff7, 0x08);

    expect(wasm.zxnextGetPort7ffdValue()).toBe(0x00);
    expect(wasm.zxnextGetPortDffdValue()).toBe(0x00);
    expect(wasm.zxnextGetPort1ffdValue()).toBe(0x00);
    expect(wasm.zxnextGetPortEff7Value()).toBe(0x00);
    expect(machine.getCurrentPartitions()).toEqual([0xff, 0xff, 5, 5, 2, 2, 0, 0]);
  });

  it("matches TypeScript port-enable checks including expansion-bus AND masking", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();

    for (let regIndex = 0; regIndex < 4; regIndex++) {
      for (let bit = 0; bit < 8; bit++) {
        if (regIndex === 3 && bit >= 4 && bit < 7) continue;
        expect(wasmMachine.nextRegDevice.isPortGroupEnabled(regIndex, bit), `${regIndex}:${bit}`).toBe(
          oracleMachine.nextRegDevice.isPortGroupEnabled(regIndex, bit)
        );
      }
    }

    wasmMachine.nextRegDevice.directSetRegValue(0x80, 0x80);
    oracleMachine.nextRegDevice.directSetRegValue(0x80, 0x80);
    wasmMachine.nextRegDevice.directSetRegValue(0x86, 0xfd);
    oracleMachine.nextRegDevice.directSetRegValue(0x86, 0xfd);

    expect(wasmMachine.nextRegDevice.isPortGroupEnabled(0, 1)).toBe(false);
    expect(wasmMachine.nextRegDevice.isPortGroupEnabled(0, 1)).toBe(
      oracleMachine.nextRegDevice.isPortGroupEnabled(0, 1)
    );

    wasmMachine.doWritePort(0x7ffd, 0x05);
    oracleMachine.doWritePort(0x7ffd, 0x05);
    expect(wasmMachine.getCurrentPartitions()).toEqual(oracleMachine.getCurrentPartitions());
    expect(wasmMachine.wasmV2Runtime!.exports.zxnextGetPort7ffdValue()).toBe(0x00);
  });

  it("keeps hard and soft reset gate semantics aligned with TypeScript", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();

    wasmMachine.nextRegDevice.directSetRegValue(0x82, 0x00);
    oracleMachine.nextRegDevice.directSetRegValue(0x82, 0x00);
    wasmMachine.nextRegDevice.reset();
    oracleMachine.nextRegDevice.reset();
    expect(wasmMachine.nextRegDevice.directGetRegValue(0x82)).toBe(
      oracleMachine.nextRegDevice.directGetRegValue(0x82)
    );

    wasmMachine.nextRegDevice.hardReset();
    oracleMachine.nextRegDevice.hardReset();
    for (const reg of [0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89]) {
      expect(wasmMachine.nextRegDevice.directGetRegValue(reg), `reg ${hex(reg)}`).toBe(
        oracleMachine.nextRegDevice.directGetRegValue(reg)
      );
    }
  });

  it("tracks config mode through NextReg 0x03 writes", async () => {
    const { wasmMachine, oracleMachine } = await createMachinePair();
    const wasm = wasmMachine.wasmV2Runtime!.exports;

    wasmMachine.tbblueOut(0x03, 0x07);
    oracleMachine.tbblueOut(0x03, 0x07);
    expect(wasm.zxnextGetNextRegConfigMode()).toBe(1);
    expect(wasmMachine.nextRegDevice.configMode).toBe(oracleMachine.nextRegDevice.configMode);

    wasmMachine.tbblueOut(0x03, 0x03);
    oracleMachine.tbblueOut(0x03, 0x03);
    expect(wasm.zxnextGetNextRegConfigMode()).toBe(0);
    expect(wasmMachine.nextRegDevice.configMode).toBe(oracleMachine.nextRegDevice.configMode);
  });
});

async function createMachinePair() {
  const romSet = createTestZxNextRomSet();
  const wasmMachine = await createTestZxNextWasmMachine(romSet);
  const oracleMachine = await createOracleZxNextMachine(romSet);
  return { wasmMachine, oracleMachine };
}

function hex(value: number): string {
  return `0x${value.toString(16).padStart(2, "0")}`;
}
