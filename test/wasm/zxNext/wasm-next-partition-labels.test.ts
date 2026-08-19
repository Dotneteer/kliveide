import { describe, expect, it } from "vitest";

import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

type LabelMachine = TestZxNextMachine | ZxNextWasmV2Machine;

describe("ZX Spectrum Next WASM partition label parity", () => {
  it("matches reset, MMU RAM, system-region, alternate ROM, and all-RAM labels", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();

    expectSameLabels(wasm, oracle);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x50, 0x04);
      writeNextReg(machine, 0x51, 0x05);
      writeNextReg(machine, 0x52, 0xe0);
    }
    expectSameLabels(wasm, oracle);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x8c, 0x80);
      writeNextReg(machine, 0x50, 0xff);
      writeNextReg(machine, 0x51, 0xff);
    }
    expectSameLabels(wasm, oracle);

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x8e, 0x07);
    }
    expectSameLabels(wasm, oracle);
  });

  it("keeps public label parsing compatible with TypeScript", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const labels = ["UN", "R0", "R3", "Q0", "Q1", "DM", "M0", "MF", "00", "DF"];

    for (const label of labels) {
      expect(wasm.parsePartitionLabel(label), label).toBe(oracle.parsePartitionLabel(label));
    }
    expect(wasm.getPartitionLabels()).toEqual(oracle.getPartitionLabels());
  });
});

function expectSameLabels(wasm: ZxNextWasmV2Machine, oracle: TestZxNextMachine): void {
  expect(wasm.getCurrentPartitionLabels()).toEqual(oracle.getCurrentPartitionLabels());
  expect(wasm.getCurrentPartitions()).toEqual(oracle.getCurrentPartitions());
  for (const address of [0x0000, 0x2000, 0x4000, 0x8000, 0xc000, 0xe000]) {
    expect(wasm.getPartition(address), address.toString(16)).toBe(oracle.getPartition(address));
  }
}

function writeNextReg(machine: LabelMachine, reg: number, value: number): void {
  machine.nextRegDevice.setNextRegisterIndex(reg);
  machine.nextRegDevice.setNextRegisterValue(value);
}
