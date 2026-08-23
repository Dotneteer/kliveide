import { describe, expect, it } from "vitest";

import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine
} from "./wasm-test-helpers";

describe("ZX Spectrum WASM partition labels", () => {
  it("keeps 48K partition labels undefined", async () => {
    const machine = await createTestSp48WasmMachine();

    for (const label of ["R0", "R1", "0", "B0", ""]) {
      expect(machine.parsePartitionLabel(label), label).toBeUndefined();
    }
    expect(machine.getPartitionLabels()).toEqual({});
  });

  it("maps 128K ROM and RAM partition labels", async () => {
    const machine = await createTestSp128WasmMachine();
    const cases = [
      ["R0", -1],
      ["R1", -2],
      ["R2", undefined],
      ["B0", 0],
      ["B7", 7],
      ["B8", undefined],
      [" b7 ", 7]
    ] as const;

    for (const [label, partition] of cases) {
      expect(machine.parsePartitionLabel(label), label).toBe(partition);
    }
    expect(machine.getPartitionLabels()).toEqual({
      [-2]: "R1",
      [-1]: "R0",
      0: "B0",
      1: "B1",
      2: "B2",
      3: "B3",
      4: "B4",
      5: "B5",
      6: "B6",
      7: "B7"
    });
  });

  it("maps +2E/+3E ROM and RAM partition labels", async () => {
    const machine = await createTestSpp3eWasmMachine();
    const cases = [
      ["R0", -1],
      ["R1", -2],
      ["R2", -3],
      ["R3", -4],
      ["R4", undefined],
      ["B0", 0],
      ["B7", 7],
      ["B8", undefined],
      [" r3 ", -4]
    ] as const;

    for (const [label, partition] of cases) {
      expect(machine.parsePartitionLabel(label), label).toBe(partition);
    }
    expect(machine.getPartitionLabels()).toEqual({
      [-1]: "R0",
      [-2]: "R1",
      [-3]: "R2",
      [-4]: "R3",
      0: "B0",
      1: "B1",
      2: "B2",
      3: "B3",
      4: "B4",
      5: "B5",
      6: "B6",
      7: "B7"
    });
  });
});
