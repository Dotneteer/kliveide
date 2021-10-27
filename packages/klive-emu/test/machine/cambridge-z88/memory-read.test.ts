import "mocha";
import * as expect from "expect";
import { CambridgeZ88Core } from "../../../src/extensions/vm-z88/CambridgeZ88Core";
import {
  DefaultCambridgeZ88StateManager,
  loadWaModule,
  SilentAudioRenderer,
} from "../helpers";
import { setEngineDependencies } from "../../../src/extensions/core/vm-engine-dependencies";

let machine: CambridgeZ88Core;

// --- Set up the virual machine engine service with the
setEngineDependencies({
  waModuleLoader: (n) => loadWaModule(n),
  sampleRateGetter: () => 48000,
  audioRendererFactory: () => new SilentAudioRenderer(),
  cz88StateManager: new DefaultCambridgeZ88StateManager(),
});

/**
 * Random sequences used for testing
 */
const RANDOM_SEQ = [0xe2, 0xc5, 0x62];

describe("Cambridge Z88 - Memory read", function () {
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
    it(`ROM read (${addr}) after init`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M

      const value = machine.api.testReadCz88Memory(addr);
      expect(value).toBe(0);
    });
  });

  addresses.forEach((addr) => {
    it(`RAM read (${addr}) empty card 1`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x00); // Slot 2 RAM empty
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M

      machine.api.writePortCz88(0xd1, 0x40);

      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) === 0x4000) {
        // Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // Normal read
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`RAM read (${addr}) empty card 2`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x00); // Slot 3 RAM empty
      machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M

      machine.api.writePortCz88(0xd2, 0x80);

      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) === 0x8000) {
        // Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // Normal read
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`RAM read (${addr}) empty card 3`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
      machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
      machine.api.setZ88ChipMask(4, 0x00); // Slot 4 RAM empty

      machine.api.writePortCz88(0xd3, 0xc0);

      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) === 0xc000) {
        // Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // Normal read
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`RAM read (${addr}) all card empty`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x00); // Slot 2 RAM empty
      machine.api.setZ88ChipMask(3, 0x00); // Slot 3 RAM empty
      machine.api.setZ88ChipMask(4, 0x00); // Slot 4 RAM empty

      machine.api.writePortCz88(0xd1, 0x40);
      machine.api.writePortCz88(0xd2, 0x80);
      machine.api.writePortCz88(0xd3, 0xc0);

      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) !== 0x0000) {
        // Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // Normal read
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach((addr) => {
    it(`Multiple RAM read (${addr}) all card empty`, () => {
      machine.reset();
      machine.api.setZ88RndSeed(0);
      machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
      machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
      machine.api.setZ88ChipMask(2, 0x00); // Slot 2 RAM empty
      machine.api.setZ88ChipMask(3, 0x00); // Slot 3 RAM empty
      machine.api.setZ88ChipMask(4, 0x00); // Slot 4 RAM empty

      machine.api.writePortCz88(0xd1, 0x40);
      machine.api.writePortCz88(0xd2, 0x80);
      machine.api.writePortCz88(0xd3, 0xc0);

      const value = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) !== 0x0000) {
        // Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // Normal read
        expect(value).toBe(0);
      }

      const value1 = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) !== 0x0000) {
        // Random read (pseudo random)
        expect(value1).toBe(RANDOM_SEQ[1]);
      } else {
        // Normal read
        expect(value1).toBe(0);
      }

      const value2 = machine.api.testReadCz88Memory(addr);
      if ((addr & 0xc000) !== 0x0000) {
        // Random read (pseudo random)
        expect(value2).toBe(RANDOM_SEQ[2]);
      } else {
        // Normal read
        expect(value2).toBe(0);
      }
    });
  });
});
