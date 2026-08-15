import { describe, expect, it } from "vitest";

import {
  createOracleSp48Machine,
  createTestSp48WasmMachine,
  expectSameMemoryReads,
  testRom
} from "./wasm-test-helpers";

const BOUNDARY_ADDRESSES = [
  0x0000,
  0x3fff,
  0x4000,
  0x7fff,
  0x8000,
  0xbfff,
  0xc000,
  0xffff
];

const RAM_ADDRESSES = [
  0x4000,
  0x7fff,
  0x8000,
  0xbfff,
  0xc000,
  0xffff
];

describe("ZX Spectrum WASM memory and paging parity", () => {
  describe("48K flat memory", () => {
    it("reads uploaded ROM bytes and keeps ROM immutable through writes", async () => {
      const rom = patternedRom();
      const wasmMachine = await createTestSp48WasmMachine(rom);
      const oracleMachine = await createOracleSp48Machine(rom);

      expectSameMemoryReads(wasmMachine, oracleMachine, [0x0000, 0x0001, 0x1fff, 0x3fff]);

      for (const address of [0x0000, 0x3fff]) {
        const wasmBefore = wasmMachine.doReadMemory(address);
        const oracleBefore = oracleMachine.doReadMemory(address);

        wasmMachine.doWriteMemory(address, 0xa5);
        oracleMachine.doWriteMemory(address, 0xa5);

        expect(wasmMachine.doReadMemory(address), `WASM ROM ${address.toString(16)}`).toBe(
          wasmBefore
        );
        expect(oracleMachine.doReadMemory(address), `TS ROM ${address.toString(16)}`).toBe(
          oracleBefore
        );
      }
    });

    it("mutates RAM through doWriteMemory and agrees with TypeScript at 48K boundaries", async () => {
      const rom = patternedRom();
      const wasmMachine = await createTestSp48WasmMachine(rom);
      const oracleMachine = await createOracleSp48Machine(rom);

      for (const [index, address] of RAM_ADDRESSES.entries()) {
        const value = 0x30 + index;
        wasmMachine.doWriteMemory(address, value);
        oracleMachine.doWriteMemory(address, value);
      }

      expectSameMemoryReads(wasmMachine, oracleMachine, BOUNDARY_ADDRESSES);

      for (const address of BOUNDARY_ADDRESSES) {
        expect(wasmMachine.get64KFlatMemory()[address], `flat ${address.toString(16)}`).toBe(
          oracleMachine.get64KFlatMemory()[address]
        );
        expect(wasmMachine.getPartition(address), `partition ${address.toString(16)}`).toBe(
          oracleMachine.getPartition(address)
        );
      }
    });

    it("routes screen memory reads through the same 48K RAM window as TypeScript", async () => {
      const rom = patternedRom();
      const wasmMachine = await createTestSp48WasmMachine(rom);
      const oracleMachine = await createOracleSp48Machine(rom);
      const screenOffsets = [0x0000, 0x0001, 0x1800, 0x1aff, 0x3fff];

      for (const [index, offset] of screenOffsets.entries()) {
        const value = 0x60 + index;
        wasmMachine.doWriteMemory(0x4000 + offset, value);
        oracleMachine.doWriteMemory(0x4000 + offset, value);
      }

      for (const offset of screenOffsets) {
        expect(wasmMachine.readScreenMemory(offset), `screen ${offset.toString(16)}`).toBe(
          oracleMachine.readScreenMemory(offset)
        );
      }
    });
  });
});

function patternedRom(): Uint8Array {
  const rom = testRom([]);
  rom[0x0000] = 0xf3;
  rom[0x0001] = 0x31;
  rom[0x1fff] = 0x5a;
  rom[0x3fff] = 0xc9;
  return rom;
}
