import { describe, expect, it } from "vitest";

import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  for128Family,
  for48And128AndP3e,
  forP3eDiskModels,
  testRom
} from "./wasm-test-helpers";

describe("ZX Spectrum WASM test helpers", () => {
  it("creates deterministic WASM machines", async () => {
    const rom48 = testRom([0x00]);
    const rom1280 = testRom([0x10]);
    const rom1281 = testRom([0x11]);
    const romP3e = [testRom([0x20]), testRom([0x21]), testRom([0x22]), testRom([0x23])];

    const sp48 = await createTestSp48WasmMachine(rom48);
    expect(sp48.implementation).toBe("wasm");
    expect(sp48.readTestMemory(0x0000)).toBe(0x00);

    const sp128 = await createTestSp128WasmMachine(rom1280, rom1281);
    expect(sp128.getMemoryPartition(-1)[0]).toBe(0x10);
    expect(sp128.getMemoryPartition(-2)[0]).toBe(0x11);
    expect(sp128.getCurrentPartitions()).toEqual([-1, -1, 5, 5, 2, 2, 0, 0]);

    const spp3e = await createTestSpp3eWasmMachine(romP3e);
    expect(spp3e.wasmV2Runtime?.exports.spp3eReadRomBank(0, 0)).toBe(0x20);
    expect(spp3e.getCurrentPartitions()).toEqual([-1, -1, 5, 5, 2, 2, 0, 0]);
  });

  it("provides model matrices for migration tests", () => {
    const allModels: string[] = [];
    const familyModels: string[] = [];
    const diskModels: string[] = [];

    for48And128AndP3e(testCase => allModels.push(testCase.id));
    for128Family(testCase => familyModels.push(testCase.id));
    forP3eDiskModels(testCase => diskModels.push(testCase.id));

    expect(allModels).toEqual(["sp48", "sp128", "spp3e"]);
    expect(familyModels).toEqual(["sp128", "spp3e"]);
    expect(diskModels).toEqual(["spp3e"]);
  });
});
