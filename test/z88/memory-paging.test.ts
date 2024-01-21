import "mocha";
import { expect } from "expect";
import { Z88TestMachine } from "./Z88TestMachine";

describe("Cambridge Z88 - Memory paging", function () {
  this.timeout(10_000);

  it("SR register after init", () => {
    const m = new Z88TestMachine();
    m.setChipMask(0, 0x1f); // Slot 0 ROM 512K
    m.setChipMask(1, 0x1f); // Slot 1 RAM 512K
    m.setChipMask(2, 0x3f); // Slot 2 RAM 1M
    m.setChipMask(3, 0x3f); // Slot 3 RAM 1M
    m.setChipMask(4, 0x3f); // Slot 4 RAM 1M

    expect(m.chipMask0).toBe(0x1f);
    expect(m.chipMask1).toBe(0x1f);
    expect(m.chipMask2).toBe(0x3f);
    expect(m.chipMask3).toBe(0x3f);
    expect(m.chipMask4).toBe(0x3f);

    expect(m.s0OffsetL).toBe(0x00_0000);
    expect(m.s0ReadonlyL).toBe(true);
    expect(m.s0OffsetH).toBe(0x00_0000);
    expect(m.s0ReadonlyH).toBe(true);
    expect(m.s1OffsetL).toBe(0x00_0000);
    expect(m.s1ReadonlyL).toBe(true);
    expect(m.s1OffsetH).toBe(0x00_2000);
    expect(m.s1ReadonlyH).toBe(true);
    expect(m.s2OffsetL).toBe(0x00_0000);
    expect(m.s2ReadonlyL).toBe(true);
    expect(m.s2OffsetH).toBe(0x00_2000);
    expect(m.s2ReadonlyH).toBe(true);
    expect(m.s3OffsetL).toBe(0x00_0000);
    expect(m.s3ReadonlyL).toBe(true);
    expect(m.s3OffsetH).toBe(0x00_2000);
    expect(m.s3ReadonlyH).toBe(true);
  });

  // --- We use these test patterns to test the memory configuration
  const memConfigPatterns = [
    // (128K, 512K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (256K, 512K, 1M, 1M, 1M: RAM)
    { c0: 0x0f, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 512K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 32K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x01, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 64K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x03, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 128K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x07, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 256K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x0f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 32K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x01, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 64K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x03, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 128K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x07, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 256K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x0f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 32K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x01, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 64K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x03, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 128K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x07, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 256K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x0f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 512K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x1f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 32K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x01, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 64K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x03, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 128K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x07, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 256K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x0f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 512K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x1f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 1M, 32K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x01, c3Rom: false },

    // (128K, 512K, 1M, 1M, 64K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x03, c3Rom: false },

    // (128K, 512K, 1M, 1M, 128K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x07, c3Rom: false },

    // (128K, 512K, 1M, 1M, 256K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x0f, c3Rom: false },

    // (128K, 512K, 1M, 1M, 512K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x1f, c3Rom: false },

    // (128K, 512K, 1M, 1M, 32K: ROM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x01, c3Rom: true },

    // (128K, 512K, 1M, 1M, 64K: ROM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x03, c3Rom: true },

    // (128K, 512K, 1M, 1M, 128K: ROM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x07, c3Rom: true },

    // (128K, 512K, 1M, 1M, 256K: ROM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x0f, c3Rom: true },

    // (128K, 512K, 1M, 1M, 512K: ROM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x1f, c3Rom: true }
  ];

  // --- Test the memory configuration
  memConfigPatterns.forEach(pat => {
    it(`Set SR0 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      const m = new Z88TestMachine();
      m.setChipMask(0, pat.c0); // Chip 0 ROM 128K
      m.setChipMask(1, pat.c1); // Chip 1 RAM 512K
      m.setChipMask(2, pat.c2); // Chip 2 RAM 1M
      m.setChipMask(3, pat.c3); // Chip 3 RAM 1M
      m.setChipMask(4, pat.c4); // Chip 4 RAM 1M
      m.setSlotMask(3, pat.c3Rom); // Is Chip 4 ROM?

      expect(m.chipMask0).toBe(pat.c0);
      expect(m.chipMask1).toBe(pat.c1);
      expect(m.chipMask2).toBe(pat.c2);
      expect(m.chipMask3).toBe(pat.c3);
      expect(m.chipMask4).toBe(pat.c4);

      // --- Try 00..1f bank settings for SR0
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 20..3f bank settings for SR0
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0ReadonlyH).toBe(false);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyL).toBe(true);
      }

      // --- Try 40..7f bank settings for SR0
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0ReadonlyH).toBe(false);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 80..bf bank settings for SR0
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0ReadonlyH).toBe(false);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try c0..ff bank settings for SR0
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        m.setSR0(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(m.s0ReadonlyH).toBe(pat.c3Rom);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR1 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      const m = new Z88TestMachine();
      m.setChipMask(0, pat.c0); // Chip 0 ROM 128K
      m.setChipMask(1, pat.c1); // Chip 1 RAM 512K
      m.setChipMask(2, pat.c2); // Chip 2 RAM 1M
      m.setChipMask(3, pat.c3); // Chip 3 RAM 1M
      m.setChipMask(4, pat.c4); // Chip 4 RAM 1M
      m.setSlotMask(3, pat.c3Rom); // Is Chip 4 ROM?

      expect(m.chipMask0).toBe(pat.c0);
      expect(m.chipMask1).toBe(pat.c1);
      expect(m.chipMask2).toBe(pat.c2);
      expect(m.chipMask3).toBe(pat.c3);
      expect(m.chipMask4).toBe(pat.c4);

      // --- Try 00..1f bank settings for SR1
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 20..3f bank settings for SR1
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1ReadonlyL).toBe(false);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1ReadonlyH).toBe(false);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 40..7f bank settings for SR1
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1ReadonlyL).toBe(false);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1ReadonlyH).toBe(false);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 80..bf bank settings for SR1
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1ReadonlyL).toBe(false);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1ReadonlyH).toBe(false);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try c0..ff bank settings for SR1
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        m.setSR1(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s1ReadonlyL).toBe(pat.c3Rom);
        expect(m.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s1ReadonlyH).toBe(pat.c3Rom);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR2 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      const m = new Z88TestMachine();
      m.setChipMask(0, pat.c0); // Chip 0 ROM 128K
      m.setChipMask(1, pat.c1); // Chip 1 RAM 512K
      m.setChipMask(2, pat.c2); // Chip 2 RAM 1M
      m.setChipMask(3, pat.c3); // Chip 3 RAM 1M
      m.setChipMask(4, pat.c4); // Chip 4 RAM 1M
      m.setSlotMask(3, pat.c3Rom); // Is Chip 4 ROM?

      expect(m.chipMask0).toBe(pat.c0);
      expect(m.chipMask1).toBe(pat.c1);
      expect(m.chipMask2).toBe(pat.c2);
      expect(m.chipMask3).toBe(pat.c3);
      expect(m.chipMask4).toBe(pat.c4);

      // --- Try 00..1f bank settings for SR2
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 20..3f bank settings for SR2
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2ReadonlyL).toBe(false);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2ReadonlyH).toBe(false);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 40..7f bank settings for SR2
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2ReadonlyL).toBe(false);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2ReadonlyH).toBe(false);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 80..bf bank settings for SR2
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2ReadonlyL).toBe(false);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2ReadonlyH).toBe(false);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try c0..ff bank settings for SR2
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        m.setSR2(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s2ReadonlyL).toBe(pat.c3Rom);
        expect(m.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s2ReadonlyH).toBe(pat.c3Rom);
        expect(m.s3OffsetL).toBe(0x00_0000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(0x00_2000);
        expect(m.s3ReadonlyH).toBe(true);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR3 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      const m = new Z88TestMachine();
      m.setChipMask(0, pat.c0); // Chip 0 ROM 128K
      m.setChipMask(1, pat.c1); // Chip 1 RAM 512K
      m.setChipMask(2, pat.c2); // Chip 2 RAM 1M
      m.setChipMask(3, pat.c3); // Chip 3 RAM 1M
      m.setChipMask(4, pat.c4); // Chip 4 RAM 1M
      m.setSlotMask(3, pat.c3Rom); // Is Chip 4 ROM?

      expect(m.chipMask0).toBe(pat.c0);
      expect(m.chipMask1).toBe(pat.c1);
      expect(m.chipMask2).toBe(pat.c2);
      expect(m.chipMask3).toBe(pat.c3);
      expect(m.chipMask4).toBe(pat.c4);

      // --- Try 00..1f bank settings for SR3
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 20..3f bank settings for SR3
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(false);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(false);
      }

      // --- Try 40..7f bank settings for SR3
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(false);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(false);
      }

      // --- Try 80..bf bank settings for SR3
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(false);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(false);
      }

      // --- Try c0..ff bank settings for SR3
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x00_0000);
        expect(m.s0ReadonlyL).toBe(true);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(pat.c3Rom);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(pat.c3Rom);
      }
    });
  });

  memConfigPatterns.forEach(pat => {
    it(`Set SR3 with RAMS (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      const m = new Z88TestMachine();
      m.setChipMask(0, pat.c0); // Chip 0 ROM 128K
      m.setChipMask(1, pat.c1); // Chip 1 RAM 512K
      m.setChipMask(2, pat.c2); // Chip 2 RAM 1M
      m.setChipMask(3, pat.c3); // Chip 3 RAM 1M
      m.setChipMask(4, pat.c4); // Chip 4 RAM 1M
      m.setSlotMask(3, pat.c3Rom); // Is Chip 4 ROM?
      m.blinkDevice.setCOM(0x04); // Set COM.RAMS

      expect(m.chipMask0).toBe(pat.c0);
      expect(m.chipMask1).toBe(pat.c1);
      expect(m.chipMask2).toBe(pat.c2);
      expect(m.chipMask3).toBe(pat.c3);
      expect(m.chipMask4).toBe(pat.c4);

      // --- Try 00..1f bank settings for SR3
      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);
        expect(m.s0ReadonlyL).toBe(false);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(true);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(true);
      }

      // --- Try 20..3f bank settings for SR3
      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);
        expect(m.s0ReadonlyL).toBe(false);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(false);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(false);
      }

      // --- Try 40..7f bank settings for SR3
      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);
        expect(m.s0ReadonlyL).toBe(false);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(false);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(false);
      }

      // --- Try 80..bf bank settings for SR3
      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);
        expect(m.s0ReadonlyL).toBe(false);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(false);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(false);
      }

      // --- Try c0..ff bank settings for SR3
      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        m.setSR3(bank);

        expect(m.s0OffsetL).toBe(0x08_0000);
        expect(m.s0ReadonlyL).toBe(false);
        expect(m.s0OffsetH).toBe(0x00_0000);
        expect(m.s0ReadonlyH).toBe(true);
        expect(m.s1OffsetL).toBe(0x00_0000);
        expect(m.s1ReadonlyL).toBe(true);
        expect(m.s1OffsetH).toBe(0x00_2000);
        expect(m.s1ReadonlyH).toBe(true);
        expect(m.s2OffsetL).toBe(0x00_0000);
        expect(m.s2ReadonlyL).toBe(true);
        expect(m.s2OffsetH).toBe(0x00_2000);
        expect(m.s2ReadonlyH).toBe(true);
        expect(m.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(m.s3ReadonlyL).toBe(pat.c3Rom);
        expect(m.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(m.s3ReadonlyH).toBe(pat.c3Rom);
      }
    });
  });
});
