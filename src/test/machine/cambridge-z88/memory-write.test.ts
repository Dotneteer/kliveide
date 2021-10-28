import "mocha";
import * as expect from "expect";
import { CambridgeZ88Core } from "@modules/vm-z88/CambridgeZ88Core";
import {
  DefaultCambridgeZ88StateManager,
  loadWaModule,
  SilentAudioRenderer,
} from "../helpers";
import { setEngineDependencies } from "@modules-core/vm-engine-dependencies";

let machine: CambridgeZ88Core;

// --- Set up the virual machine engine service with the
setEngineDependencies({
  waModuleLoader: (n) => loadWaModule(n),
  sampleRateGetter: () => 48000,
  audioRendererFactory: () => new SilentAudioRenderer(),
  cz88StateManager: new DefaultCambridgeZ88StateManager(),
});

describe("Cambridge Z88 - Memory write", function () {
  before(async () => {
    machine = new CambridgeZ88Core({
      baseClockFrequency: 3_276_800,
      tactsInFrame: 16384,
      firmware: [new Uint8Array(32768)],
    });
    await machine.setupMachine();
  });

  beforeEach(async () => {
    await machine.setupMachine();
  });

  const addresses: number[] = [
    0x0000, 0x1234, 0x1fff, 0x2000, 0x2345, 0x2fff, 0x3000, 0x3456, 0x3fff,
    0x4000, 0x5678, 0x5fff, 0x6000, 0x6789, 0x7fff, 0x8000, 0x89ab, 0x9fff,
    0xa000, 0xbcde, 0xbfff, 0xc000, 0xcdef, 0xdfff, 0xe000, 0xef01, 0xffff,
  ];

  addresses.forEach((addr) => {
    it(`ROM (${addr}) cannot be written`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      expect(value).toBe(0);
    });
  });

  addresses.forEach((addr) => {
    it(`RAMS turned on (${addr})`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.writePortCz88(0xb0, 0x04); // Set COM.RAMS
      machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      if (addr <= 0x1fff) {
        expect(value).toBe(0x23);
      } else {
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`Internal RAM (${addr}) can be written`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

      machine.api.writePortCz88(0xd1, 0x20);
      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) === 0x4000) {
        // RAM area
        expect(value).toBe(0x23);
      } else {
        // ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`Card 1 RAM (${addr}) can be written`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

      machine.api.writePortCz88(0xd1, 0x40);
      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) === 0x4000) {
        // RAM area
        expect(value).toBe(0x23);
      } else {
        // ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`Card 2 RAM (${addr}) can be written`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

      machine.api.writePortCz88(0xd2, 0x80);
      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) === 0x8000) {
        // RAM area
        expect(value).toBe(0x23);
      } else {
        // ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`Card 3 RAM (${addr}) can be written`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

      machine.api.writePortCz88(0xd3, 0xc0);
      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) === 0xc000) {
        // RAM area
        expect(value).toBe(0x23);
      } else {
        // ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`Card 3 RAM in segment 2 (${addr}) can be written`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

      machine.api.writePortCz88(0xd3, 0x80);
      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) === 0xc000) {
        // RAM area
        expect(value).toBe(0x23);
      } else {
        // ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`Card 3 EPROM (${addr}) cannot be written`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.setZ88SlotMask(3, true); // Chip 4 is ROM

      machine.api.writePortCz88(0xd3, 0xc0);
      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      expect(value).toBe(0);
    });
  });

  addresses.forEach((addr) => {
    it(`Multiple paged-in RAM (${addr}) can be written`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
      machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

      machine.api.writePortCz88(0xd2, 0x80);
      machine.api.writePortCz88(0xd3, 0xc0);
      machine.api.testWriteCz88Memory(addr, 0x23);
      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) >= 0x8000) {
        // RAM area
        expect(value).toBe(0x23);
      } else {
        // ROM area
        expect(value).toBe(0);
      }
    });
  });

  const repeatingAddresses: number[] = [0x4000, 0x4567, 0x5f00];
  const sizeMasks: number[] = [0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f];

  sizeMasks.forEach((size) => {
    repeatingAddresses.forEach((addr) => {
      it(`Write/read repeats in internal RAM ${size}/(${addr})`, () => {
        machine.reset();
        machine.api.setZ88RndSeed(0);
        machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
        machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
        machine.api.setZ88ChipMask(2, size); // Passed size
        machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
        machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M
        machine.api.setZ88SlotMask(3, false); // Chip 4 is RAM

        // Even pages
        for (let i = 0x40; i < 0x80; i += size + 1) {
          machine.api.writePortCz88(0xd1, i);
          machine.api.testWriteCz88Memory(addr, 0x23);
          const value = machine.api.testReadCz88Memory(addr);
          expect(value).toBe(0x23);
          for (let j = 0x40 + (size + 1); j < 0x80; j += size + 1) {
            machine.api.writePortCz88(0xd1, j);
            const value = machine.api.testReadCz88Memory(addr);
            expect(value).toBe(0x23);
            for (let k = j + 2; k < j + size + 1; k += 2) {
              machine.api.writePortCz88(0xd1, k);
              const value = machine.api.testReadCz88Memory(addr);
              expect(value).toBe(0x00);
            }
          }
        }

        // Odd pages
        for (let i = 0x41; i < 0x80; i += size + 1) {
          machine.api.writePortCz88(0xd1, i);
          machine.api.testWriteCz88Memory(addr, 0x23);
          const value = machine.api.testReadCz88Memory(addr);
          expect(value).toBe(0x23);
          for (let j = 0x41 + (size + 1); j < 0x80; j += size + 1) {
            machine.api.writePortCz88(0xd1, j);
            const value = machine.api.testReadCz88Memory(addr);
            expect(value).toBe(0x23);
            for (let k = j + 2; k < j + size + 1; k += 2) {
              machine.api.writePortCz88(0xd1, k);
              const value = machine.api.testReadCz88Memory(addr);
              expect(value).toBe(0x00);
            }
          }
        }
      });
    });
  });
});
