import { describe, it, expect } from "vitest";
import { M6510TestMachine, RunMode } from "./test-m6510";

describe("BIT Debug", () => {
  it("Debug BIT flag behavior", () => {
    const testCases = [
      { memory: 0x00, accumulator: 0xFF, expectedZ: true, expectedV: false, expectedN: false },
      { memory: 0x40, accumulator: 0x00, expectedZ: true, expectedV: true, expectedN: false },
      { memory: 0x80, accumulator: 0x00, expectedZ: true, expectedV: false, expectedN: true },
      { memory: 0xC0, accumulator: 0x00, expectedZ: true, expectedV: true, expectedN: true },
      { memory: 0x7F, accumulator: 0xFF, expectedZ: false, expectedV: true, expectedN: false },
      { memory: 0xBF, accumulator: 0xFF, expectedZ: false, expectedV: true, expectedN: true },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const machine = new M6510TestMachine(RunMode.OneInstruction);
      machine.initCode([0x24, 0x50], 0x1000, 0x1000); // BIT $50
      machine.memory[0x50] = testCase.memory;
      machine.cpu.a = testCase.accumulator;

      machine.run();

      console.log(`Test case ${i}: memory=0x${testCase.memory.toString(16).padStart(2, '0')}, acc=0x${testCase.accumulator.toString(16).padStart(2, '0')}`);
      console.log(`  Expected: Z=${testCase.expectedZ}, V=${testCase.expectedV}, N=${testCase.expectedN}`);
      console.log(`  Actual:   Z=${machine.cpu.isZFlagSet()}, V=${machine.cpu.isVFlagSet()}, N=${machine.cpu.isNFlagSet()}`);
      console.log(`  Memory bits: 7=${(testCase.memory & 0x80) !== 0}, 6=${(testCase.memory & 0x40) !== 0}`);
      console.log(`  AND result: 0x${(testCase.memory & testCase.accumulator).toString(16)}`);
      
      if (machine.cpu.isZFlagSet() !== testCase.expectedZ ||
          machine.cpu.isVFlagSet() !== testCase.expectedV ||
          machine.cpu.isNFlagSet() !== testCase.expectedN) {
        console.log(`  *** MISMATCH at test case ${i} ***`);
      }
    }
  });
});
