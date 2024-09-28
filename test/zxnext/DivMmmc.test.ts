import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import {
  MemoryDevice,
  OFFS_DIVMMC_RAM,
  OFFS_DIVMMC_ROM,
  OFFS_NEXT_ROM
} from "@emu/machines/zxNext/MemoryDevice";

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
      expect(d.rstTraps[i].enabled).toBe((0x83 & (1 << i)) !== 0);
      expect(d.rstTraps[i].onlyWithRom3).toBe(i !== 0);
      expect(d.rstTraps[i].instantMapping).toBe(false);
    }
  });

  it("DivMMC does not respond any reg values between 0x00 and 0x7f while disabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divmmc = m.divMmcDevice;
    const memory = m.memoryDevice;

    // --- Act
    let differs = 0;
    divmmc.enableAutomap = false;
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

  // for (let i = 0; i < 0x10; i++) {
  //   it(`CONMEM=1 (no MAPRAM) pages in DivMMC ROM Bank ${i}`, async () => {
  //     // --- Arrange
  //     const m = await createTestNextMachine();
  //     const divmmc = m.divMmcDevice;
  //     const memory = m.memoryDevice;

  //     // --- Act
  //     let differs = 0;
  //     divmmc.enableAutomap = true;
  //     for (let i = 0; i < 0x10; i++) {
  //       divmmc.port0xe3Value = 0x80 + i;
  //       if (!romSlotSignatureMatches(memory, 0, divMmcRomSignature)) {
  //         differs++;
  //       }
  //       const pageInfo = memory.getPageInfo(1);
  //       if (
  //         pageInfo.readOffset !== OFFS_DIVMMC_RAM + i * 0x2000 ||
  //         pageInfo.writeOffset !== OFFS_DIVMMC_RAM + i * 0x2000
  //       ) {
  //         differs++;
  //       }
  //     }

  //     // --- Assert
  //     expect(differs).toBe(0x10);
  //   });
  // }

  it("RST $00 automaps (disabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = false;
    d.rstTraps[0].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

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

  it("RST $00 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = false;
    d.rstTraps[0].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

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

  it("RST $00 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[0].enabled = true;
    d.rstTraps[0].onlyWithRom3 = false;
    d.rstTraps[0].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf3);
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
    d.rstTraps[0].onlyWithRom3 = false;
    d.rstTraps[0].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

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
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

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
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf3);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xf1);
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

  it("RST $08 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = false;
    d.rstTraps[1].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xf1);
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

  it("RST $08 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xf1);
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

  it("RST $08 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[1].enabled = true;
    d.rstTraps[1].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x08, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x08, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x08, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xf1);
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

  it("RST $10 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = false;
    d.rstTraps[2].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xf1);
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

  it("RST $10 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = true;
    d.rstTraps[2].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xf1);
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

  it("RST $10 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[2].enabled = true;
    d.rstTraps[2].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x10, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x10, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x10, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xf1);
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

  it("RST $18 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = false;
    d.rstTraps[3].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xf1);
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

  it("RST $18 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = true;
    d.rstTraps[3].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xf1);
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

  it("RST $18 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[3].enabled = true;
    d.rstTraps[3].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x18, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x18, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x18, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
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

  it("RST $20 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = false;
    d.rstTraps[4].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
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

  it("RST $20 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
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

  it("RST $20 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x20, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x20, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xf1);
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

  it("RST $28 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = false;
    d.rstTraps[5].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xf1);
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

  it("RST $28 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = true;
    d.rstTraps[5].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xf1);
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

  it("RST $28 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[5].enabled = true;
    d.rstTraps[5].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x28, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x28, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x28, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xf1);
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

  it("RST $30 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = false;
    d.rstTraps[6].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xf1);
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

  it("RST $30 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = true;
    d.rstTraps[6].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xf1);
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

  it("RST $30 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[6].enabled = true;
    d.rstTraps[6].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x30, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x30, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x30, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xf1);
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

  it("RST $38 automaps (disabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = false;
    d.rstTraps[7].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xf1);
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

  it("RST $38 automaps (enabled, no delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = true;
    d.rstTraps[7].instantMapping = true;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xf1);
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

  it("RST $38 automaps (enabled, delay)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[7].enabled = true;
    d.rstTraps[7].instantMapping = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x38, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x38, 0xf1);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000 + 0x38, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xf1);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$056A does not automaps with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn056a = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x056a;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xeb);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$056A does not automaps with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn056a = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x056a;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xeb);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$056A automaps with ROM 3 (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn056a = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x056a;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xbf);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$04d7 does not automaps with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn04d7 = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x04d7;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x2a);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$04d7 does not automaps with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn04d7 = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x04d7;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x2a);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$04d7 automaps with ROM 3 (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn04d7 = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x04d7;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x47);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$0562 does not automaps with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn0562 = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x0562;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x52);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$0562 does not automaps with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn0562 = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x0562;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x52);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$0562 automaps with ROM 3 (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn0562 = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x0562;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0xdb);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$04c6 does not automaps with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn04c6 = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x04c6;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x70);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$04c6 does not automaps with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn04c6 = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x04c6;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x70);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$04c6 automaps with ROM 3 (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn04c6 = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x04c6;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x4000);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x21);
    expect(pageAfter.readOffset).toBe(OFFS_DIVMMC_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$3d00 does not automaps with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x3d00;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x65);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$3d00 does not automaps with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x3d00;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x65);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$3d00 automaps with ROM 3 (enabled, instant)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x3d00;

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

  it("$3df0 does not automaps with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x3df0;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x8a);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$3df0 does not automaps with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x3df0;

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x8a);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$3df0 automaps with ROM 3 (enabled, instant)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04;
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x3df0;

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

  it("$1ff8 pages out after opcode fetch", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.disableAutomapOn1ff8 = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    m.pc = 0x0020;
    m.executeCpuCycle();

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.pc = 0x1ff8;
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x3c);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$1ff8 pages out (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.disableAutomapOn1ff8 = false;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    m.pc = 0x0020;
    m.executeCpuCycle();

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.pc = 0x1ff8;
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x3c);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$1fff pages out after opcode fetch", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.disableAutomapOn1ff8 = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    m.pc = 0x0020;
    m.executeCpuCycle();

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.pc = 0x1fff;
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x20);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  it("$1fff pages out (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.disableAutomapOn1ff8 = false;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    m.pc = 0x0020;
    m.executeCpuCycle();

    // --- Act
    const pageBefore = m.memoryDevice.getPageInfo(0);
    m.pc = 0x1fff;
    m.executeCpuCycle();
    const pageAfter = m.memoryDevice.getPageInfo(0);

    // --- Assert
    expect(pageBefore.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageBefore.writeOffset).toBe(null);
    expect(m.opCode).toBe(0x20);
    expect(pageAfter.readOffset).toBe(OFFS_NEXT_ROM);
    expect(pageAfter.writeOffset).toBe(null);
  });

  for (let i = 0; i < 16; i++) {
    it(`MAPRAM=0 allows writing all RAM bank (${i})`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const d = m.divMmcDevice;
      const memDevice = m.memoryDevice;
      d.enableAutomap = true;
      d.port0xe3Value = 0x00;
      d.rstTraps[4].enabled = true;
      d.rstTraps[4].instantMapping = true;
      memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
      m.pc = 0x0020;
      d.port0xe3Value = 0x00 + i;
      m.executeCpuCycle();

      // --- Act
      const page0 = memDevice.getPageInfo(0);
      const page1 = memDevice.getPageInfo(1);
      memDevice.writeMemory(0x2000, 0x55);

      // --- Assert
      expect(page0.readOffset).toBe(OFFS_NEXT_ROM);
      expect(page1.readOffset).toBe(OFFS_NEXT_ROM + 0x2000);
      const readBack = memDevice.readMemory(0x2000);
      expect(readBack).toBe(0xdd);
    });
  }

  // for (let i = 0; i < 16; i++) {
  //   if (i === 3) {
  //     continue;
  //   }
  //   it(`MAPRAM=1 allows writing all RAM bank except RAM 3 (${i})`, async () => {
  //     // --- Arrange
  //     const m = await createTestNextMachine();
  //     const d = m.divMmcDevice;
  //     const memDevice = m.memoryDevice;
  //     d.enableAutomap = true;
  //     d.port0xe3Value = 0x00;
  //     d.rstTraps[4].enabled = true;
  //     d.rstTraps[4].instantMapping = true;
  //     memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
  //     m.pc = 0x0020;
  //     d.port0xe3Value = 0x40 + i;
  //     m.executeCpuCycle();

  //     // --- Act
  //     const page0 = memDevice.getPageInfo(0);
  //     const page1 = memDevice.getPageInfo(1);
  //     memDevice.writeMemory(0x2000, 0x55);

  //     // --- Assert
  //     expect(page0.readOffset).toBe(OFFS_NEXT_ROM + 3 * 0x2000);
  //     expect(page1.readOffset).toBe(OFFS_DIVMMC_RAM + i * 0x2000);
  //     const readBack = memDevice.readMemory(0x2000);
  //     expect(readBack).toBe(0x55);
  //   });
  // }

  // it(`MAPRAM=1 prohibits writing RAM bank 3`, async () => {
  //   // --- Arrange
  //   const m = await createTestNextMachine();
  //   const d = m.divMmcDevice;
  //   const memDevice = m.memoryDevice;
  //   d.enableAutomap = true;
  //   d.port0xe3Value = 0x00;
  //   d.rstTraps[4].enabled = true;
  //   d.rstTraps[4].instantMapping = true;
  //   memDevice.directWrite(OFFS_NEXT_ROM + 0x20, 0xf1);
  //   m.pc = 0x0020;
  //   d.port0xe3Value = 0x40 + 0x03;
  //   m.executeCpuCycle();

  //   // --- Act
  //   const page0 = memDevice.getPageInfo(0);
  //   const page1 = memDevice.getPageInfo(1);
  //   memDevice.writeMemory(0x2000, 0x55);

  //   // --- Assert
  //   expect(page0.readOffset).toBe(OFFS_DIVMMC_RAM + 3 * 0x2000);
  //   expect(page1.readOffset).toBe(OFFS_DIVMMC_RAM + 3 * 0x2000);
  //   expect(page1.writeOffset).toBe(null);
  //   const readBack = memDevice.readMemory(0x2000);
  //   expect(readBack).toBe(0x00);
  // });

  it("DivMMC has priority over ROM select", async () => {
    // --- Act
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memory = m.memoryDevice;
    const nrDevice = m.nextRegDevice;

    d.port0xe3Value = 0x80;
    nrDevice.directSetRegValue(0x8e, 0x00);

    // --- Assert
    expect(romSlotSignatureMatches(memory, 0, divMmcRomSignature)).toBe(true);
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
