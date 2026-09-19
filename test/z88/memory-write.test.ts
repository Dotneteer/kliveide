import { describe, it, expect } from "vitest";
import { Z88_BACKENDS } from "./z88-backends";
import { COMFlags } from "@emu/machines/z88/IZ88BlinkDevice";

describe.each(Z88_BACKENDS)("Z88 - Memory write ($name)", function ({ create }) {
  const addresses: number[] = [
    0x0000, 0x1234, 0x1fff, 0x2000, 0x2345, 0x2fff, 0x3000, 0x3456, 0x3fff,
    0x4000, 0x5678, 0x5fff, 0x6000, 0x6789, 0x7fff, 0x8000, 0x89ab, 0x9fff,
    0xa000, 0xbcde, 0xbfff, 0xc000, 0xcdef, 0xdfff, 0xe000, 0xef01, 0xffff
  ];

  addresses.forEach(addr => {
    it(`ROM (${addr}) cannot be written`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.ram(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Write to ROM
      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
      expect(value).toBe(0);
    });
  });

  addresses.forEach(addr => {
    it(`RAMS turned on (${addr})`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.ram(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Set RAMS
      m.blink.setCOM(COMFlags.RAMS);

      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
      if (addr <= 0x1fff) {
        // --- RAM area
        expect(value).toBe(0x23);
      } else {
        // --- ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`Internal RAM (${addr}) can be written`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.ram(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0x20 into slot 1
      m.blink.setSR1(0x20);

      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) === 0x4000) {
        // --- RAM area
        expect(value).toBe(0x23);
      } else {
        // --- ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`Card 1 RAM (${addr}) can be written`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.ram(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0x40 into slot 1
      m.blink.setSR1(0x40);

      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) === 0x4000) {
        // --- RAM area
        expect(value).toBe(0x23);
      } else {
        // --- ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`Card 2 RAM (${addr}) can be written`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.ram(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0x80 into slot 2
      m.blink.setSR2(0x80);

      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) === 0x8000) {
        // RAM area
        expect(value).toBe(0x23);
      } else {
        // ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`Card 3 RAM (${addr}) can be written`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.ram(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0xc0 into slot 3
      m.blink.setSR3(0xc0);

      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) === 0xc000) {
        // --- RAM area
        expect(value).toBe(0x23);
      } else {
        // --- ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`Card 2 RAM in slot 3 (${addr}) can be written`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.ram(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0x80 into slot 3
      m.blink.setSR3(0x80);

      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
      if ((addr & 0xc000) === 0xc000) {
        // RAM area
        expect(value).toBe(0x23);
      } else {
        // ROM area
        expect(value).toBe(0);
      }
    });
  });

  addresses.forEach(addr => {
    it(`Card 3 ROM/EPROM (${addr}) cannot be written`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.rom(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0xc0 into slot 3
      m.blink.setSR3(0xc0);

      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
      expect(value).toBe(0);
    });
  });

  addresses.forEach(addr => {
    it(`Multiple paged-in RAM (${addr}) can be written`, () => {
      // --- Create the machine
      const m = create();

      // --- Create cards
      const card0 = m.cards.rom(0x08_0000);
      const ramCard = m.cards.ram(0x08_0000);
      const card1 = m.cards.ram(0x10_0000);
      const card2 = m.cards.ram(0x10_0000);
      const card3 = m.cards.ram(0x10_0000);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      // --- Page in Bank 0x80 into slot 2
      m.blink.setSR2(0x80);

      // --- Page in Bank 0xc0 into slot 3
      m.blink.setSR3(0x80);

      m.memory.writeMemory(addr, 0x23);
      const value = m.memory.readMemory(addr);
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

  sizeMasks.forEach(size => {
    repeatingAddresses.forEach(addr => {
      it(`Write/read repeats in internal RAM ${size}/(${addr})`, () => {
        // --- Create the machine
        const m = create();

        let cardSize = 0x10_0000; // --- 1M
        switch (size) {
          case 0x01: // --- 32K
            cardSize = 0x00_8000;
            break;
          case 0x03: // --- 64K
            cardSize = 0x01_0000;
            break;
          case 0x07: // --- 128K
            cardSize = 0x02_0000;
            break;
          case 0x0f: // --- 256K
            cardSize = 0x04_0000;
            break;
          case 0x1f: // --- 512K
            cardSize = 0x08_0000;
            break;
        }

        // --- Create cards
        const card0 = m.cards.rom(0x08_0000);
        const ramCard = m.cards.ram(0x08_0000);
        const card1 = m.cards.ram(cardSize);
        const card2 = m.cards.ram(0x10_0000);
        const card3 = m.cards.ram(0x10_0000);

        // --- Insert cards
        const mem = m.memory;
        mem.insertCard(0, card0);
        mem.setRamCard(ramCard);
        mem.insertCard(1, card1);
        mem.insertCard(2, card2);
        mem.insertCard(3, card3);

        // --- Even banks
        for (let i = 0x40; i < 0x80; i += size + 1) {
          m.setSR1(i);
          m.memory.writeMemory(addr, 0x23);
          const value = m.memory.readMemory(addr);
          expect(value).toBe(0x23);
          for (let j = 0x40 + (size + 1); j < 0x80; j += size + 1) {
            m.setSR1(j);
            const value = m.memory.readMemory(addr);
            expect(value).toBe(0x23);
            for (let k = j + 2; k < j + size + 1; k += 2) {
              m.setSR1(k);
              const value = m.memory.readMemory(addr);
              expect(value).toBe(0x00);
            }
          }
        }

        // --- Odd banks
        for (let i = 0x41; i < 0x80; i += size + 1) {
          m.setSR1(i);
          m.memory.writeMemory(addr, 0x23);
          const value = m.memory.readMemory(addr);
          expect(value).toBe(0x23);
          for (let j = 0x41 + (size + 1); j < 0x80; j += size + 1) {
            m.setSR1(j);
            const value = m.memory.readMemory(addr);
            expect(value).toBe(0x23);
            for (let k = j + 2; k < j + size + 1; k += 2) {
              m.setSR1(k);
              const value = m.memory.readMemory(addr);
              expect(value).toBe(0x00);
            }
          }
        }
      });
    });
  });
});
