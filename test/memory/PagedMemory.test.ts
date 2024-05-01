import { describe, it, expect } from "vitest";
import { PagedMemory } from "@emu/machines/memory/PagedMemory";

describe("PagedMemory", () => {
  it("Constructor fails with invalid numRoms #1", () => {
    try {
      new PagedMemory(-1, 0);
    } catch (err) {
      expect(err.toString().includes("Invalid"));
      return;
    }
    expect(0).toEqual("Exception expected");
  });

  it("Constructor fails with invalid numRoms #2", () => {
    try {
      new PagedMemory(257, 0);
    } catch (err) {
      expect(err.toString().includes("Invalid"));
      return;
    }
    expect(0).toEqual("Exception expected");
  });

  it("Constructor fails with invalid numBanks #1", () => {
    try {
      new PagedMemory(0, -1);
    } catch (err) {
      expect(err.toString().includes("Invalid"));
      return;
    }
    expect(0).toEqual("Exception expected");
  });

  it("Constructor fails with invalid numBanks #2", () => {
    try {
      new PagedMemory(0, 257);
    } catch (err) {
      expect(err.toString().includes("Invalid"));
      return;
    }
    expect(0).toEqual("Exception expected");
  });

  const validCases = [
    {
      numRoms: 1,
      numBanks: 3,
      romOffs: 0x0000,
      bankOffs: 0x4000,
      length: 0x01_0000
    },
    {
      numRoms: 2,
      numBanks: 8,
      romOffs: 0x0000,
      bankOffs: 0x8000,
      length: 0x02_8000
    },

    {
      numRoms: 4,
      numBanks: 8,
      romOffs: 0x0000,
      bankOffs: 0x01_0000,
      length: 0x03_0000
    }
  ];

  validCases.forEach((c, idx) => {
    it(`Constructor creates memory #${idx + 1}`, () => {
      const pm = new PagedMemory(c.numRoms, c.numBanks);
      expect(pm.getPartitionOffset(-1)).toEqual(c.romOffs);
      expect(pm.getPartitionOffset(0)).toEqual(c.bankOffs);
      expect(pm.memory.length).toEqual(c.length);
    });
  });

  it("SP48 memory setup ok", () => {
    const pm = setupSp48Memory();
    let countRom = 0;
    let countPage0 = 0;
    let countPage1 = 0;
    let countPage2 = 0;
    for (let i = 0; i < 0x4000; i++) {
      let data = pm.readMemory(0x0000 + i);
      if (data === 0xf3) countRom++;
      data = pm.readMemory(0x4000 + i);
      if (data === 0x10) countPage0++;
      data = pm.readMemory(0x8000 + i);
      if (data === 0x20) countPage1++;
      data = pm.readMemory(0xc000 + i);
      if (data === 0x30) countPage2++;
    }

    expect(countRom).toEqual(0x4000);
    expect(countPage0).toEqual(0x4000);
    expect(countPage1).toEqual(0x4000);
    expect(countPage2).toEqual(0x4000);
  });

  it("SP48 memory cannot write ROM", () => {
    const pm = setupSp48Memory();
    let countRom = 0;
    pm.writeMemory(0, 0x11);
    pm.writeMemory(0x1fff, 0x11);
    pm.writeMemory(0x2000, 0x11);
    pm.writeMemory(0x3fff, 0x11);
    for (let i = 0; i < 0x4000; i++) {
      let data = pm.readMemory(0x0000 + i);
      if (data === 0xf3) countRom++;
    }

    expect(countRom).toEqual(0x4000);
  });

  it("SP48 memory can write RAM", () => {
    const pm = setupSp48Memory();
    pm.writeMemory(0x4000, 0x11);
    pm.writeMemory(0x5fff, 0x11);
    pm.writeMemory(0x6000, 0x11);
    pm.writeMemory(0x7fff, 0x11);
    pm.writeMemory(0x8000, 0x11);
    pm.writeMemory(0x9fff, 0x11);
    pm.writeMemory(0xa000, 0x11);
    pm.writeMemory(0xbfff, 0x11);
    pm.writeMemory(0xc000, 0x11);
    pm.writeMemory(0xdfff, 0x11);
    pm.writeMemory(0xe000, 0x11);
    pm.writeMemory(0xffff, 0x11);
    let countPage0 = 0;
    let countPage1 = 0;
    let countPage2 = 0;
    for (let i = 0; i < 0x4000; i++) {
      let data = pm.readMemory(0x4000 + i);
      if (data === 0x11) countPage0++;
      data = pm.readMemory(0x8000 + i);
      if (data === 0x11) countPage1++;
      data = pm.readMemory(0xc000 + i);
      if (data === 0x11) countPage2++;
    }

    expect(countPage0).toEqual(4);
    expect(countPage1).toEqual(4);
    expect(countPage2).toEqual(4);
  });
});

function setupSp48Memory (): PagedMemory {
  const pm = new PagedMemory(1, 3);
  pm.setPageInfo(0, pm.getPartitionOffset(-1), undefined, true);
  pm.setPageInfo(1, 0x2000 + pm.getPartitionOffset(-1), undefined, true);
  pm.setPageInfo(2, pm.getPartitionOffset(0), undefined, false);
  pm.setPageInfo(3, 0x2000 + pm.getPartitionOffset(0), undefined, false);
  pm.setPageInfo(4, pm.getPartitionOffset(1), undefined, false);
  pm.setPageInfo(5, 0x2000 + pm.getPartitionOffset(1), undefined, false);
  pm.setPageInfo(6, pm.getPartitionOffset(2), undefined, false);
  pm.setPageInfo(7, 0x2000 + pm.getPartitionOffset(2), undefined, false);
  pm.resetPartition(-1, 0xf3);
  pm.resetPartition(0, 0x10);
  pm.resetPartition(1, 0x20);
  pm.resetPartition(2, 0x30);
  return pm;
}
