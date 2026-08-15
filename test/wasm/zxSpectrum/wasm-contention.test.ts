import { describe, expect, it } from "vitest";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom,
  type TestOracleSp128Machine,
  type TestOracleSp48Machine,
  type TestOracleSpp3eMachine,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;
type OracleMachine = TestOracleSp48Machine | TestOracleSp128Machine | TestOracleSpp3eMachine;

type ContentionCase = {
  name: string;
  createWasmMachine: () => Promise<WasmMachine>;
  createOracleMachine: () => Promise<OracleMachine>;
};

describe("ZX Spectrum WASM contention parity", () => {
  for (const testCase of contentionCases()) {
    it(`${testCase.name} generated contention table matches representative TypeScript tacts`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();
      const activeDisplayTact = findTact(oracleMachine, value => value > 0);
      const inactiveTact = findTact(oracleMachine, value => value === 0);
      const tacts = uniqueTacts([
        0,
        inactiveTact,
        activeDisplayTact,
        activeDisplayTact + 1,
        activeDisplayTact + 5,
        oracleMachine.tactsInFrame - 1
      ], oracleMachine.tactsInFrame);

      expect(oracleMachine.getContentionValueForTest(activeDisplayTact)).toBeGreaterThan(0);
      expect(oracleMachine.getContentionValueForTest(inactiveTact)).toBe(0);
      for (const tact of tacts) {
        expect(wasmMachine.getContentionValueForTest(tact), `${testCase.name} tact ${tact}`).toBe(
          oracleMachine.getContentionValueForTest(tact)
        );
      }
    });
  }

  it("48K delays only the contended 0x4000-0x7fff memory range", async () => {
    const wasmMachine = await createTestSp48WasmMachine(testRom([]));
    const oracleMachine = await createOracleSp48Machine(testRom([]));
    const tact = findTact(oracleMachine, value => value > 0);

    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0x4000, "sp48");
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0x8000, "sp48");
  });

  it("128K delays 0x4000 and the top slot only when an odd RAM bank is selected", async () => {
    const wasmMachine = await createTestSp128WasmMachine(testRom([]), testRom([]));
    const oracleMachine = await createOracleSp128Machine(testRom([]), testRom([]));
    const tact = findTact(oracleMachine, value => value > 0);

    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0x4000, "sp128");

    wasmMachine.writeTestPort(0x7ffd, 0x03);
    oracleMachine.writeTestPort(0x7ffd, 0x03);
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0xc000, "sp128");

    wasmMachine.writeTestPort(0x7ffd, 0x04);
    oracleMachine.writeTestPort(0x7ffd, 0x04);
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0xc000, "sp128");
  });

  it("+3E delays the top slot when RAM bank 4-7 is selected", async () => {
    const wasmMachine = await createTestSpp3eWasmMachine([testRom([]), testRom([]), testRom([]), testRom([])]);
    const oracleMachine = await createOracleSpp3eMachine([testRom([]), testRom([]), testRom([]), testRom([])]);
    const tact = findTact(oracleMachine, value => value > 0);

    wasmMachine.writeTestPort(0x7ffd, 0x04);
    oracleMachine.writeTestPort(0x7ffd, 0x04);
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0xc000, "spp3e");

    wasmMachine.writeTestPort(0x7ffd, 0x03);
    oracleMachine.writeTestPort(0x7ffd, 0x03);
    expectDelayForAddress(wasmMachine, oracleMachine, tact, 0xc000, "spp3e");
  });
});

function contentionCases(): ContentionCase[] {
  const rom = testRom([]);
  return [
    {
      name: "ZX Spectrum 48K",
      createWasmMachine: () => createTestSp48WasmMachine(rom),
      createOracleMachine: () => createOracleSp48Machine(rom)
    },
    {
      name: "ZX Spectrum 128K",
      createWasmMachine: () => createTestSp128WasmMachine(rom, rom),
      createOracleMachine: () => createOracleSp128Machine(rom, rom)
    },
    {
      name: "ZX Spectrum +3E",
      createWasmMachine: () => createTestSpp3eWasmMachine([rom, rom, rom, rom]),
      createOracleMachine: () => createOracleSpp3eMachine([rom, rom, rom, rom])
    }
  ];
}

function findTact(machine: OracleMachine, predicate: (value: number) => boolean): number {
  for (let tact = 0; tact < machine.tactsInFrame; tact++) {
    if (predicate(machine.getContentionValueForTest(tact))) {
      return tact;
    }
  }
  throw new Error("Could not find a matching contention tact.");
}

function uniqueTacts(tacts: number[], tactsInFrame: number): number[] {
  return [...new Set(tacts.map(tact => ((tact % tactsInFrame) + tactsInFrame) % tactsInFrame))];
}

function expectDelayForAddress(
  wasmMachine: WasmMachine,
  oracleMachine: OracleMachine,
  tact: number,
  address: number,
  prefix: "sp48" | "sp128" | "spp3e"
): void {
  wasmMachine.setAbsoluteTacts(tact);
  oracleMachine.setFrameTact(tact);
  wasmMachine.resetContentionCounters();
  oracleMachine.resetContentionCounters();

  delayWasmAddressBusAccess(wasmMachine, address, prefix);
  oracleMachine.delayAddressBusAccess(address);

  expect(wasmMachine.getContentionDelayTotalForTest(), `${prefix} ${address.toString(16)}`).toBe(
    oracleMachine.getContentionDelayTotalForTest()
  );
}

function delayWasmAddressBusAccess(
  machine: WasmMachine,
  address: number,
  prefix: "sp48" | "sp128" | "spp3e"
): void {
  if (prefix === "sp128") {
    machine.delayAddressBusAccess(address);
    return;
  }
  const fn = (machine.wasmV2Runtime!.exports as Record<string, unknown>)[
    `${prefix}DelayAddressBusAccess`
  ];
  if (typeof fn !== "function") {
    throw new Error(`${prefix}DelayAddressBusAccess is not available.`);
  }
  (fn as (address: number) => void)(address & 0xffff);
  machine.getCpuState();
}
