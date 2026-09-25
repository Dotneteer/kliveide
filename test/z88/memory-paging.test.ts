import { describe, it, expect } from "vitest";
import { createZ88TestSurface } from "./z88-test-surface";
import { COMFlags } from "./z88-blink-flags";
import { CardType } from "@emu/machines/z88/z88CardCatalog";

describe("Z88 - Banked Memory", function () {
  it("constructor works", () => {
    // --- The expectations of the original test of the TypeScript banked memory (card objects and
    // --- bank data), asked through the test surface
    const m = createZ88TestSurface();
    expect(m.memory).toBeDefined();

    expect(m.slotCardType(0)).toBe(CardType.Rom);
    expect(m.slotCardType(1)).toBe(CardType.None);
    expect(m.slotCardType(2)).toBe(CardType.None);
    expect(m.slotCardType(3)).toBe(CardType.None);

    const expectedOffsets = [0, 0, 0, 0x2000, 0, 0x2000, 0, 0x2000];
    for (let page = 0; page < 8; page++) {
      expect(m.pageBank(page)).toBe(0);
      expect(m.pageOffset(page)).toBe(expectedOffsets[page]);
      expect(m.pageCardType(page)).toBe(CardType.Rom);
    }
  });

  // --- We use these test patterns to test the memory configuration
  const memConfigPatterns = [
    // (128K, 512K, 1M, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (256K, 512K, 1M, 1M, 1M: RAM)
    {
      c0: 0x04_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (512K, 512K, 1M, 1M, 1M: RAM)
    {
      c0: 0x08_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 32K, 1M, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x00_8000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 64K, 1M, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x01_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 128K, 1M, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x02_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 256K, 1M, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x04_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (512K, 32K, 1M, 1M, 1M: RAM)
    {
      c0: 0x08_0000,
      c1: 0x00_8000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (512K, 64K, 1M, 1M, 1M: RAM)
    {
      c0: 0x08_0000,
      c1: 0x01_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (512K, 128K, 1M, 1M, 1M: RAM)
    {
      c0: 0x08_0000,
      c1: 0x02_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (512K, 256K, 1M, 1M, 1M: RAM)
    {
      c0: 0x08_0000,
      c1: 0x04_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 32K, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x00_8000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 64K, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x01_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 128K, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x02_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 256K, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x04_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 512K, 1M, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x08_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 32K, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x00_8000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 64K, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x01_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 128K, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x02_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 256K, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x04_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 512K, 1M: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x08_0000,
      c4: 0x10_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 1M, 32K: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x00_8000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 1M, 64K: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x01_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 1M, 128K: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x02_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 1M, 256K: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x04_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 1M, 512K: RAM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x08_0000,
      c3Rom: false
    },

    // (128K, 512K, 1M, 1M, 32K: ROM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x00_8000,
      c3Rom: true
    },

    // (128K, 512K, 1M, 1M, 64K: ROM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x01_0000,
      c3Rom: true
    },

    // (128K, 512K, 1M, 1M, 128K: ROM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x02_0000,
      c3Rom: true
    },

    // (128K, 512K, 1M, 1M, 256K: ROM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x04_0000,
      c3Rom: true
    },

    // (128K, 512K, 1M, 1M, 512K: ROM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x08_0000,
      c3Rom: true
    },

    // (128K, 512K, 1M, 1M, 1M: ROM)
    {
      c0: 0x02_0000,
      c1: 0x08_0000,
      c2: 0x10_0000,
      c3: 0x10_0000,
      c4: 0x10_0000,
      c3Rom: true
    }
  ];

  memConfigPatterns.forEach(pat => {
    it(`Set SR0 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      // --- Create the machine
      const m = createZ88TestSurface();

      // --- Prepare memory cards
      const card0 = m.cards.rom(pat.c0);
      const ramCard = m.cards.ram(pat.c1);
      const card1 = m.cards.rom(pat.c2);
      const card2 = m.cards.rom(pat.c3);
      const card3 = pat.c3Rom
        ? m.cards.rom(pat.c4)
        : m.cards.ram(pat.c4);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      expect(m.chipMask0).toBe(card0.chipMask);
      expect(m.chipMask1).toBe(card1.chipMask);
      expect(m.chipMask2).toBe(card2.chipMask);
      expect(m.chipMask3).toBe(card3.chipMask);
      expect(m.chipMaskIntRam).toBe(ramCard.chipMask);

      // --- Try 00..1f bank settings for SR0
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & card0.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 20..3f bank settings for SR0
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & ramCard.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(CardType.Ram);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeL).toBe(CardType.Rom);
      }

      // --- Try 40..7f bank settings for SR0
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card1.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 80..bf bank settings for SR0
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card2.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try c0..ff bank settings for SR0
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card3.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR0 with RAMS (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      // --- Create the machine
      const m = createZ88TestSurface();

      // --- Prepare memory cards
      const card0 = m.cards.rom(pat.c0);
      const ramCard = m.cards.ram(pat.c1);
      const card1 = m.cards.rom(pat.c2);
      const card2 = m.cards.rom(pat.c3);
      const card3 = pat.c3Rom
        ? m.cards.rom(pat.c4)
        : m.cards.ram(pat.c4);

      // --- Set RAMS
      m.blink.setCOM(COMFlags.RAMS);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      expect(m.chipMask0).toBe(card0.chipMask);
      expect(m.chipMask1).toBe(card1.chipMask);
      expect(m.chipMask2).toBe(card2.chipMask);
      expect(m.chipMask3).toBe(card3.chipMask);
      expect(m.chipMaskIntRam).toBe(ramCard.chipMask);

      // --- Try 00..1f bank settings for SR0
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & card0.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 20..3f bank settings for SR0
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & ramCard.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(CardType.Ram);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeL).toBe(CardType.Rom);
      }

      // --- Try 40..7f bank settings for SR0
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card1.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 80..bf bank settings for SR0
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card2.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try c0..ff bank settings for SR0
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card3.chipMask);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0TypeH).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR1 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      // --- Create the machine
      const m = createZ88TestSurface();

      // --- Prepare memory cards
      const card0 = m.cards.rom(pat.c0);
      const ramCard = m.cards.ram(pat.c1);
      const card1 = m.cards.rom(pat.c2);
      const card2 = m.cards.rom(pat.c3);
      const card3 = pat.c3Rom
        ? m.cards.rom(pat.c4)
        : m.cards.ram(pat.c4);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      expect(m.chipMask0).toBe(card0.chipMask);
      expect(m.chipMask1).toBe(card1.chipMask);
      expect(m.chipMask2).toBe(card2.chipMask);
      expect(m.chipMask3).toBe(card3.chipMask);
      expect(m.chipMaskIntRam).toBe(ramCard.chipMask);

      // --- Try 00..1f bank settings for SR1
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & card0.chipMask);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 20..3f bank settings for SR1
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & ramCard.chipMask);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1TypeL).toBe(CardType.Ram);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1TypeH).toBe(CardType.Ram);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeL).toBe(CardType.Rom);
      }

      // --- Try 40..7f bank settings for SR1
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card1.chipMask);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 80..bf bank settings for SR1
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card2.chipMask);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try c0..ff bank settings for SR1
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card3.chipMask);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1TypeL).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1TypeH).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR2 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      // --- Create the machine
      const m = createZ88TestSurface();

      // --- Prepare memory cards
      const card0 = m.cards.rom(pat.c0);
      const ramCard = m.cards.ram(pat.c1);
      const card1 = m.cards.rom(pat.c2);
      const card2 = m.cards.rom(pat.c3);
      const card3 = pat.c3Rom
        ? m.cards.rom(pat.c4)
        : m.cards.ram(pat.c4);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      expect(m.chipMask0).toBe(card0.chipMask);
      expect(m.chipMask1).toBe(card1.chipMask);
      expect(m.chipMask2).toBe(card2.chipMask);
      expect(m.chipMask3).toBe(card3.chipMask);
      expect(m.chipMaskIntRam).toBe(ramCard.chipMask);

      // --- Try 00..1f bank settings for SR2
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & card0.chipMask);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 20..3f bank settings for SR2
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & ramCard.chipMask);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2TypeL).toBe(CardType.Ram);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2TypeH).toBe(CardType.Ram);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeL).toBe(CardType.Rom);
      }

      // --- Try 40..7f bank settings for SR2
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card1.chipMask);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 80..bf bank settings for SR2
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card2.chipMask);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try c0..ff bank settings for SR2
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card3.chipMask);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2TypeL).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2TypeH).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR3 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      // --- Create the machine
      const m = createZ88TestSurface();

      // --- Prepare memory cards
      const card0 = m.cards.rom(pat.c0);
      const ramCard = m.cards.ram(pat.c1);
      const card1 = m.cards.rom(pat.c2);
      const card2 = m.cards.rom(pat.c3);
      const card3 = pat.c3Rom
        ? m.cards.rom(pat.c4)
        : m.cards.ram(pat.c4);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      expect(m.chipMask0).toBe(card0.chipMask);
      expect(m.chipMask1).toBe(card1.chipMask);
      expect(m.chipMask2).toBe(card2.chipMask);
      expect(m.chipMask3).toBe(card3.chipMask);
      expect(m.chipMaskIntRam).toBe(ramCard.chipMask);

      // --- Try 00..1f bank settings for SR3
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & card0.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 20..3f bank settings for SR3
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & ramCard.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(CardType.Ram);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeL).toBe(CardType.Ram);
      }

      // --- Try 40..7f bank settings for SR3
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card1.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 80..bf bank settings for SR3
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card2.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try c0..ff bank settings for SR3
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card3.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0TypeL).toBe(CardType.Rom);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeH).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR3 with RAMS (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      // --- Create the machine
      const m = createZ88TestSurface();

      // --- Prepare memory cards
      const card0 = m.cards.rom(pat.c0);
      const ramCard = m.cards.ram(pat.c1);
      const card1 = m.cards.rom(pat.c2);
      const card2 = m.cards.rom(pat.c3);
      const card3 = pat.c3Rom
        ? m.cards.rom(pat.c4)
        : m.cards.ram(pat.c4);

      // --- Set RAMS
      m.blink.setCOM(COMFlags.RAMS);

      // --- Insert cards
      const mem = m.memory;
      mem.insertCard(0, card0);
      mem.setRamCard(ramCard);
      mem.insertCard(1, card1);
      mem.insertCard(2, card2);
      mem.insertCard(3, card3);

      expect(m.chipMask0).toBe(card0.chipMask);
      expect(m.chipMask1).toBe(card1.chipMask);
      expect(m.chipMask2).toBe(card2.chipMask);
      expect(m.chipMask3).toBe(card3.chipMask);
      expect(m.chipMaskIntRam).toBe(ramCard.chipMask);

      // --- Try 00..1f bank settings for SR3
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & card0.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 20..3f bank settings for SR3
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & ramCard.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(CardType.Ram);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeL).toBe(CardType.Ram);
      }

      // --- Try 40..7f bank settings for SR3
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card1.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try 80..bf bank settings for SR3
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card2.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(CardType.Rom);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeH).toBe(CardType.Rom);
      }

      // --- Try c0..ff bank settings for SR3
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & card3.chipMask);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);  // BANK 0x20
        expect(m.s0TypeL).toBe(CardType.Ram); // RAM
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0TypeH).toBe(CardType.Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1TypeL).toBe(CardType.Rom);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1TypeH).toBe(CardType.Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2TypeL).toBe(CardType.Rom);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2TypeH).toBe(CardType.Rom);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3TypeL).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3TypeH).toBe(pat.c3Rom ? CardType.Rom : CardType.Ram);
      }
    });
  });
});
