import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { OFFS_NEXT_ROM } from "@emu/machines/zxNext/MemoryDevice";

const nextRom0Signature0 = [0xf3, 0xc3, 0xef, 0x00, 0x45, 0x44, 0x08, 0x02]; // 0x0000
const nextRom3Signature0 = [0xf3, 0xaf, 0x01, 0x3b, 0x24, 0xc3, 0xe8, 0x3b]; // 0x0000
const divMmcRomSignature = [0xf3, 0xc3, 0x6a, 0x00, 0x44, 0x56, 0x08, 0x02]; // 0x0000
const divMmcRstSignature = [0xf3, 0xc3, 0xdf, 0x00, 0x33, 0xe3, 0xd9, 0xc3]; // RST bytes in DivMMC ROM
const nextRom0_04c6 = 0x70;
const nextRom3_04c6 = 0x21;
const nextRom0_04d7 = 0x2a;
const nextRom3_04d7 = 0x47;
const nextRom0_0562 = 0x52;
const nextRom3_0562 = 0xdb;
const nextRom0_056a = 0xeb;
const nextRom3_056a = 0xbf;
const nextRom0_1ff8 = 0x3c;
const divMmcRom_1ff8 = 0xf1;
const nextRom0_3d00 = 0x65;
const divMmcRam3_3d00 = 0x00;
const nextRom0_3df0 = 0x8a;
const divMmcRam3_3df0 = 0x00;

describe("Next - DivMmcDevice", async function () {
  it("After cold start", async () => {
    // --- Act
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;

    // --- Assert
    expect(d.conmem).toBe(false);
    expect(d.mapram).toBe(false);
    expect(d.bank).toBe(0);
    for (let i = 0; i < 8; i++) {
      expect(d.rstTraps[i].enabled).toBe((0x83 & (1 << i)) !== 0);
      expect(d.rstTraps[i].onlyWithRom3).toBe(i !== 0);
      expect(d.rstTraps[i].instantMapping).toBe(false);
    }
  });

  it("DivMMC enabling", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    nrDevice.directSetRegValue(0x83, 0x01);

    // --- Assert
    expect(d.enabled).toBe(true);
  });

  it("DivMMC disabling", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    nrDevice.directSetRegValue(0x83, 0xfe);

    // --- Assert
    expect(d.enabled).toBe(false);
    expect(d.autoMapActive).toBe(false);
  });

  it("R/W DivMMC control reg while enabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    m.writePort(0x0e3, 0x85);
    const regVal = m.readPort(0x0e3);

    // --- Assert
    expect(regVal).toBe(0x85);
  });

  it("R/W DivMMC control reg while disabled #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    m.writePort(0x0e3, 0x85);
    nrDevice.directSetRegValue(0x83, 0x00);
    const regVal = m.readPort(0x0e3);

    // --- Assert
    expect(regVal).toBe(0xff);
  });

  it("R/W DivMMC control reg while disabled #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    nrDevice.directSetRegValue(0x83, 0x00);
    m.writePort(0x0e3, 0x85);
    const regVal = m.readPort(0x0e3);

    // --- Assert
    expect(regVal).toBe(0xff);
  });

  it("R/W DivMMC control reg while disabled #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    nrDevice.directSetRegValue(0x83, 0x00);
    m.writePort(0x0e3, 0x85);
    nrDevice.directSetRegValue(0x83, 0x01);
    const regVal = m.readPort(0x0e3);

    // --- Assert
    expect(regVal).toBe(0x00);
  });

  it("R/W DivMMC control reg while disabled #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    m.writePort(0x0e3, 0x85);
    nrDevice.directSetRegValue(0x83, 0x00);
    nrDevice.directSetRegValue(0x83, 0x01);
    const regVal = m.readPort(0x0e3);

    // --- Assert
    expect(regVal).toBe(0x85);
  });

  it("DivMMC enabling automap", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    nrDevice.directSetRegValue(0x0a, 0x10);

    // --- Assert
    expect(d.enableAutomap).toBe(true);
  });

  it("DivMMC disabling automap", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const d = m.divMmcDevice;

    // --- Act
    nrDevice.directSetRegValue(0x0a, 0x00);

    // --- Assert
    expect(d.enableAutomap).toBe(false);
    expect(d.autoMapActive).toBe(false);
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
      const addr0 = memory.readMemory(0x0000);
      const addr1 = memory.readMemory(0x0001);
      const addr7 = memory.readMemory(0x0007);
      if (
        addr0 !== divMmcRomSignature[0] ||
        addr1 !== divMmcRomSignature[1] ||
        addr7 !== divMmcRomSignature[7]
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
        const addr0 = memory.readMemory(0x0000);
        const addr1 = memory.readMemory(0x0001);
        const addr7 = memory.readMemory(0x0007);
        if (
          addr0 !== divMmcRomSignature[0] ||
          addr1 !== divMmcRomSignature[1] ||
          addr7 !== divMmcRomSignature[7]
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
        const addr0 = memory.readMemory(0x0000);
        const addr1 = memory.readMemory(0x0001);
        const addr7 = memory.readMemory(0x0007);
        if (
          addr0 !== divMmcRomSignature[0] ||
          addr1 !== divMmcRomSignature[1] ||
          addr7 !== divMmcRomSignature[7]
        ) {
          differs++;
        }
      }

      // --- Assert
      expect(differs).toBe(0x00);
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
    d.rstTraps[0].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(0xf1);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(0xf1);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[0].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(0xf1);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(0xf1);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[0].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(0xf1);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[0]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[0].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(0xf1);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.port1ffdValue = 0x00; // ROM 0
    memDevice.port7ffdValue = 0x00;
    memDevice.directWrite(OFFS_NEXT_ROM, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(0xf1);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(0xf1);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(0xf1);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(0xf1);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 3 * 0x4000, 0xf1);
    m.pc = 0x0000;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(0xf1);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[0]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(0xf1);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[1].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x008, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[1].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0008, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[1].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0008, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[1]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[1].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0008, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.port1ffdValue = 0x00; // ROM 0
    memDevice.port7ffdValue = 0x00;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0008, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0008, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0008 + 3 * 0x4000, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[1]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0008 + 3 * 0x4000, 0xf1);
    m.pc = 0x0008;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[2].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0010, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[2].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0010, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[2].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0010, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[2]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[2].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0010, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.port1ffdValue = 0x00; // ROM 0
    memDevice.port7ffdValue = 0x00;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0010, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0010, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0010 + 3 * 0x4000, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[2]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0010 + 3 * 0x4000, 0xf1);
    m.pc = 0x0010;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[3].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0018, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[3].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0018, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[3].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0018, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[3]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[3].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0018, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.port1ffdValue = 0x00; // ROM 0
    memDevice.port7ffdValue = 0x00;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0018, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0018, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0018 + 3 * 0x4000, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[3]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0018 + 3 * 0x4000, 0xf1);
    m.pc = 0x0018;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[4].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0020, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[4].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0020, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[4].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0020, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[4]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[4].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0020, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.port1ffdValue = 0x00; // ROM 0
    memDevice.port7ffdValue = 0x00;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0020, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0020, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0020 + 3 * 0x4000, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[4]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0020 + 3 * 0x4000, 0xf1);
    m.pc = 0x0020;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[5].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0028, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[5].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0028, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[5].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0028, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[5]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[5].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0028, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.port1ffdValue = 0x00; // ROM 0
    memDevice.port7ffdValue = 0x00;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0028, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0028, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0028 + 3 * 0x4000, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[5]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0028 + 3 * 0x4000, 0xf1);
    m.pc = 0x0028;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[6].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0030, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[6].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0030, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[6].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0030, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[6]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[6].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0030, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.port1ffdValue = 0x00; // ROM 0
    memDevice.port7ffdValue = 0x00;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0030, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0030, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0030 + 3 * 0x4000, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[6]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0030 + 3 * 0x4000, 0xf1);
    m.pc = 0x0030;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[7].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0038, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[7].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0038, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    d.rstTraps[7].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0038, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[7]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    d.rstTraps[7].onlyWithRom3 = false;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0038, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.port1ffdValue = 0x00; // ROM 0
    memDevice.port7ffdValue = 0x00;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0038, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0038, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0038 + 3 * 0x4000, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRstSignature[7]);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
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
    memDevice.directWrite(OFFS_NEXT_ROM + 0x0038 + 3 * 0x4000, 0xf1);
    m.pc = 0x0038;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(0xf1);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
  });

  it("$056A does not automap with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn056a = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x056a;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_056a);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$056A does not automap with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn056a = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x056a;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_056a);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$056A automaps with ROM 3 (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn056a = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x056a;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(nextRom3_056a);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
  });

  it("$04D7 does not automap with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn04d7 = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x04d7;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_04d7);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$04D7 does not automap with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn04d7 = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x04d7;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_04d7);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$04D7 automaps with ROM 3 (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn04d7 = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x04d7;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(nextRom3_04d7);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
  });

  it("$0562 does not automap with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn0562 = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x0562;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_0562);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$0562 does not automap with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn0562 = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x0562;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_0562);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$0562 automaps with ROM 3 (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn0562 = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x0562;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(nextRom3_0562);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
  });

  it("$04C6 does not automap with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn04c6 = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x04c6;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_04c6);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$04C6 does not automap with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn04c6 = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x04c6;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_04c6);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$04C6 automaps with ROM 3 (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn04c6 = true;
    d.port0xe3Value = 0x00;
    memDevice.port1ffdValue = 0x04; // ROM 3
    memDevice.port7ffdValue = 0x10;
    m.pc = 0x04c6;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(nextRom3_04c6);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
  });

  it("$3d00 does not automap with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x3d00;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_3d00);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$3d00 does not automaps with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x3d00;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_3d00);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRam3_3d00);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
  });

  it("$3df0 does not automap with ROM (disabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = false;
    d.port0xe3Value = 0x00;
    m.pc = 0x3df0;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_3df0);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$3df0 does not automaps with ROM (enabled)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOn3dxx = true;
    d.port0xe3Value = 0x00;
    m.pc = 0x3df0;

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom0Signature0[0]);
    expect(addr1Before).toBe(nextRom0Signature0[1]);
    expect(addr5Before).toBe(nextRom0Signature0[5]);
    expect(m.opCode).toBe(nextRom0_3df0);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
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
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(nextRom3Signature0[0]);
    expect(addr1Before).toBe(nextRom3Signature0[1]);
    expect(addr5Before).toBe(nextRom3Signature0[5]);
    expect(m.opCode).toBe(divMmcRam3_3df0);
    expect(addr0After).toBe(divMmcRomSignature[0]);
    expect(addr1After).toBe(divMmcRomSignature[1]);
    expect(addr5After).toBe(divMmcRomSignature[5]);
  });

  it("$1ff8 pages out after opcode fetch", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.automapOff1ff8 = true;
    d.port0xe3Value = 0x00;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    d.rstTraps[4].onlyWithRom3 = false;
    m.pc = 0x0020;
    m.executeCpuCycle();

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.pc = 0x1ff8;
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(divMmcRomSignature[0]);
    expect(addr1Before).toBe(divMmcRomSignature[1]);
    expect(addr5Before).toBe(divMmcRomSignature[5]);
    expect(m.opCode).toBe(divMmcRom_1ff8);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });

  it("$1ff8 pages out (enabled, delayed)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.divMmcDevice;
    const memDevice = m.memoryDevice;
    d.enableAutomap = true;
    d.port0xe3Value = 0x00;
    d.automapOff1ff8 = false;
    d.rstTraps[4].enabled = true;
    d.rstTraps[4].instantMapping = true;
    d.rstTraps[4].onlyWithRom3 = false;
    m.pc = 0x0020;
    m.executeCpuCycle();

    // --- Act
    const addr0Before = memDevice.readMemory(0x0000);
    const addr1Before = memDevice.readMemory(0x0001);
    const addr5Before = memDevice.readMemory(0x0005);
    m.pc = 0x1ff8;
    m.executeCpuCycle();
    const addr0After = memDevice.readMemory(0x0000);
    const addr1After = memDevice.readMemory(0x0001);
    const addr5After = memDevice.readMemory(0x0005);

    // --- Assert
    expect(addr0Before).toBe(divMmcRomSignature[0]);
    expect(addr1Before).toBe(divMmcRomSignature[1]);
    expect(addr5Before).toBe(divMmcRomSignature[5]);
    expect(m.opCode).toBe(nextRom0_1ff8);
    expect(addr0After).toBe(nextRom0Signature0[0]);
    expect(addr1After).toBe(nextRom0Signature0[1]);
    expect(addr5After).toBe(nextRom0Signature0[5]);
  });
});
