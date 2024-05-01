import { describe, it, expect } from "vitest";
import { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";
import { Z88RomMemoryCard } from "@emu/machines/z88/memory/Z88RomMemoryCard";
import { Z88TestMachine } from "./Z88TestMachine";
import { Z88RamMemoryCard } from "@emu/machines/z88/memory/Z88RamMemoryCard";

/**
 * Random sequences used for testing
 */
const RANDOM_SEQ = [0xe2, 0xc5, 0x62];

describe("Z88 - Memory read", function () {
  const addresses: number[] = [
    0x0000, 0x1234, 0x1fff, 0x2000, 0x2345, 0x2fff, 0x3000, 0x3456, 0x3fff,
    0x4000, 0x5678, 0x5fff, 0x6000, 0x6789, 0x7fff, 0x8000, 0x89ab, 0x9fff,
    0xa000, 0xbcde, 0xbfff, 0xc000, 0xcdef, 0xdfff, 0xe000, 0xef01, 0xffff
  ];

  addresses.forEach(addr => {
    it(`ROM read (${addr}) after init`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();

      // --- Create cards
      const card0 = new Z88RomMemoryCard(m, 0x08_0000);
      const ramCard = new Z88RamMemoryCard(m, 0x08_0000);
      const card1 = new Z88RamMemoryCard(m, 0x10_0000);
      const card2 = new Z88RamMemoryCard(m, 0x10_0000);
      const card3 = new Z88RamMemoryCard(m, 0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;
      mem.insertCard(0, card0);
      memt.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      const value = m.memory.readMemory(addr);
      expect(value).toBe(0);
    });
  });

  addresses.forEach(addr => {
    it(`RAM read (${addr}) empty card 1`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();

      // --- Create cards
      const card0 = new Z88RomMemoryCard(m, 0x08_0000);
      const ramCard = new Z88RamMemoryCard(m, 0x08_0000);
      const card2 = new Z88RamMemoryCard(m, 0x10_0000);
      const card3 = new Z88RamMemoryCard(m, 0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;
      mem.insertCard(0, card0);
      memt.setRamCard(ramCard);
      mem.removeCard(1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0x40 into slot 1
      m.blinkDevice.setSR1(0x40);

      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) === 0x4000) {
        // --- Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // --- Normal read
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`RAM read (${addr}) empty card 2`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();

      // --- Create cards
      const card0 = new Z88RomMemoryCard(m, 0x08_0000);
      const ramCard = new Z88RamMemoryCard(m, 0x08_0000);
      const card1 = new Z88RamMemoryCard(m, 0x10_0000);
      const card3 = new Z88RamMemoryCard(m, 0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;
      mem.insertCard(0, card0);
      memt.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.removeCard(2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0x80 into slot 2
      m.blinkDevice.setSR2(0x80);

      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) === 0x8000) {
        // --- Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // --- Normal read
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`RAM read (${addr}) empty card 3`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();

      // --- Create cards
      const card0 = new Z88RomMemoryCard(m, 0x08_0000);
      const ramCard = new Z88RamMemoryCard(m, 0x08_0000);
      const card1 = new Z88RamMemoryCard(m, 0x10_0000);
      const card2 = new Z88RamMemoryCard(m, 0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;
      mem.insertCard(0, card0);
      memt.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.removeCard(3);

      // --- Page in Bank 0xc0 into slot 3
      m.blinkDevice.setSR3(0xc0);

      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) === 0xc000) {
        // --- Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // --- Normal read
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`RAM read (${addr}) all card empty`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();

      // --- Create cards
      const card0 = new Z88RomMemoryCard(m, 0x08_0000);
      const ramCard = new Z88RamMemoryCard(m, 0x08_0000);

      // --- Insert cards
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;
      mem.insertCard(0, card0);
      memt.setRamCard(ramCard);
      mem.removeCard(1);
      mem.removeCard(2);
      mem.removeCard(3);

      // --- Page in Bank 0x40 into slot 1
      m.blinkDevice.setSR1(0x40);

      // --- Page in Bank 0x80 into slot 2
      m.blinkDevice.setSR2(0x80);

      // --- Page in Bank 0xc0 into slot 3
      m.blinkDevice.setSR3(0xc0);

      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) !== 0x0000) {
        // --- Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // --- Normal read
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`Multiple RAM read (${addr}) all card empty`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();

      // --- Create cards
      const card0 = new Z88RomMemoryCard(m, 0x08_0000);
      const ramCard = new Z88RamMemoryCard(m, 0x08_0000);

      // --- Insert cards
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;
      mem.insertCard(0, card0);
      memt.setRamCard(ramCard);
      mem.removeCard(1);
      mem.removeCard(2);
      mem.removeCard(3);

      // --- Page in Bank 0x40 into slot 1
      m.blinkDevice.setSR1(0x40);

      // --- Page in Bank 0x80 into slot 2
      m.blinkDevice.setSR2(0x80);

      // --- Page in Bank 0xc0 into slot 3
      m.blinkDevice.setSR3(0xc0);

      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) !== 0x0000) {
        // --- Random read (pseudo random)
        expect(value).toBe(RANDOM_SEQ[0]);
      } else {
        // --- Normal read
        expect(value).toBe(0);
      }

      const value1 = m.memory.readMemory(addr);
      if ((addr & 0xc000) !== 0x0000) {
        // --- Random read (pseudo random)
        expect(value1).toBe(RANDOM_SEQ[1]);
      } else {
        // --- Normal read
        expect(value1).toBe(0);
      }

      const value2 = m.memory.readMemory(addr);
      if ((addr & 0xc000) !== 0x0000) {
        // --- Random read (pseudo random)
        expect(value2).toBe(RANDOM_SEQ[2]);
      } else {
        // --- Normal read
        expect(value2).toBe(0);
      }
    });
  });
});
