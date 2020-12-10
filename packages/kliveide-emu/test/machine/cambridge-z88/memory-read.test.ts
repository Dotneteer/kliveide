import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { MachineApi } from "../../../src/renderer/machines/wa-api";
import { importObject } from "../../import-object";
import { CambridgeZ88 } from "../../../src/renderer/machines/CambridgeZ88";

const buffer = fs.readFileSync(
  path.join(__dirname, "../../../build/cz88.wasm")
);
let api: MachineApi;
let machine: CambridgeZ88;

/**
 * Random sequences used for testing
 */
const RANDOM_SEQ = [0xe2, 0xc5, 0x62];

describe("Cambridge Z88 - Memory read", function () {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as MachineApi;
    machine = new CambridgeZ88(api);
  });

  beforeEach(() => {
    machine.reset();
  });

  const addresses: number[] = [
    0x0000,
    0x1234,
    0x1fff,
    0x2000,
    0x2345,
    0x2fff,
    0x3000,
    0x3456,
    0x3fff,
    0x4000,
    0x5678,
    0x5fff,
    0x6000,
    0x6789,
    0x7fff,
    0x8000,
    0x89ab,
    0x9fff,
    0xa000,
    0xbcde,
    0xbfff,
    0xc000,
    0xcdef,
    0xdfff,
    0xe000,
    0xef01,
    0xffff,
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
