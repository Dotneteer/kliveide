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
        memDevice.setNextRegMmmuValue(j, i);
        expect(isRam(memDevice, j)).toBe(true);
        expect(isPagedIn(memDevice, j, i)).toBe(true);

        memDevice.setNextRegMmmuValue(j, mmuOld[j]);
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
