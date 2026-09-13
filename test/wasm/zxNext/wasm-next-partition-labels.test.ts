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

  /*
   * A positive partition index is the **8K page** the MMU names, on both cores.
   *
   * The two sides of the system used to disagree about this: `getPartitionForPage` halved the MMU
   * value to a 16K bank, while `getMemoryPartition(index)` read an 8K slice at
   * `OFFS_NEXT_RAM + 0x2000 * index`. So `bp-set 0A:$C000` and selecting bank `0A` in the Memory
   * view named different memory. Four things already said 8K — the 224-entry label map,
   * `MF_BANK: 224`, `getMemoryPartition`, and the docs — so the resolver was the outlier.
   *
   * The sibling parity test above only asserts the two cores *agree*; this one pins the value they
   * must agree on. See `.plans/NEX_DEBUGGING_PLAN.md` §4.1 (Q9).
   */
  it("reports a positive partition as the 8K page the MMU names", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();

    // --- Distinct 8K banks, all below the 224 threshold that diverts to the ROM decode chain.
    // --- Pages 4 and 5 are deliberately the two halves of one 16K bank (2), and pages 0/1 and 6/7
    // --- likewise, so a resolver that answered in 16K banks would collapse each pair.
    const banks = [0x10, 0x11, 0x22, 0x23, 0x04, 0x05, 0x36, 0x37];

    for (const machine of [oracle, wasm]) {
      banks.forEach((bank, page) => writeNextReg(machine, 0x50 + page, bank));
    }

    for (const machine of [oracle, wasm]) {
      banks.forEach((bank, page) => {
        expect(machine.getPartition(page * 0x2000), `page ${page}`).toBe(bank);
      });
      expect(machine.getCurrentPartitions()).toEqual(banks);
    }
  });

  it("gives the two 8K halves of one 16K bank different partitions", async () => {
    // --- This is the property bank-relative breakpoints rest on: an offset in a bank's low half
    // --- must not match a page holding its high half. Under the old 16K reading both halves
    // --- reported the same partition and the distinction was impossible.
    const { oracle, wasm } = await createZxNextOracleHarness();

    for (const machine of [oracle, wasm]) {
      writeNextReg(machine, 0x54, 0x04); // --- 16K bank 2, low half, at $8000
      writeNextReg(machine, 0x55, 0x05); // --- 16K bank 2, high half, at $A000
    }

    for (const machine of [oracle, wasm]) {
      expect(machine.getPartition(0x8000)).toBe(0x04);
      expect(machine.getPartition(0xa000)).toBe(0x05);
      expect(machine.getPartition(0x8000)).not.toBe(machine.getPartition(0xa000));
    }
  });

  it("keeps public label parsing compatible with TypeScript", async () => {
    const { oracle, wasm } = await createZxNextOracleHarness();
    const labels = ["UN", "R0", "R3", "X0", "X1", "Q0", "Q1", "DM", "M0", "MF", "00", "DF"];

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
