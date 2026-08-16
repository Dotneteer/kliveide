import { describe, expect, it } from "vitest";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  expectSameMemoryReads,
  expectSamePartitions,
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

  describe("128K and +2-style paging", () => {
    it("starts with the same reset partitions as TypeScript", async () => {
      const rom0 = testRom([0x10]);
      const rom1 = testRom([0x11]);
      const wasmMachine = await createTestSp128WasmMachine(rom0, rom1);
      const oracleMachine = await createOracleSp128Machine(rom0, rom1);

      expect(wasmMachine.getCurrentPartitions()).toEqual([-1, -1, 5, 5, 2, 2, 0, 0]);
      expectSamePartitions(wasmMachine, oracleMachine);
      expectSameMemoryReads(wasmMachine, oracleMachine, BOUNDARY_ADDRESSES);
    });

    it("uses 0x7ffd to select RAM bank, shadow screen, and ROM page", async () => {
      const rom0 = testRom([0x10]);
      const rom1 = testRom([0x11]);
      const wasmMachine = await createTestSp128WasmMachine(rom0, rom1);
      const oracleMachine = await createOracleSp128Machine(rom0, rom1);

      for (const machine of [wasmMachine, oracleMachine]) {
        machine.doWriteMemory(0x4000, 0x55);
        machine.doWriteMemory(0xc020, 0x00);
        machine.doWritePort(0x7ffd, 0x1b);
        machine.doWriteMemory(0xc020, 0x33);
        machine.doWriteMemory(0xc030, 0x77);
      }

      expectSamePartitions(wasmMachine, oracleMachine);
      expect(wasmMachine.getCurrentPartitions()).toEqual([-2, -2, 5, 5, 2, 2, 3, 3]);
      expect(wasmMachine.getTestPagingState()).toMatchObject({
        selectedRamBank: 3,
        selectedRomPage: 1,
        pagingEnabled: true,
        useShadowScreen: true
      });
      expectSameMemoryReads(wasmMachine, oracleMachine, [0x0000, 0x0010, 0x4000, 0xc020]);
      expect(wasmMachine.readScreenMemory(0x0030)).toBe(oracleMachine.readScreenMemory(0x0030));
    });

    it("keeps ROM and RAM banks independently readable through getMemoryPartition", async () => {
      const rom0 = testRom([0x20]);
      const rom1 = testRom([0x21]);
      const wasmMachine = await createTestSp128WasmMachine(rom0, rom1);
      const oracleMachine = await createOracleSp128Machine(rom0, rom1);

      seed128RamBanks(wasmMachine, oracleMachine);

      expect(wasmMachine.getMemoryPartition(-1)[0]).toBe(oracleMachine.getMemoryPartition(-1)[0]);
      expect(wasmMachine.getMemoryPartition(-2)[0]).toBe(oracleMachine.getMemoryPartition(-2)[0]);
      for (let bank = 0; bank < 8; bank++) {
        expect(wasmMachine.getMemoryPartition(bank)[0x0123], `bank ${bank}`).toBe(
          oracleMachine.getMemoryPartition(bank)[0x0123]
        );
      }
    });

    it("writes through the selected top bank only", async () => {
      const wasmMachine = await createTestSp128WasmMachine(testRom([]), testRom([]));
      const oracleMachine = await createOracleSp128Machine(testRom([]), testRom([]));

      for (const machine of [wasmMachine, oracleMachine]) {
        machine.doWritePort(0x7ffd, 0x03);
        machine.doWriteMemory(0xc000, 0x63);
        machine.doWritePort(0x7ffd, 0x04);
        machine.doWriteMemory(0xc000, 0x64);
      }

      expect(wasmMachine.getMemoryPartition(3)[0]).toBe(oracleMachine.getMemoryPartition(3)[0]);
      expect(wasmMachine.getMemoryPartition(4)[0]).toBe(oracleMachine.getMemoryPartition(4)[0]);
      expect(wasmMachine.getMemoryPartition(3)[0]).toBe(0x63);
      expect(wasmMachine.getMemoryPartition(4)[0]).toBe(0x64);
    });

    it("locks paging through bit 5 and ignores later 0x7ffd page changes", async () => {
      const wasmMachine = await createTestSp128WasmMachine(testRom([0x30]), testRom([0x31]));
      const oracleMachine = await createOracleSp128Machine(testRom([0x30]), testRom([0x31]));

      for (const machine of [wasmMachine, oracleMachine]) {
        machine.doWritePort(0x7ffd, 0x20);
        machine.doWritePort(0x7ffd, 0x1f);
      }

      expectSamePartitions(wasmMachine, oracleMachine);
      expect(wasmMachine.getTestPagingState()).toMatchObject({
        selectedRamBank: 0,
        selectedRomPage: 0,
        pagingEnabled: false,
        useShadowScreen: false
      });
      expectSameMemoryReads(wasmMachine, oracleMachine, [0x0000, 0xc000]);
    });
  });

  describe("ZX Spectrum +2E/+3E special paging", () => {
    for (const diskSupport of [0, 1, 2] as const) {
      it(`starts with TypeScript reset partitions with ${diskSupport} disk drive(s)`, async () => {
        const roms = p3eRoms();
        const wasmMachine = await createTestSpp3eWasmMachine(roms, { diskSupport });
        const oracleMachine = await createOracleSpp3eMachine(roms, { diskSupport });

        expectSamePartitions(wasmMachine, oracleMachine);
        expect(wasmMachine.getCurrentPartitions()).toEqual([-1, -1, 5, 5, 2, 2, 0, 0]);
        expect(wasmMachine.getTestPagingState()).toMatchObject({
          selectedRamBank: 0,
          selectedRomPage: 0,
          pagingEnabled: true,
          useShadowScreen: false,
          inSpecialPagingMode: false,
          specialConfigMode: 0
        });
      });

      it(`exposes CPU-written normal memory through public APIs with ${diskSupport} disk drive(s)`, async () => {
        const roms = [
          testRom([
            0x3e, 0x5a,             // LD A,5a
            0x32, 0x00, 0x40,       // LD (4000),A
            0x3e, 0x6b,             // LD A,6b
            0x32, 0x10, 0xc0        // LD (c010),A
          ]),
          testRom([]),
          testRom([]),
          testRom([])
        ];
        const wasmMachine = await createTestSpp3eWasmMachine(roms, { diskSupport });
        const oracleMachine = await createOracleSpp3eMachine(roms, { diskSupport });

        for (let i = 0; i < 4; i++) {
          wasmMachine.executeOne();
          oracleMachine.executeOne();
        }

        expectP3ePublicMemoryApiParity(wasmMachine, oracleMachine, [
          { address: 0x4000, partition: 5, offset: 0x0000 },
          { address: 0xc010, partition: 0, offset: 0x0010 }
        ]);
      });

      it(`matches TypeScript 0x7ffd normal paging with ${diskSupport} disk drive(s)`, async () => {
        const roms = p3eRoms();
        const wasmMachine = await createTestSpp3eWasmMachine(roms, { diskSupport });
        const oracleMachine = await createOracleSpp3eMachine(roms, { diskSupport });

        for (const machine of [wasmMachine, oracleMachine]) {
          if (machine === wasmMachine) {
            machine.writeTestMemory(0x4000, 0x55);
            machine.writeTestPort(0x7ffd, 0x1b);
            machine.writeTestMemory(0xc020, 0x33);
            machine.writeTestMemory(0xc030, 0x77);
          } else {
            machine.doWriteMemory(0x4000, 0x55);
            machine.doWritePort(0x7ffd, 0x1b);
            machine.doWriteMemory(0xc020, 0x33);
            machine.doWriteMemory(0xc030, 0x77);
          }
        }

        expect(p3eWasmPartitions(wasmMachine)).toEqual(oracleMachine.getCurrentPartitions());
        expect(p3eWasmPartitions(wasmMachine)).toEqual([-2, -2, 5, 5, 2, 2, 3, 3]);
        expect(wasmMachine.getTestPagingState()).toMatchObject({
          selectedRamBank: 3,
          selectedRomPage: 1,
          pagingEnabled: true,
          useShadowScreen: true,
          inSpecialPagingMode: false
        });
        expectP3eMemoryReads(wasmMachine, oracleMachine, [0x0000, 0x0010, 0x4000, 0xc020]);
        expect(wasmMachine.readScreenMemory(0x0030)).toBe(oracleMachine.readScreenMemory(0x0030));
      });

      it(`maps all four special paging modes with ${diskSupport} disk drive(s)`, async () => {
        const roms = p3eRoms();
        const wasmMachine = await createTestSpp3eWasmMachine(roms, { diskSupport });
        const oracleMachine = await createOracleSpp3eMachine(roms, { diskSupport });
        const layouts = [
          { portValue: 0x01, mode: 0, selectedRom: 0, partitions: [0, 0, 1, 1, 2, 2, 3, 3] },
          { portValue: 0x03, mode: 1, selectedRom: 0, partitions: [4, 4, 5, 5, 6, 6, 7, 7] },
          { portValue: 0x05, mode: 2, selectedRom: 2, partitions: [4, 4, 5, 5, 6, 6, 3, 3] },
          { portValue: 0x0f, mode: 3, selectedRom: 2, partitions: [4, 4, 7, 7, 6, 6, 3, 3] }
        ];

        seedP3eRamBanks(wasmMachine, oracleMachine);

        for (const layout of layouts) {
          wasmMachine.writeTestPort(0x1ffd, layout.portValue);
          oracleMachine.doWritePort(0x1ffd, layout.portValue);

          expect(p3eWasmPartitions(wasmMachine)).toEqual(layout.partitions);
          expect(wasmMachine.getTestPagingState()).toMatchObject({
            selectedRomPage: layout.selectedRom,
            inSpecialPagingMode: true,
            specialConfigMode: layout.mode
          });
          expect(p3eWasmMemoryReads(wasmMachine, [0x0001, 0x4001, 0x8001, 0xc001])).toEqual(
            layout.partitions.filter((_, index) => index % 2 === 0).map(bank => 0x80 + bank)
          );
        }
      });

      it(`exposes special-paged WASM memory through public APIs with ${diskSupport} disk drive(s)`, async () => {
        const roms = p3eRoms();
        const wasmMachine = await createTestSpp3eWasmMachine(roms, { diskSupport });
        const oracleMachine = await createOracleSpp3eMachine(roms, { diskSupport });

        wasmMachine.writeTestPort(0x1ffd, 0x0f);
        oracleMachine.doWritePort(0x1ffd, 0x0f);

        const writes = [
          { address: 0x0023, value: 0x94, partition: 4, offset: 0x0023 },
          { address: 0x4020, value: 0x97, partition: 7, offset: 0x0020 },
          { address: 0x8021, value: 0x96, partition: 6, offset: 0x0021 },
          { address: 0xc022, value: 0x93, partition: 3, offset: 0x0022 }
        ];

        for (const write of writes) {
          wasmMachine.writeTestMemory(write.address, write.value);
          oracleMachine.doWriteMemory(write.address, write.value);
        }

        expectP3ePublicMemoryApiParity(wasmMachine, oracleMachine, writes);
      });

      it(`keeps special paging writable after the 0x7ffd paging lock with ${diskSupport} disk drive(s)`, async () => {
        const roms = p3eRoms();
        const wasmMachine = await createTestSpp3eWasmMachine(roms, { diskSupport });
        const oracleMachine = await createOracleSpp3eMachine(roms, { diskSupport });

        wasmMachine.writeTestPort(0x7ffd, 0x20);
        wasmMachine.writeTestPort(0x7ffd, 0x1f);
        wasmMachine.writeTestPort(0x1ffd, 0x0f);
        oracleMachine.doWritePort(0x7ffd, 0x20);
        oracleMachine.doWritePort(0x7ffd, 0x1f);
        oracleMachine.doWritePort(0x1ffd, 0x0f);

        expect(p3eWasmPartitions(wasmMachine)).toEqual([4, 4, 7, 7, 6, 6, 3, 3]);
        expect(wasmMachine.getTestPagingState()).toMatchObject({
          selectedRamBank: 0,
          selectedRomPage: 2,
          pagingEnabled: false,
          inSpecialPagingMode: true,
          specialConfigMode: 3,
          diskMotorOn: true
        });
      });
    }
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

function p3eRoms(): Uint8Array[] {
  return [testRom([0x70]), testRom([0x71]), testRom([0x72]), testRom([0x73])];
}

function seed128RamBanks(
  wasmMachine: Awaited<ReturnType<typeof createTestSp128WasmMachine>>,
  oracleMachine: Awaited<ReturnType<typeof createOracleSp128Machine>>
): void {
  for (let bank = 0; bank < 8; bank++) {
    const value = 0x40 + bank;
    for (const machine of [wasmMachine, oracleMachine]) {
      machine.doWritePort(0x7ffd, bank);
      machine.doWriteMemory(0xc123, value);
    }
  }
  for (const machine of [wasmMachine, oracleMachine]) {
    machine.doWritePort(0x7ffd, 0x00);
  }
}

function seedP3eRamBanks(
  wasmMachine: Awaited<ReturnType<typeof createTestSpp3eWasmMachine>>,
  oracleMachine: Awaited<ReturnType<typeof createOracleSpp3eMachine>>
): void {
  for (let bank = 0; bank < 8; bank++) {
    const value = 0x80 + bank;
    wasmMachine.writeTestPort(0x7ffd, bank);
    wasmMachine.writeTestMemory(0xc001, value);
    oracleMachine.doWritePort(0x7ffd, bank);
    oracleMachine.doWriteMemory(0xc001, value);
  }
  wasmMachine.writeTestPort(0x7ffd, 0x00);
  oracleMachine.doWritePort(0x7ffd, 0x00);
}

function p3eWasmPartitions(machine: Awaited<ReturnType<typeof createTestSpp3eWasmMachine>>): number[] {
  const wasm = machine.wasmV2Runtime!.exports;
  const slot0 = wasm.spp3eGetCurrentPartition(0);
  const slot1 = wasm.spp3eGetCurrentPartition(1);
  const slot2 = wasm.spp3eGetCurrentPartition(2);
  const slot3 = wasm.spp3eGetCurrentPartition(3);
  return [slot0, slot0, slot1, slot1, slot2, slot2, slot3, slot3];
}

function expectP3eMemoryReads(
  wasmMachine: Awaited<ReturnType<typeof createTestSpp3eWasmMachine>>,
  oracleMachine: Awaited<ReturnType<typeof createOracleSpp3eMachine>>,
  addresses: number[]
): void {
  for (const address of addresses) {
    expect(wasmMachine.readTestMemory(address), `memory ${address.toString(16)}`).toBe(
      oracleMachine.readTestMemory(address)
    );
  }
}

function p3eWasmMemoryReads(
  machine: Awaited<ReturnType<typeof createTestSpp3eWasmMachine>>,
  addresses: number[]
): number[] {
  return addresses.map(address => machine.readTestMemory(address));
}

function expectP3ePublicMemoryApiParity(
  wasmMachine: Awaited<ReturnType<typeof createTestSpp3eWasmMachine>>,
  oracleMachine: Awaited<ReturnType<typeof createOracleSpp3eMachine>>,
  expectedMappings: Array<{ address: number; partition: number; offset: number }>
): void {
  expect(wasmMachine.getCurrentPartitions()).toEqual(oracleMachine.getCurrentPartitions());
  expect(wasmMachine.getSelectedRamBank()).toBe(oracleMachine.getSelectedRamBank());
  expect(wasmMachine.getSelectedRomPage()).toBe(oracleMachine.getSelectedRomPage());

  for (const { address, partition, offset } of expectedMappings) {
    const label = `public memory ${address.toString(16)}`;
    expect(wasmMachine.getPartition(address), `${label} partition`).toBe(
      oracleMachine.getPartition(address)
    );
    expect(wasmMachine.getPartition(address), `${label} expected partition`).toBe(partition);
    expect(wasmMachine.get64KFlatMemory()[address], `${label} flat`).toBe(
      oracleMachine.get64KFlatMemory()[address]
    );
    expect(wasmMachine.doReadMemory(address), `${label} read`).toBe(
      oracleMachine.doReadMemory(address)
    );
    expect(wasmMachine.getMemoryPartition(partition)[offset], `${label} partition byte`).toBe(
      oracleMachine.getMemoryPartition(partition)[offset]
    );
  }
}
