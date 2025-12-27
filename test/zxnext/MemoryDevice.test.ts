import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { MemoryDevice } from "@emu/machines/zxNext/MemoryDevice";

const nextRom0Signature0 = [0xf3, 0xc3, 0xef, 0x00, 0x45, 0x44, 0x08, 0x02]; // 0x0000
const nextRom0Signature1 = [0xdd, 0xcb, 0x27, 0x46, 0x28, 0x03, 0x7a, 0x53]; // 0x2000
const nextRom1Signature0 = [0x00, 0xc3, 0x00, 0x3f, 0xff, 0xff, 0xff, 0xff]; // 0x0000
const nextRom1Signature1 = [0xcd, 0x29, 0x20, 0xd8, 0xcd, 0x27, 0x20, 0x30]; // 0x2000
const nextRom2Signature0 = [0x00, 0x18, 0xfd, 0x00, 0x00, 0x00, 0x00, 0x00]; // 0x0000
const nextRom2Signature1 = [0x6e, 0x74, 0x3d, 0x3f, 0x3f, 0x3f, 0x2d, 0x3f]; // 0x2000
const nextRom3Signature0 = [0xf3, 0xaf, 0x01, 0x3b, 0x24, 0xc3, 0xe8, 0x3b]; // 0x0000
const nextRom3Signature1 = [0x0d, 0xcd, 0x79, 0x1c, 0xcd, 0xc3, 0x1f, 0xcd]; // 0x2000
const AltRom0Signature0 = [0x00, 0x18, 0x08, 0x11, 0x08, 0x02, 0xc9, 0x00]; // 0x0000
const AltRom0Signature1 = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // 0x2000
const AltRom1Signature0 = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // 0x0000
const AltRom1Signature1 = [0xff, 0x00, 0x21, 0x00, 0xf7, 0x11, 0x01, 0xf7]; // 0x2000

describe("Next - MemoryDevice", async function () {
  it("After cold start", async () => {
    // --- Act
    const m = await createTestNextMachine();
    const d = m.memoryDevice;

    // --- Assert
    expect(isRom(d, 0)).toBe(true);
    expect(romSlotSignatureMatches(d, 0, nextRom0Signature0)).toBe(true);
    expect(isRom(d, 1)).toBe(true);
    expect(romSlotSignatureMatches(d, 1, nextRom0Signature1)).toBe(true);
    expect(isRam(d, 2)).toBe(true);
    expect(isPagedIn(d, 2, 0x0a)).toBe(true);
    expect(isRam(d, 3)).toBe(true);
    expect(isPagedIn(d, 3, 0x0b)).toBe(true);
    expect(isRam(d, 4)).toBe(true);
    expect(isPagedIn(d, 4, 0x04)).toBe(true);
    expect(isRam(d, 5)).toBe(true);
    expect(isPagedIn(d, 5, 0x05)).toBe(true);
    expect(isRam(d, 6)).toBe(true);
    expect(isPagedIn(d, 6, 0x00)).toBe(true);
    expect(isRam(d, 7)).toBe(true);
    expect(isPagedIn(d, 7, 0x01)).toBe(true);
  });

  const m = await createTestNextMachine();
  const memDevice = m.memoryDevice;
  const io = m.portManager;
  const nrDevice = m.nextRegDevice;

  for (let i = 0; i < 8; i++) {
    it(`0x7ffd changes RAM bank to ${i}`, async () => {
      io.writePort(0x7ffd, i);
      expect(isRam(memDevice, 6)).toBe(true);
      expect(isPagedIn(memDevice, 6, i * 2)).toBe(true);
      expect(isPagedIn(memDevice, 7, i * 2 + 1)).toBe(true);
    });
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 15; j++) {
      it(`0x7ffd/0xdffd changes RAM bank to ${8 * j + i}`, async () => {
        io.writePort(0x7ffd, i);
        io.writePort(0xdffd, j);
        expect(isRam(memDevice, 6)).toBe(true);
        expect(isPagedIn(memDevice, 6, 8 * j + i * 2)).toBe(true);
        expect(isPagedIn(memDevice, 7, 8 * j + i * 2 + 1)).toBe(true);
      });
    }
  }

  it("0x1ffd/0x7ffd changes ROM bank to ROM 0 (#1)", async () => {
    io.writePort(0x1ffd, 0x00);
    io.writePort(0x7ffd, 0x00);
    expect(isRom(memDevice, 0)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 0, nextRom0Signature0)).toBe(true);
    expect(isRom(memDevice, 1)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 1, nextRom0Signature1)).toBe(true);
  });

  it("0x1ffd/0x7ffd changes ROM bank to ROM 0 (#2)", async () => {
    io.writePort(0x7ffd, 0x00);
    io.writePort(0x1ffd, 0x00);
    expect(isRom(memDevice, 0)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 0, nextRom0Signature0)).toBe(true);
    expect(isRom(memDevice, 1)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 1, nextRom0Signature1)).toBe(true);
  });

  it("0x1ffd/0x7ffd changes ROM bank to ROM 1 (#1)", async () => {
    io.writePort(0x1ffd, 0x00);
    io.writePort(0x7ffd, 0x10);
    expect(isRom(memDevice, 0)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 0, nextRom1Signature0)).toBe(true);
    expect(isRom(memDevice, 1)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 1, nextRom1Signature1)).toBe(true);
  });

  it("0x1ffd/0x7ffd changes ROM bank to ROM 1 (#2)", async () => {
    io.writePort(0x7ffd, 0x10);
    io.writePort(0x1ffd, 0x00);
    expect(isRom(memDevice, 0)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 0, nextRom1Signature0)).toBe(true);
    expect(isRom(memDevice, 1)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 1, nextRom1Signature1)).toBe(true);
  });

  it("0x1ffd/0x7ffd changes ROM bank to ROM 2 (#1)", async () => {
    io.writePort(0x1ffd, 0x04);
    io.writePort(0x7ffd, 0x00);
    expect(isRom(memDevice, 0)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 0, nextRom2Signature0)).toBe(true);
    expect(isRom(memDevice, 1)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 1, nextRom2Signature1)).toBe(true);
  });

  it("0x1ffd/0x7ffd changes ROM bank to ROM 2 (#2)", async () => {
    io.writePort(0x7ffd, 0x00);
    io.writePort(0x1ffd, 0x04);
    expect(isRom(memDevice, 0)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 0, nextRom2Signature0)).toBe(true);
    expect(isRom(memDevice, 1)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 1, nextRom2Signature1)).toBe(true);
  });

  it("0x1ffd/0x7ffd changes ROM bank to ROM 3 (#1)", async () => {
    io.writePort(0x1ffd, 0x04);
    io.writePort(0x7ffd, 0x10);
    expect(isRom(memDevice, 0)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 0, nextRom3Signature0)).toBe(true);
    expect(isRom(memDevice, 1)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 1, nextRom3Signature1)).toBe(true);
  });

  it("0x1ffd/0x7ffd changes ROM bank to ROM 3 (#2)", async () => {
    io.writePort(0x7ffd, 0x10);
    io.writePort(0x1ffd, 0x04);
    expect(isRom(memDevice, 0)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 0, nextRom3Signature0)).toBe(true);
    expect(isRom(memDevice, 1)).toBe(true);
    expect(romSlotSignatureMatches(memDevice, 1, nextRom3Signature1)).toBe(true);
  });

  for (let i = 0; i < 8; i++) {
    it(`ROM 0 keeps in with Alt ROM (R8C: ${(i << 4).toString(16)})`, async () => {
      io.writePort(0x7ffd, 0x00);
      io.writePort(0x1ffd, 0x00);
      nrDevice.directSetRegValue(0x8c, i << 4);
      expect(isRom(memDevice, 0)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 0, nextRom0Signature0)).toBe(true);
      expect(isRom(memDevice, 1)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 1, nextRom0Signature1)).toBe(true);
    });
  }

  for (let i = 0; i < 8; i++) {
    it(`ROM 1 keeps in with Alt ROM (R8C: ${(i << 4).toString(16)})`, async () => {
      io.writePort(0x7ffd, 0x10);
      io.writePort(0x1ffd, 0x00);
      nrDevice.directSetRegValue(0x8c, i << 4);
      expect(isRom(memDevice, 0)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 0, nextRom1Signature0)).toBe(true);
      expect(isRom(memDevice, 1)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 1, nextRom1Signature1)).toBe(true);
    });
  }

  for (let i = 0; i < 8; i++) {
    it(`ROM 2 keeps in with Alt ROM (R8C: ${(i << 4).toString(16)})`, async () => {
      io.writePort(0x7ffd, 0x00);
      io.writePort(0x1ffd, 0x04);
      nrDevice.directSetRegValue(0x8c, i << 4);
      expect(isRom(memDevice, 0)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 0, nextRom2Signature0)).toBe(true);
      expect(isRom(memDevice, 1)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 1, nextRom2Signature1)).toBe(true);
    });
  }

  for (let i = 0; i < 8; i++) {
    it(`ROM 3 keeps in with Alt ROM (R8C: ${(i << 4).toString(16)})`, async () => {
      io.writePort(0x7ffd, 0x10);
      io.writePort(0x1ffd, 0x04);
      nrDevice.directSetRegValue(0x8c, i << 4);
      expect(isRom(memDevice, 0)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 0, nextRom3Signature0)).toBe(true);
      expect(isRom(memDevice, 1)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 1, nextRom3Signature1)).toBe(true);
    });
  }

  const altPages0 = [
    [AltRom0Signature0, AltRom0Signature1],
    [AltRom0Signature0, AltRom0Signature1],
    [AltRom1Signature0, AltRom1Signature1],
    [AltRom1Signature0, AltRom1Signature1],
    [nextRom0Signature0, nextRom0Signature1],
    [nextRom1Signature0, nextRom1Signature1],
    [nextRom2Signature0, nextRom2Signature1],
    [nextRom3Signature0, nextRom3Signature1]
  ];
  altPages0.forEach((signatures, idx) => {
    it(`ROM 0 pages in Alt ROM (R8C: ${((idx + 8) << 4).toString(16)})`, async () => {
      io.writePort(0x7ffd, 0x00);
      io.writePort(0x1ffd, 0x00);
      nrDevice.directSetRegValue(0x8c, (idx + 8) << 4);
      expect(romSlotSignatureMatches(memDevice, 0, signatures[0])).toBe(true);
      expect(isRom(memDevice, 0)).toBe(idx < 4);
      expect(romSlotSignatureMatches(memDevice, 1, signatures[1])).toBe(true);
      expect(isRom(memDevice, 1)).toBe(idx < 4);
    });
  });

  const altPages1 = [
    [AltRom1Signature0, AltRom1Signature1],
    [AltRom0Signature0, AltRom0Signature1],
    [AltRom1Signature0, AltRom1Signature1],
    [AltRom1Signature0, AltRom1Signature1],
    [nextRom1Signature0, nextRom1Signature1],
    [nextRom1Signature0, nextRom1Signature1],
    [nextRom2Signature0, nextRom2Signature1],
    [nextRom3Signature0, nextRom3Signature1]
  ];
  altPages1.forEach((signatures, idx) => {
    it(`ROM 1 pages in Alt ROM (R8C: ${((idx + 8) << 4).toString(16)})`, async () => {
      io.writePort(0x7ffd, 0x10);
      io.writePort(0x1ffd, 0x00);
      nrDevice.directSetRegValue(0x8c, (idx + 8) << 4);
      expect(romSlotSignatureMatches(memDevice, 0, signatures[0])).toBe(true);
      expect(isRom(memDevice, 0)).toBe(idx < 4);
      expect(romSlotSignatureMatches(memDevice, 1, signatures[1])).toBe(true);
      expect(isRom(memDevice, 1)).toBe(idx < 4);
    });
  });

  const altPages2 = [
    [AltRom0Signature0, AltRom0Signature1],
    [AltRom0Signature0, AltRom0Signature1],
    [AltRom1Signature0, AltRom1Signature1],
    [AltRom1Signature0, AltRom1Signature1],
    [nextRom2Signature0, nextRom2Signature1],
    [nextRom1Signature0, nextRom1Signature1],
    [nextRom2Signature0, nextRom2Signature1],
    [nextRom3Signature0, nextRom3Signature1]
  ];
  altPages2.forEach((signatures, idx) => {
    it(`ROM 2 pages in Alt ROM (R8C: ${((idx + 8) << 4).toString(16)})`, async () => {
      io.writePort(0x7ffd, 0x00);
      io.writePort(0x1ffd, 0x04);
      nrDevice.directSetRegValue(0x8c, (idx + 8) << 4);
      expect(romSlotSignatureMatches(memDevice, 0, signatures[0])).toBe(true);
      expect(isRom(memDevice, 0)).toBe(idx < 4);
      expect(romSlotSignatureMatches(memDevice, 1, signatures[1])).toBe(true);
      expect(isRom(memDevice, 1)).toBe(idx < 4);
    });
  });

  const altPages3 = [
    [AltRom1Signature0, AltRom1Signature1],
    [AltRom0Signature0, AltRom0Signature1],
    [AltRom1Signature0, AltRom1Signature1],
    [AltRom1Signature0, AltRom1Signature1],
    [nextRom3Signature0, nextRom3Signature1],
    [nextRom1Signature0, nextRom1Signature1],
    [nextRom2Signature0, nextRom2Signature1],
    [nextRom3Signature0, nextRom3Signature1]
  ];
  altPages3.forEach((signatures, idx) => {
    it(`ROM 3 pages in Alt ROM (R8C: ${((idx + 8) << 4).toString(16)})`, async () => {
      io.writePort(0x7ffd, 0x10);
      io.writePort(0x1ffd, 0x04);
      nrDevice.directSetRegValue(0x8c, (idx + 8) << 4);
      expect(romSlotSignatureMatches(memDevice, 0, signatures[0])).toBe(true);
      expect(isRom(memDevice, 0)).toBe(idx < 4);
      expect(romSlotSignatureMatches(memDevice, 1, signatures[1])).toBe(true);
      expect(isRom(memDevice, 1)).toBe(idx < 4);
      nrDevice.directSetRegValue(0x8c, 0x08);
    });
  });

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      it(`Reg8E Bit 3=1 changes RAM bank to ${j}/${i}`, async () => {
        nrDevice.directSetRegValue(0x8e, (j << 7) + (i << 4) + 8);
        expect(isRam(memDevice, 6)).toBe(true);
        expect(isPagedIn(memDevice, 6, (j << 4) + i * 2)).toBe(true);
        expect(isRam(memDevice, 7)).toBe(true);
        expect(isPagedIn(memDevice, 7, (j << 4) + i * 2 + 1)).toBe(true);
        nrDevice.directSetRegValue(0x8e, 0x08);
      });
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      it(`Reg8E Bit 3=0 keeps previous RAM bank: ${j}/${i}`, async () => {
        io.writePort(0x7ffd, 0x05); // Select RAM bank 3
        nrDevice.directSetRegValue(0x8e, (j << 7) + (i << 4));
        expect(isRam(memDevice, 6)).toBe(true);
        expect(isPagedIn(memDevice, 6, 10)).toBe(true);
        expect(isRam(memDevice, 7)).toBe(true);
        expect(isPagedIn(memDevice, 7, 11)).toBe(true);
        nrDevice.directSetRegValue(0x8e, 0x08);
      });
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      it(`Reg8E Bit 3=1 overrides selected RAM bank MSB ${j}/${i}`, async () => {
        io.writePort(0x1ffd, 0x06); // Select RAM bank MSM
        nrDevice.directSetRegValue(0x8e, (j << 7) + (i << 4) + 8);
        expect(isRam(memDevice, 6)).toBe(true);
        expect(isPagedIn(memDevice, 6, (j << 4) + i * 2)).toBe(true);
        expect(isRam(memDevice, 7)).toBe(true);
        expect(isPagedIn(memDevice, 7, (j << 4) + i * 2 + 1)).toBe(true);
        nrDevice.directSetRegValue(0x8e, 0x08);
      });
    }
  }

  const romPages = [
    [nextRom0Signature0, nextRom0Signature1],
    [nextRom1Signature0, nextRom1Signature1],
    [nextRom2Signature0, nextRom2Signature1],
    [nextRom3Signature0, nextRom3Signature1]
  ];
  romPages.forEach((signatures, idx) => {
    it(`Reg8E changes ROM bank to ${idx} #1`, async () => {
      nrDevice.directSetRegValue(0x8e, idx);
      expect(isRom(memDevice, 0)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 0, signatures[0])).toBe(true);
      expect(isRom(memDevice, 1)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 1, signatures[1])).toBe(true);
      nrDevice.directSetRegValue(0x8e, 0x00);
    });
  });
  romPages.forEach((signatures, idx) => {
    it(`Reg8E changes ROM bank to ${idx} #2`, async () => {
      nrDevice.directSetRegValue(0x8e, idx + 0x08);
      expect(isRom(memDevice, 0)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 0, signatures[0])).toBe(true);
      expect(isRom(memDevice, 1)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 1, signatures[1])).toBe(true);
      nrDevice.directSetRegValue(0x8e, 0x00);
    });
  });
  romPages.forEach((signatures, idx) => {
    it(`Reg8E changes ROM bank to ${idx} #3`, async () => {
      nrDevice.directSetRegValue(0x8e, idx + 0x80);
      expect(isRom(memDevice, 0)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 0, signatures[0])).toBe(true);
      expect(isRom(memDevice, 1)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 1, signatures[1])).toBe(true);
      nrDevice.directSetRegValue(0x8e, 0x00);
    });
  });
  romPages.forEach((signatures, idx) => {
    it(`Reg8E changes ROM bank to ${idx} #4`, async () => {
      nrDevice.directSetRegValue(0x8e, idx + 0x88);
      expect(isRom(memDevice, 0)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 0, signatures[0])).toBe(true);
      expect(isRom(memDevice, 1)).toBe(true);
      expect(romSlotSignatureMatches(memDevice, 1, signatures[1])).toBe(true);
      nrDevice.directSetRegValue(0x8e, 0x00);
    });
  });
});

describe("Next MMUs - RAM", async function () {
  const m = await createTestNextMachine();
  const memDevice = m.memoryDevice;
  for (let i = 0; i < 224; i++) {
    const mmuOld: number[] = [];
    for (let j = 0; j < 8; j++) {
      mmuOld[j] = memDevice.getNextRegMmuValue(j);
    }
    for (let j = 2; j < 8; j++) {
      it(`Set MMU[${j}] to ${i}`, async () => {
        memDevice.setNextRegMmuValue(j, i);
        expect(isRam(memDevice, j)).toBe(true);
        expect(isPagedIn(memDevice, j, i)).toBe(true);

        memDevice.setNextRegMmuValue(j, mmuOld[j]);
      });
    }
  }
});

function romSlotSignatureMatches(m: MemoryDevice, page: number, signature: number[]): boolean {
  for (let i = 0; i < signature.length; i++) {
    if (m.readMemory(page * 0x2000 + i) !== signature[i]) {
      return false;
    }
  }
  return true;
}

function isRom(m: MemoryDevice, page: number): boolean {
  const pageInfo = m.getPageInfo(page);
  return pageInfo.writeOffset === null;
}

function isRam(m: MemoryDevice, page: number): boolean {
  const offset = page * 0x2000;
  const firstByte = m.readMemory(offset);
  m.writeMemory(offset, (firstByte ^ 0xff) & 0xff);
  return m.readMemory(offset) !== firstByte;
}

function isPagedIn(m: MemoryDevice, page: number, bank8k: number): boolean {
  const pageInfo = m.getPageInfo(page);
  return pageInfo.bank8k === bank8k;
}

describe("Next - MemoryDevice - Layer 2", async function () {
  const m = await createTestNextMachine();
  const memDevice = m.memoryDevice;
  const screenDevice = m.composedScreenDevice;
  const io = m.portManager;

  // Helper function to setup Layer 2 memory area with test pattern
  function setupLayer2TestPattern(bank16k: number, pattern: number) {
    const offset = 0x040000 + (bank16k * 0x4000);
    for (let i = 0; i < 0x4000; i++) {
      memDevice.memory[offset + i] = (pattern + i) & 0xff;
    }
  }

  // Helper function to reset Layer 2 flags
  function resetLayer2Flags() {
    screenDevice.layer2EnableMappingForReads = false;
    screenDevice.layer2EnableMappingForWrites = false;
    screenDevice.layer2Bank = 0;
    screenDevice.layer2UseShadowBank = false;
    screenDevice.layer2ActiveRamBank = 8;
    screenDevice.layer2ShadowRamBank = 11;
  }

  it("Layer 2 disabled - should read from normal memory", async () => {
    // --- Arrange
    resetLayer2Flags();
    setupLayer2TestPattern(8, 0xA0);
    memDevice.writeMemory(0x0000, 0x42);
    memDevice.writeMemory(0x4000, 0x43);
    memDevice.writeMemory(0x8000, 0x44);

    // --- Act & Assert
    expect(memDevice.readMemory(0x0000)).not.toBe(0xA0);
    expect(memDevice.readMemory(0x4000)).not.toBe(0xA0);
    expect(memDevice.readMemory(0x8000)).not.toBe(0xA0);
  });

  it("Layer 2 read enabled - First 16K segment (0x0000-0x3FFF)", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 0; // Map first 16K segment
    screenDevice.layer2ActiveRamBank = 8;
   
    // --- Act
    memDevice.writeMemory(0x0000, 0xA0);
    memDevice.writeMemory(0x1000, 0xA1);
    memDevice.writeMemory(0x3FFF, 0xA2);
    
    // --- Assert - Read back through Layer 2
    const v0 = memDevice.readMemory(0x0000);
    const v1 = memDevice.readMemory(0x1000);
    const v2 = memDevice.readMemory(0x3FFF);
    
    // Should read back what we wrote
    expect(v0).toBe(0xA0);
    expect(v1).toBe(0xA1);
    expect(v2).toBe(0xA2);
  });

  it("Layer 2 read enabled - Second 16K segment (0x4000-0x7FFF)", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2Bank = 1; // Map second 16K segment
    screenDevice.layer2ActiveRamBank = 9;
    
    // Write test pattern directly through Layer 2 write mapping
    screenDevice.layer2EnableMappingForWrites = true;
    memDevice.writeMemory(0x4000, 0xB0);
    memDevice.writeMemory(0x5000, 0xB1);
    memDevice.writeMemory(0x7FFF, 0xB2);
    
    // --- Act & Assert - Read back through Layer 2
    expect(memDevice.readMemory(0x4000)).toBe(0xB0);
    expect(memDevice.readMemory(0x5000)).toBe(0xB1);
    expect(memDevice.readMemory(0x7FFF)).toBe(0xB2);
  });

  it("Layer 2 read enabled - Third 16K segment (0x8000-0xBFFF)", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2Bank = 2; // Map third 16K segment
    screenDevice.layer2ActiveRamBank = 10;
    
    // Write test pattern directly through Layer 2 write mapping
    screenDevice.layer2EnableMappingForWrites = true;
    memDevice.writeMemory(0x8000, 0xC0);
    memDevice.writeMemory(0x9000, 0xC1);
    memDevice.writeMemory(0xBFFF, 0xC2);
    
    // --- Act & Assert - Read back through Layer 2
    expect(memDevice.readMemory(0x8000)).toBe(0xC0);
    expect(memDevice.readMemory(0x9000)).toBe(0xC1);
    expect(memDevice.readMemory(0xBFFF)).toBe(0xC2);
  });

  it("Layer 2 read enabled - All 48K mode (segment 3)", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 3; // Map all 48K
    screenDevice.layer2ActiveRamBank = 8;
    
    // Write to all three segments
    memDevice.writeMemory(0x0000, 0xD0);
    memDevice.writeMemory(0x3FFF, 0xD1);
    memDevice.writeMemory(0x4000, 0xE0);
    memDevice.writeMemory(0x7FFF, 0xE1);
    memDevice.writeMemory(0x8000, 0xF0);
    memDevice.writeMemory(0xBFFF, 0xF1);

    // --- Act & Assert - Read back what we wrote
    expect(memDevice.readMemory(0x0000)).toBe(0xD0);
    expect(memDevice.readMemory(0x3FFF)).toBe(0xD1);
    expect(memDevice.readMemory(0x4000)).toBe(0xE0);
    expect(memDevice.readMemory(0x7FFF)).toBe(0xE1);
    expect(memDevice.readMemory(0x8000)).toBe(0xF0);
    expect(memDevice.readMemory(0xBFFF)).toBe(0xF1);
  });

  it("Layer 2 write enabled - First 16K segment", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 0; // Map first 16K segment
    screenDevice.layer2ActiveRamBank = 8;

    // --- Act
    memDevice.writeMemory(0x0000, 0x55);
    memDevice.writeMemory(0x1000, 0xAA);
    memDevice.writeMemory(0x3FFF, 0xFF);

    // --- Assert - Read back to verify
    expect(memDevice.readMemory(0x0000)).toBe(0x55);
    expect(memDevice.readMemory(0x1000)).toBe(0xAA);
    expect(memDevice.readMemory(0x3FFF)).toBe(0xFF);
  });

  it("Layer 2 write enabled - Second 16K segment", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 1; // Map second 16K segment
    screenDevice.layer2ActiveRamBank = 9;

    // --- Act
    memDevice.writeMemory(0x4000, 0x11);
    memDevice.writeMemory(0x5000, 0x22);
    memDevice.writeMemory(0x7FFF, 0x33);

    // --- Assert - Read back to verify write went through
    expect(memDevice.readMemory(0x4000)).toBe(0x11);
    expect(memDevice.readMemory(0x5000)).toBe(0x22);
    expect(memDevice.readMemory(0x7FFF)).toBe(0x33);
  });

  it("Layer 2 write enabled - Third 16K segment", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 2; // Map third 16K segment
    screenDevice.layer2ActiveRamBank = 10;

    // --- Act
    memDevice.writeMemory(0x8000, 0x44);
    memDevice.writeMemory(0x9000, 0x55);
    memDevice.writeMemory(0xBFFF, 0x66);

    // --- Assert - Read back to verify write went through
    expect(memDevice.readMemory(0x8000)).toBe(0x44);
    expect(memDevice.readMemory(0x9000)).toBe(0x55);
    expect(memDevice.readMemory(0xBFFF)).toBe(0x66);
  });

  it("Layer 2 write enabled - All 48K mode", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 3; // Map all 48K
    screenDevice.layer2ActiveRamBank = 8;

    // --- Act
    memDevice.writeMemory(0x0000, 0x77);
    memDevice.writeMemory(0x4000, 0x88);
    memDevice.writeMemory(0x8000, 0x99);

    // --- Assert - Read back to verify
    expect(memDevice.readMemory(0x0000)).toBe(0x77);
    expect(memDevice.readMemory(0x4000)).toBe(0x88);
    expect(memDevice.readMemory(0x8000)).toBe(0x99);
  });

  it("Layer 2 shadow bank selection", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 0; // Map first 16K segment
    screenDevice.layer2ActiveRamBank = 8;
    screenDevice.layer2ShadowRamBank = 11;
    
    // Write using active bank
    screenDevice.layer2UseShadowBank = false;
    memDevice.writeMemory(0x0000, 0xAA);
    
    // Write using shadow bank
    screenDevice.layer2UseShadowBank = true;
    memDevice.writeMemory(0x0000, 0xBB);
    
    // --- Act & Assert - Read from shadow bank
    expect(memDevice.readMemory(0x0000)).toBe(0xBB);
    
    // Switch to active bank and read
    screenDevice.layer2UseShadowBank = false;
    expect(memDevice.readMemory(0x0000)).toBe(0xAA);
  });

  it("Layer 2 read/write independence", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 0;
    screenDevice.layer2ActiveRamBank = 8;
    
    // First, write with Layer 2 enabled to set up data
    memDevice.writeMemory(0x0000, 0xCC);
    
    // Now disable writes but keep reads enabled
    screenDevice.layer2EnableMappingForWrites = false;

    // --- Act - Write should go to normal memory, not Layer 2
    memDevice.writeMemory(0x0000, 0xDD);

    // --- Assert - Read from Layer 2 should still show old value
    expect(memDevice.readMemory(0x0000)).toBe(0xCC);
  });

  it("Layer 2 respects DivMMC priority", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2Bank = 0;
    screenDevice.layer2ActiveRamBank = 8;
    setupLayer2TestPattern(8, 0xEE);
    
    // Enable DivMMC viEnableMappingForWrites = true;
    screenDevice.layer2Bank = 0;
    screenDevice.layer2ActiveRamBank = 8;
    
    // Write to Layer 2
    memDevice.writeMemory(0x0000, 0xEE);
    
    // Enable DivMMC via port write (conmem bit 7 = 1)
    io.writePort(0xe3, 0x80);

    // --- Act & Assert
    // DivMMC should have higher priority than Layer 2
    const value = memDevice.readMemory(0x0000);
    expect(value).not.toBe(0xEE); // Should not read from Layer 2
  });

  it("Layer 2 does not map 0xC000-0xFFFF region", async () => {
    // --- Arrange
    resetLayer2Flags();
    screenDevice.layer2EnableMappingForReads = true;
    screenDevice.layer2EnableMappingForWrites = true;
    screenDevice.layer2Bank = 3; // All 48K mode
    screenDevice.layer2ActiveRamBank = 8;
    
    // Write to Layer 2 mapped regions
    memDevice.writeMemory(0x0000, 0xF0);
    memDevice.writeMemory(0x4000, 0xF1);
    memDevice.writeMemory(0x8000, 0xF2);
    
    // Disable Layer 2 writes and write a known value to 0xC000
    screenDevice.layer2EnableMappingForWrites = false;
    const normalMemoryValue = 0x99;
    memDevice.writeMemory(0xC000, normalMemoryValue);

    // --- Act & Assert
    const value = memDevice.readMemory(0xC000);
    expect(value).toBe(normalMemoryValue); // Should read from normal RAM
    expect(value).not.toBe(0xF2); // Should not read from Layer 2
  });

  describe("Memory timing and wait states", () => {
    it("Memory read at 3.5 MHz has 3 T-states delay", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x00; // 3.5 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000);

      // --- Assert
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Memory read at 7 MHz has 3 T-states delay", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x01; // 7 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000);

      // --- Assert
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Memory read at 14 MHz has 3 T-states delay", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x02; // 14 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000);

      // --- Assert
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Memory read at 28 MHz has 4 T-states delay (3 + 1 wait state)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000);

      // --- Assert
      expect(m.tacts - startTacts).toBe(4);
    });

    it("Memory write at 3.5 MHz has 3 T-states delay", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x00; // 3.5 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryWrite(0x4000);

      // --- Assert
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Memory write at 7 MHz has 3 T-states delay", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x01; // 7 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryWrite(0x4000);

      // --- Assert
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Memory write at 14 MHz has 3 T-states delay", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x02; // 14 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryWrite(0x4000);

      // --- Assert
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Memory write at 28 MHz has 3 T-states delay (no extra wait state)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryWrite(0x4000);

      // --- Assert
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Multiple reads at 28 MHz accumulate wait states correctly", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000);
      m.delayMemoryRead(0x5000);
      m.delayMemoryRead(0x6000);

      // --- Assert: 3 reads × 4 T-states each = 12 T-states
      expect(m.tacts - startTacts).toBe(12);
    });

    it("Mixed read/write at 28 MHz: reads have wait state, writes don't", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000);   // 4 T-states
      m.delayMemoryWrite(0x4000); // 3 T-states
      m.delayMemoryRead(0x5000);   // 4 T-states
      m.delayMemoryWrite(0x5000); // 3 T-states

      // --- Assert: 4 + 3 + 4 + 3 = 14 T-states
      expect(m.tacts - startTacts).toBe(14);
    });

    it("Bank 7 (BRAM) reads at 28MHz have NO wait state", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      
      // Map slot 6 to Bank 7 (page 0x0E)
      m.memoryDevice.setNextRegMmuValue(6, 0x0e); // MMU6 = page 0x0E (Bank 7)
      
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0xc000); // Address in slot 6 (Bank 7)

      // --- Assert: Should be only 3 base tacts, NO wait state
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Bank 5 (BRAM) reads at 28MHz have 1 wait state", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      
      // Map slot 2 to Bank 5 (page 0x0A - first 8KB of Bank 5)
      m.memoryDevice.setNextRegMmuValue(2, 0x0a); // MMU2 = page 0x0A (Bank 5)
      
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000); // Address in slot 2 (Bank 5)

      // --- Assert: Should be 3 base + 1 wait state = 4 tacts (due to arbitration)
      expect(m.tacts - startTacts).toBe(4);
    });

    it("Bank 5 second page (0x0B) reads at 28MHz also have 1 wait state", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      
      // Map slot 3 to second page of Bank 5 (page 0x0B)
      m.memoryDevice.setNextRegMmuValue(3, 0x0b); // MMU3 = page 0x0B (Bank 5)
      
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x6000); // Address in slot 3 (Bank 5 second page)

      // --- Assert
      expect(m.tacts - startTacts).toBe(4);
    });

    it("Regular SRAM reads at 28MHz have 1 wait state", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      
      // Map slot 4 to a regular SRAM page (not Bank 5 or 7)
      m.memoryDevice.setNextRegMmuValue(4, 0x10); // MMU4 = page 0x10 (SRAM)
      
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x8000); // Address in slot 4 (SRAM)

      // --- Assert
      expect(m.tacts - startTacts).toBe(4);
    });

    it("Bank 7 exception applies across all Bank 7 addresses", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      
      // Map slot 3 to Bank 7 (page 0x0E)
      m.memoryDevice.setNextRegMmuValue(3, 0x0e); // MMU3 = page 0x0E

      // --- Act & Assert: Test beginning of Bank 7
      let startTacts = m.tacts;
      m.delayMemoryRead(0x6000); // Start of slot 3
      expect(m.tacts - startTacts).toBe(3); // No wait state
      
      // Test end of Bank 7
      startTacts = m.tacts;
      m.delayMemoryRead(0x7fff); // End of slot 3
      expect(m.tacts - startTacts).toBe(3); // No wait state
    });

    it("Bank 7 mapped to different slot still has no wait state", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      
      // Map Bank 7 to slot 2 instead of default
      m.memoryDevice.setNextRegMmuValue(2, 0x0e); // MMU2 = page 0x0E (Bank 7)
      
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000); // Address in slot 2, but it's Bank 7

      // --- Assert: Should still be 3 tacts - exception follows the bank, not the address
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Bank 7 at lower CPU speeds has no wait state either", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x02; // 14 MHz
      
      // Map slot 6 to Bank 7
      m.memoryDevice.setNextRegMmuValue(6, 0x0e); // MMU6 = page 0x0E (Bank 7)
      
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0xc000); // Bank 7 read

      // --- Assert: 14 MHz never has wait states anyway
      expect(m.tacts - startTacts).toBe(3);
    });

    it("Mixed Bank 5, Bank 7, and SRAM reads at 28MHz", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
      
      m.memoryDevice.setNextRegMmuValue(2, 0x0a); // MMU2 = page 0x0A (Bank 5)
      m.memoryDevice.setNextRegMmuValue(3, 0x0e); // MMU3 = page 0x0E (Bank 7)
      m.memoryDevice.setNextRegMmuValue(4, 0x10); // MMU4 = page 0x10 (SRAM)
      
      const startTacts = m.tacts;

      // --- Act
      m.delayMemoryRead(0x4000);   // Bank 5: 4 T-states
      m.delayMemoryRead(0x6000);   // Bank 7: 3 T-states
      m.delayMemoryRead(0x8000);   // SRAM: 4 T-states

      // --- Assert: 4 + 3 + 4 = 11 T-states total
      expect(m.tacts - startTacts).toBe(11);
    });
  });
});
