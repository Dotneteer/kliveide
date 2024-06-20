import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { MemoryDevice, OFFS_DIVMMC_RAM, OFFS_DIVMMC_ROM, OFFS_NEXT_ROM } from "@emu/machines/zxNext/MemoryDevice";

const nextRom0Signature0 = [0xf3, 0xc3, 0xef, 0x00, 0x45, 0x44, 0x08, 0x02]; // 0x0000
const nextRom0Signature1 = [0xdd, 0xcb, 0x27, 0x46, 0x28, 0x03, 0x7a, 0x53]; // 0x2000
const divMmcRomSignature = [0xf3, 0xc3, 0x6a, 0x00, 0x44, 0x56, 0x08, 0x02]; // 0x0000

describe("Next - DivMmcDevice", async function () {
  it("After cold start", async () => {
    // --- Act
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;

    // --- Assert
    expect(d.conmem).toBe(false);
    expect(d.mapram).toBe(false);
    expect(d.bank).toBe(0);
    expect(d.pagedIn).toBe(false);
    expect(d.pageInRequested).toBe(false);
    expect(d.pageOutRequested).toBe(false);
    for (let i = 0; i < 8; i++) {
      expect(d.rstTraps[i].enabled).toBe(false);
      expect(d.rstTraps[i].onlyWithRom3).toBe(false);
      expect(d.rstTraps[i].instantMapping).toBe(false);
    }
  });

  it("DivMMC does not respond any reg value while disabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divmmc = m.divMmcDevice;
    const memory = m.memoryDevice;

    // --- Act
    let differs = 0;
    divmmc.enableAutomap = false;
    for (let i = 0; i < 0x100; i++) {
      divmmc.port0xe3Value = i;
      if (
        !romSlotSignatureMatches(memory, 0, nextRom0Signature0) ||
        !romSlotSignatureMatches(memory, 1, nextRom0Signature1)
      ) {
        differs++;
      }
    }

    // --- Assert
    expect(differs).toBe(0);
  });

  for (let i = 0; i < 0x10; i++) {
    it(`CONMEM=0 (no MAPRAM) does not page in DivMMC ROM Bank ${i}`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const divmmc = m.divMmcDevice;
      const memory = m.memoryDevice;

      // --- Act
      let differs = 0;
      divmmc.enableAutomap = true;
      for (let i = 0; i < 0x80; i++) {
        divmmc.port0xe3Value = i;
        if (
          !romSlotSignatureMatches(memory, 0, nextRom0Signature0) ||
          !romSlotSignatureMatches(memory, 1, nextRom0Signature1)
        ) {
          differs++;
        }
      }

      // --- Assert
      expect(differs).toBe(0);
    });
  }

  for (let i = 0; i < 0x10; i++) {
    it(`CONMEM=1 (no MAPRAM) pages in DivMMC ROM Bank ${i}`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const divmmc = m.divMmcDevice;
      const memory = m.memoryDevice;

      // --- Act
      let differs = 0;
      divmmc.enableAutomap = true;
      for (let i = 0; i < 0x10; i++) {
        divmmc.port0xe3Value = 0x80 + i;
        if (!romSlotSignatureMatches(memory, 0, divMmcRomSignature)) {
          differs++;
        }
        const pageInfo = memory.getPageInfo(1);
        if (
          pageInfo.readOffset !== OFFS_DIVMMC_RAM + i * 0x2000 ||
          pageInfo.writeOffset !== OFFS_DIVMMC_RAM + i * 0x2000
        ) {
          differs++;
        }
      }

      // --- Assert
      expect(differs).toBe(0);
    });
  }

  it("RST $00 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = false;
    d.rstTraps[0].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xF1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $00 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = false;
    d.rstTraps[0].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xF1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $00 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xF1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF3);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $00 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xF1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $00 automaps ROM 0 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = true;
    d.rstTraps[0].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xF1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $00 automaps ROM 0 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = false;
    d.rstTraps[0].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xF1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $00 automaps ROM 3 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = true;
    d.rstTraps[0].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000, 0xF1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF3);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $00 automaps ROM 3 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].instantMapping = false;
    d.rstTraps[0].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000, 0xF1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $08 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = false;
    d.rstTraps[1].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xF1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $08 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = false;
    d.rstTraps[1].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xF1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $08 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xF1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xC3);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $08 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xF1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $08 automaps ROM 0 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = true;
    d.rstTraps[1].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xF1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $08 automaps ROM 0 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = false;
    d.rstTraps[1].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xF1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $08 automaps ROM 3 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = true;
    d.rstTraps[1].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x08, 0xF1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xc3);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $08 automaps ROM 3 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = false;
    d.rstTraps[1].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x08, 0xF1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $10 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = false;
    d.rstTraps[2].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xF1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $10 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = false;
    d.rstTraps[2].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xF1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $10 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = true;
    d.rstTraps[2].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xF1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xdf);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $10 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = true;
    d.rstTraps[2].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xF1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $10 automaps ROM 0 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = true;
    d.rstTraps[2].instantMapping = true;
    d.rstTraps[2].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xF1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $10 automaps ROM 0 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = true;
    d.rstTraps[2].instantMapping = false;
    d.rstTraps[2].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xF1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $10 automaps ROM 3 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = true;
    d.rstTraps[2].instantMapping = true;
    d.rstTraps[2].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x10, 0xF1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xdf);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $10 automaps ROM 3 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = true;
    d.rstTraps[2].instantMapping = false;
    d.rstTraps[2].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x10, 0xF1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $18 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = false;
    d.rstTraps[3].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xF1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $18 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = false;
    d.rstTraps[3].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xF1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $18 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = true;
    d.rstTraps[3].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xF1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0x00);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $18 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = true;
    d.rstTraps[3].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xF1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $18 automaps ROM 0 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = true;
    d.rstTraps[3].instantMapping = true;
    d.rstTraps[3].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xF1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $18 automaps ROM 0 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = true;
    d.rstTraps[3].instantMapping = false;
    d.rstTraps[3].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xF1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $18 automaps ROM 3 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = true;
    d.rstTraps[3].instantMapping = true;
    d.rstTraps[3].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x18, 0xF1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0x00);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $18 automaps ROM 3 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = true;
    d.rstTraps[3].instantMapping = false;
    d.rstTraps[3].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x18, 0xF1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $20 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = false;
    d.rstTraps[4].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xF1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $20 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = false;
    d.rstTraps[4].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xF1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $20 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xF1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0x33);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $20 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xF1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $20 automaps ROM 0 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    d.rstTraps[4].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xF1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $20 automaps ROM 0 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = false;
    d.rstTraps[4].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xF1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $20 automaps ROM 3 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    d.rstTraps[4].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x20, 0xF1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0x33);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $20 automaps ROM 3 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = false;
    d.rstTraps[4].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x20, 0xF1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $28 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = false;
    d.rstTraps[5].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xF1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $28 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = false;
    d.rstTraps[5].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xF1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $28 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = true;
    d.rstTraps[5].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xF1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xe3);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $28 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = true;
    d.rstTraps[5].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xF1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $28 automaps ROM 0 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = true;
    d.rstTraps[5].instantMapping = true;
    d.rstTraps[5].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xF1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $28 automaps ROM 0 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = true;
    d.rstTraps[5].instantMapping = false;
    d.rstTraps[5].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xF1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $28 automaps ROM 3 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = true;
    d.rstTraps[5].instantMapping = true;
    d.rstTraps[5].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x28, 0xF1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xe3);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $28 automaps ROM 3 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = true;
    d.rstTraps[5].instantMapping = false;
    d.rstTraps[5].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x28, 0xF1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $30 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = false;
    d.rstTraps[6].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xF1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $30 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = false;
    d.rstTraps[6].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xF1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $30 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = true;
    d.rstTraps[6].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xF1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xd9);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $30 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = true;
    d.rstTraps[6].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xF1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $30 automaps ROM 0 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = true;
    d.rstTraps[6].instantMapping = true;
    d.rstTraps[6].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xF1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $30 automaps ROM 0 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = true;
    d.rstTraps[6].instantMapping = false;
    d.rstTraps[6].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xF1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $30 automaps ROM 3 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = true;
    d.rstTraps[6].instantMapping = true;
    d.rstTraps[6].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x30, 0xF1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xd9);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $30 automaps ROM 3 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = true;
    d.rstTraps[6].instantMapping = false;
    d.rstTraps[6].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x30, 0xF1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $38 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = false;
    d.rstTraps[7].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xF1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $38 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = false;
    d.rstTraps[7].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xF1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $38 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = true;
    d.rstTraps[7].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xF1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xc3);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $38 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = true;
    d.rstTraps[7].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xF1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $38 automaps ROM 0 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = true;
    d.rstTraps[7].instantMapping = true;
    d.rstTraps[7].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xF1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $38 automaps ROM 0 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = true;
    d.rstTraps[7].instantMapping = false;
    d.rstTraps[7].onlyWithRom3 = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xF1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $38 automaps ROM 3 (enabled, only ROM 3, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = true;
    d.rstTraps[7].instantMapping = true;
    d.rstTraps[7].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x38, 0xF1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xc3);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });

  it("RST $38 automaps ROM 3 (enabled, only ROM 3, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = true;
    d.rstTraps[7].instantMapping = false;
    d.rstTraps[7].onlyWithRom3 = true;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x38, 0xF1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);   
    expect(pageBefore.writeOffset).toBe(null);   
    expect(m.opCode).toBe(0xF1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);   
    expect(pageAfter.writeOffset).toBe(null);   
  });
});

function romSlotSignatureMatches(m: MemoryDevice, page: number, signature: number[]): boolean {
  for (let i = 0; i < signature.length; i++) {
    if (m.readMemory(page * 0x2000 + i) !== signature[i]) {
      return false;
    }
  }
  return true;
}
