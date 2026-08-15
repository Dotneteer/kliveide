import { describe, expect, it } from "vitest";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine
} from "./wasm-test-helpers";

describe("ZX Spectrum WASM partition label parity", () => {
  it("keeps 48K partition labels undefined", async () => {
    const wasmMachine = await createTestSp48WasmMachine();
    const oracleMachine = await createOracleSp48Machine();

    for (const label of ["R0", "R1", "0", "B0", ""]) {
      expect(wasmMachine.parsePartitionLabel(label), label).toBe(
        oracleMachine.parsePartitionLabel(label)
      );
      expect(wasmMachine.parsePartitionLabel(label), label).toBeUndefined();
    }
    expect(wasmMachine.getPartitionLabels()).toEqual(oracleMachine.getPartitionLabels());
  });

  it("maps 128K ROM and RAM partition labels like TypeScript", async () => {
    const wasmMachine = await createTestSp128WasmMachine();
    const oracleMachine = await createOracleSp128Machine();
    const cases = [
      ["R0", -1],
      ["R1", -2],
      ["R2", undefined],
      ["R3", undefined],
      ["B0", 0],
      ["B1", 1],
      ["B2", 2],
      ["B3", 3],
      ["B4", 4],
      ["B5", 5],
      ["B6", 6],
      ["B7", 7],
      ["B8", undefined],
      [" b7 ", 7]
    ] as const;

    for (const [label, partition] of cases) {
      expect(wasmMachine.parsePartitionLabel(label), label).toBe(
        oracleMachine.parsePartitionLabel(label)
      );
      expect(wasmMachine.parsePartitionLabel(label), label).toBe(partition);
    }
    expect(wasmMachine.getPartitionLabels()).toEqual(oracleMachine.getPartitionLabels());
  });

  it("maps +2E/+3E ROM and RAM partition labels like TypeScript", async () => {
    const wasmMachine = await createTestSpp3eWasmMachine();
    const oracleMachine = await createOracleSpp3eMachine();
    const cases = [
      ["R0", -1],
      ["R1", -2],
      ["R2", -3],
      ["R3", -4],
      ["R4", undefined],
      ["B0", 0],
      ["B1", 1],
      ["B2", 2],
      ["B3", 3],
      ["B4", 4],
      ["B5", 5],
      ["B6", 6],
      ["B7", 7],
      ["B8", undefined],
      [" r3 ", -4]
    ] as const;

    for (const [label, partition] of cases) {
      expect(wasmMachine.parsePartitionLabel(label), label).toBe(
        oracleMachine.parsePartitionLabel(label)
      );
      expect(wasmMachine.parsePartitionLabel(label), label).toBe(partition);
    }
    expect(wasmMachine.getPartitionLabels()).toEqual(oracleMachine.getPartitionLabels());
  });
});
