import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { Layer2Resolution } from "@emu/machines/zxNext/Layer2Device";
import { JoystickMode } from "@emu/machines/zxNext/JoystickDevice";

describe("Next - NextRegDevice", function () {
  it("Hard reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.nextRegDevice;

    // --- Act
    d.hardReset();

    // --- Assert
    expect(d.directGetRegValue(0x00)).toBe(0x08);
    expect(d.directGetRegValue(0x01)).toBe(0x32);
    expect(d.directGetRegValue(0x02)).toBe(0x02);
    expect(d.directGetRegValue(0x03)).toBe(0x03);
    expect(d.directGetRegValue(0x04)).toBe(0x03);
    expect(d.directGetRegValue(0x05)).toBe(0x01);
    expect(d.directGetRegValue(0x06)).toBe(0x00);
    expect(d.directGetRegValue(0x07)).toBe(0x00);
    expect(d.directGetRegValue(0x08)).toBe(0x1a);
    expect(d.directGetRegValue(0x09)).toBe(0x00);
    expect(d.directGetRegValue(0x0a)).toBe(0x01);
    expect(d.directGetRegValue(0x0b)).toBe(0x01);
    expect(d.directGetRegValue(0x0e)).toBe(0x00);
    expect(d.directGetRegValue(0x0f)).toBe(0x02);
    expect(d.directGetRegValue(0x10)).toBe(0xff);
    expect(d.directGetRegValue(0x11)).toBe(0x00);
    expect(d.directGetRegValue(0x12)).toBe(0x08);
    expect(d.directGetRegValue(0x13)).toBe(0x0b);
    expect(d.directGetRegValue(0x14)).toBe(0xe3);
    expect(d.directGetRegValue(0x15)).toBe(0x00);
    expect(d.directGetRegValue(0x16)).toBe(0x00);
    expect(d.directGetRegValue(0x17)).toBe(0x00);
    expect(d.directGetRegValue(0x18)).toBe(0x00);
    expect(d.directGetRegValue(0x19)).toBe(0x00);
    expect(d.directGetRegValue(0x1a)).toBe(0x00);
    expect(d.directGetRegValue(0x1b)).toBe(0x00);
    expect(d.directGetRegValue(0x1c)).toBe(0x00);
    expect(d.directGetRegValue(0x1e)).toBe(0x00);
    expect(d.directGetRegValue(0x1f)).toBe(0x00);
    expect(d.directGetRegValue(0x20)).toBe(0x00);
    expect(d.directGetRegValue(0x22)).toBe(0x00);
    expect(d.directGetRegValue(0x23)).toBe(0x00);
    expect(d.directGetRegValue(0x24)).toBe(0x00);
    expect(d.directGetRegValue(0x26)).toBe(0x00);
    expect(d.directGetRegValue(0x27)).toBe(0x00);
    expect(d.directGetRegValue(0x28)).toBe(0x00);
    expect(d.directGetRegValue(0x29)).toBe(0xff);
    expect(d.directGetRegValue(0x2a)).toBe(0x00);
    expect(d.directGetRegValue(0x2b)).toBe(0x00);
    expect(d.directGetRegValue(0x2c)).toBe(0x00);
    expect(d.directGetRegValue(0x2d)).toBe(0x00);
    expect(d.directGetRegValue(0x2e)).toBe(0x00);
    expect(d.directGetRegValue(0x2f)).toBe(0x00);
    expect(d.directGetRegValue(0x30)).toBe(0x00);
    expect(d.directGetRegValue(0x31)).toBe(0x00);
    expect(d.directGetRegValue(0x32)).toBe(0x00);
    expect(d.directGetRegValue(0x33)).toBe(0x00);
    expect(d.directGetRegValue(0x34)).toBe(0xff);
    expect(d.directGetRegValue(0x35)).toBe(0xff);
    expect(d.directGetRegValue(0x36)).toBe(0xff);
    expect(d.directGetRegValue(0x37)).toBe(0xff);
    expect(d.directGetRegValue(0x38)).toBe(0xff);
    expect(d.directGetRegValue(0x39)).toBe(0xff);
    expect(d.directGetRegValue(0x40)).toBe(0x00);
    expect(d.directGetRegValue(0x41)).toBe(0x00);
    expect(d.directGetRegValue(0x42)).toBe(0x0f);
    expect(d.directGetRegValue(0x43)).toBe(0x00);
    expect(d.directGetRegValue(0x44)).toBe(0x00);
    expect(d.directGetRegValue(0x4a)).toBe(0x00);
    expect(d.directGetRegValue(0x4b)).toBe(0xe3);
    expect(d.directGetRegValue(0x4c)).toBe(0x0f);
    expect(d.directGetRegValue(0x50)).toBe(0xff);
    expect(d.directGetRegValue(0x51)).toBe(0xff);
    expect(d.directGetRegValue(0x52)).toBe(0x0a);
    expect(d.directGetRegValue(0x53)).toBe(0x0b);
    expect(d.directGetRegValue(0x54)).toBe(0x04);
    expect(d.directGetRegValue(0x55)).toBe(0x05);
    expect(d.directGetRegValue(0x56)).toBe(0x00);
    expect(d.directGetRegValue(0x57)).toBe(0x01);
    expect(d.directGetRegValue(0x60)).toBe(0x01);
    expect(d.directGetRegValue(0x61)).toBe(0x00);
    expect(d.directGetRegValue(0x62)).toBe(0x00);
    expect(d.directGetRegValue(0x63)).toBe(0x00);
    expect(d.directGetRegValue(0x64)).toBe(0xff);
    expect(d.directGetRegValue(0x68)).toBe(0x00);
    expect(d.directGetRegValue(0x69)).toBe(0x00);
    expect(d.directGetRegValue(0x6a)).toBe(0x00);
    expect(d.directGetRegValue(0x6b)).toBe(0x00);
    expect(d.directGetRegValue(0x6c)).toBe(0x00);
    expect(d.directGetRegValue(0x6e)).toBe(0x00);
    expect(d.directGetRegValue(0x6f)).toBe(0x00);
    expect(d.directGetRegValue(0x70)).toBe(0x00);
    expect(d.directGetRegValue(0x71)).toBe(0x00);
    expect(d.directGetRegValue(0x75)).toBe(0xff);
    expect(d.directGetRegValue(0x76)).toBe(0xff);
    expect(d.directGetRegValue(0x77)).toBe(0xff);
    expect(d.directGetRegValue(0x78)).toBe(0xff);
    expect(d.directGetRegValue(0x79)).toBe(0xff);
    expect(d.directGetRegValue(0x7f)).toBe(0xff);
    expect(d.directGetRegValue(0x80)).toBe(0xff);
    expect(d.directGetRegValue(0x81)).toBe(0x00);
    expect(d.directGetRegValue(0x82)).toBe(0xff);
    expect(d.directGetRegValue(0x83)).toBe(0xff);
    expect(d.directGetRegValue(0x84)).toBe(0xff);
    expect(d.directGetRegValue(0x85)).toBe(0x00);
    expect(d.directGetRegValue(0x86)).toBe(0xff);
    expect(d.directGetRegValue(0x87)).toBe(0xff);
    expect(d.directGetRegValue(0x88)).toBe(0xff);
    expect(d.directGetRegValue(0x89)).toBe(0x00);
    expect(d.directGetRegValue(0x8a)).toBe(0xff);
    expect(d.directGetRegValue(0x8c)).toBe(0x00);
    expect(d.directGetRegValue(0x8e)).toBe(0x08);
    expect(d.directGetRegValue(0x8f)).toBe(0x00);
    expect(d.directGetRegValue(0x90)).toBe(0xff);
    expect(d.directGetRegValue(0x91)).toBe(0xff);
    expect(d.directGetRegValue(0x92)).toBe(0xff);
    expect(d.directGetRegValue(0x98)).toBe(0xff);
    expect(d.directGetRegValue(0x99)).toBe(0xff);
    expect(d.directGetRegValue(0x9a)).toBe(0xff);
    expect(d.directGetRegValue(0x9b)).toBe(0x00);
    expect(d.directGetRegValue(0xa0)).toBe(0xff);
    expect(d.directGetRegValue(0xa2)).toBe(0x02);
    expect(d.directGetRegValue(0xa8)).toBe(0x00);
    expect(d.directGetRegValue(0xa9)).toBe(0x05);
    expect(d.directGetRegValue(0xb8)).toBe(0x83);
    expect(d.directGetRegValue(0xb9)).toBe(0x01);
    expect(d.directGetRegValue(0xba)).toBe(0x00);
    expect(d.directGetRegValue(0xbb)).toBe(0xcd);
    expect(d.directGetRegValue(0xc0)).toBe(0x00);
    expect(d.directGetRegValue(0xc2)).toBe(0x00);
    expect(d.directGetRegValue(0xc3)).toBe(0x00);
    expect(d.directGetRegValue(0xc4)).toBe(0x01);
    expect(d.directGetRegValue(0xc5)).toBe(0x00);
    expect(d.directGetRegValue(0xc6)).toBe(0x00);
    expect(d.directGetRegValue(0xc7)).toBe(0x00);
    expect(d.directGetRegValue(0xc8)).toBe(0x00);
    expect(d.directGetRegValue(0xc9)).toBe(0x00);
    expect(d.directGetRegValue(0xca)).toBe(0x00);
    expect(d.directGetRegValue(0xcb)).toBe(0x00);
    expect(d.directGetRegValue(0xcc)).toBe(0x00);
    expect(d.directGetRegValue(0xcd)).toBe(0x00);
    expect(d.directGetRegValue(0xce)).toBe(0x00);
    expect(d.directGetRegValue(0xcf)).toBe(0x00);
    expect(d.directGetRegValue(0xd8)).toBe(0x00);
    expect(d.directGetRegValue(0xd9)).toBe(0xff);
    expect(d.directGetRegValue(0xda)).toBe(0x00);
    expect(d.directGetRegValue(0xf0)).toBe(0xff);
    expect(d.directGetRegValue(0xf8)).toBe(0xff);
    expect(d.directGetRegValue(0xf9)).toBe(0xff);
    expect(d.directGetRegValue(0xfa)).toBe(0xff);
  });

  it("Hard reset & soft reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.nextRegDevice;

    // --- Act
    d.hardReset();
    d.reset();

    // --- Assert
    expect(d.directGetRegValue(0x00)).toBe(0x08);
    expect(d.directGetRegValue(0x01)).toBe(0x32);
    expect(d.directGetRegValue(0x02)).toBe(0x01);
    expect(d.directGetRegValue(0x03)).toBe(0x03);
    expect(d.directGetRegValue(0x04)).toBe(0x03);
    expect(d.directGetRegValue(0x05)).toBe(0x01);
    expect(d.directGetRegValue(0x06)).toBe(0xa0);
    expect(d.directGetRegValue(0x07)).toBe(0x00);
    expect(d.directGetRegValue(0x08)).toBe(0x1a);
    expect(d.directGetRegValue(0x09)).toBe(0x00);
    expect(d.directGetRegValue(0x0a)).toBe(0x01);
    expect(d.directGetRegValue(0x0b)).toBe(0x01);
    expect(d.directGetRegValue(0x0e)).toBe(0x00);
    expect(d.directGetRegValue(0x0f)).toBe(0x02);
    expect(d.directGetRegValue(0x10)).toBe(0xff);
    expect(d.directGetRegValue(0x11)).toBe(0x00);
    expect(d.directGetRegValue(0x12)).toBe(0x08);
    expect(d.directGetRegValue(0x13)).toBe(0x0b);
    expect(d.directGetRegValue(0x14)).toBe(0xe3);
    expect(d.directGetRegValue(0x15)).toBe(0x00);
    expect(d.directGetRegValue(0x16)).toBe(0x00);
    expect(d.directGetRegValue(0x17)).toBe(0x00);
    expect(d.directGetRegValue(0x18)).toBe(0x00);
    expect(d.directGetRegValue(0x19)).toBe(0x00);
    expect(d.directGetRegValue(0x1a)).toBe(0x00);
    expect(d.directGetRegValue(0x1b)).toBe(0x00);
    expect(d.directGetRegValue(0x1c)).toBe(0x00);
    expect(d.directGetRegValue(0x1e)).toBe(0x00);
    expect(d.directGetRegValue(0x1f)).toBe(0x00);
    expect(d.directGetRegValue(0x20)).toBe(0x00);
    expect(d.directGetRegValue(0x22)).toBe(0x00);
    expect(d.directGetRegValue(0x23)).toBe(0x00);
    expect(d.directGetRegValue(0x24)).toBe(0x00);
    expect(d.directGetRegValue(0x26)).toBe(0x00);
    expect(d.directGetRegValue(0x27)).toBe(0x00);
    expect(d.directGetRegValue(0x28)).toBe(0x00);
    expect(d.directGetRegValue(0x29)).toBe(0xff);
    expect(d.directGetRegValue(0x2a)).toBe(0x00);
    expect(d.directGetRegValue(0x2b)).toBe(0x00);
    expect(d.directGetRegValue(0x2c)).toBe(0x00);
    expect(d.directGetRegValue(0x2d)).toBe(0x00);
    expect(d.directGetRegValue(0x2e)).toBe(0x00);
    expect(d.directGetRegValue(0x2f)).toBe(0x00);
    expect(d.directGetRegValue(0x30)).toBe(0x00);
    expect(d.directGetRegValue(0x31)).toBe(0x00);
    expect(d.directGetRegValue(0x32)).toBe(0x00);
    expect(d.directGetRegValue(0x33)).toBe(0x00);
    expect(d.directGetRegValue(0x34)).toBe(0xff);
    expect(d.directGetRegValue(0x35)).toBe(0xff);
    expect(d.directGetRegValue(0x36)).toBe(0xff);
    expect(d.directGetRegValue(0x37)).toBe(0xff);
    expect(d.directGetRegValue(0x38)).toBe(0xff);
    expect(d.directGetRegValue(0x39)).toBe(0xff);
    expect(d.directGetRegValue(0x40)).toBe(0x00);
    expect(d.directGetRegValue(0x41)).toBe(0x00);
    expect(d.directGetRegValue(0x42)).toBe(0x0f);
    expect(d.directGetRegValue(0x43)).toBe(0x00);
    expect(d.directGetRegValue(0x44)).toBe(0x00);
    expect(d.directGetRegValue(0x4a)).toBe(0x00);
    expect(d.directGetRegValue(0x4b)).toBe(0xe3);
    expect(d.directGetRegValue(0x4c)).toBe(0x0f);
    expect(d.directGetRegValue(0x50)).toBe(0xff);
    expect(d.directGetRegValue(0x51)).toBe(0xff);
    expect(d.directGetRegValue(0x52)).toBe(0x0a);
    expect(d.directGetRegValue(0x53)).toBe(0x0b);
    expect(d.directGetRegValue(0x54)).toBe(0x04);
    expect(d.directGetRegValue(0x55)).toBe(0x05);
    expect(d.directGetRegValue(0x56)).toBe(0x00);
    expect(d.directGetRegValue(0x57)).toBe(0x01);
    expect(d.directGetRegValue(0x60)).toBe(0x01);
    expect(d.directGetRegValue(0x61)).toBe(0x00);
    expect(d.directGetRegValue(0x62)).toBe(0x00);
    expect(d.directGetRegValue(0x63)).toBe(0x00);
    expect(d.directGetRegValue(0x64)).toBe(0xff);
    expect(d.directGetRegValue(0x68)).toBe(0x00);
    expect(d.directGetRegValue(0x69)).toBe(0x00);
    expect(d.directGetRegValue(0x6a)).toBe(0x00);
    expect(d.directGetRegValue(0x6b)).toBe(0x00);
    expect(d.directGetRegValue(0x6c)).toBe(0x00);
    expect(d.directGetRegValue(0x6e)).toBe(0x00);
    expect(d.directGetRegValue(0x6f)).toBe(0x00);
    expect(d.directGetRegValue(0x70)).toBe(0x00);
    expect(d.directGetRegValue(0x71)).toBe(0x00);
    expect(d.directGetRegValue(0x75)).toBe(0xff);
    expect(d.directGetRegValue(0x76)).toBe(0xff);
    expect(d.directGetRegValue(0x77)).toBe(0xff);
    expect(d.directGetRegValue(0x78)).toBe(0xff);
    expect(d.directGetRegValue(0x79)).toBe(0xff);
    expect(d.directGetRegValue(0x7f)).toBe(0xff);
    expect(d.directGetRegValue(0x80)).toBe(0xff);
    expect(d.directGetRegValue(0x81)).toBe(0x00);
    expect(d.directGetRegValue(0x82)).toBe(0xff);
    expect(d.directGetRegValue(0x83)).toBe(0xff);
    expect(d.directGetRegValue(0x84)).toBe(0xff);
    expect(d.directGetRegValue(0x85)).toBe(0x00);
    expect(d.directGetRegValue(0x86)).toBe(0xff);
    expect(d.directGetRegValue(0x87)).toBe(0xff);
    expect(d.directGetRegValue(0x88)).toBe(0xff);
    expect(d.directGetRegValue(0x89)).toBe(0x00);
    expect(d.directGetRegValue(0x8a)).toBe(0xff);
    expect(d.directGetRegValue(0x8c)).toBe(0x00);
    expect(d.directGetRegValue(0x8e)).toBe(0x08);
    expect(d.directGetRegValue(0x8f)).toBe(0x00);
    expect(d.directGetRegValue(0x90)).toBe(0xff);
    expect(d.directGetRegValue(0x91)).toBe(0xff);
    expect(d.directGetRegValue(0x92)).toBe(0xff);
    expect(d.directGetRegValue(0x98)).toBe(0xff);
    expect(d.directGetRegValue(0x99)).toBe(0xff);
    expect(d.directGetRegValue(0x9a)).toBe(0xff);
    expect(d.directGetRegValue(0x9b)).toBe(0x00);
    expect(d.directGetRegValue(0xa0)).toBe(0xff);
    expect(d.directGetRegValue(0xa2)).toBe(0x02);
    expect(d.directGetRegValue(0xa8)).toBe(0x00);
    expect(d.directGetRegValue(0xa9)).toBe(0x05);
    expect(d.directGetRegValue(0xb8)).toBe(0x83);
    expect(d.directGetRegValue(0xb9)).toBe(0x01);
    expect(d.directGetRegValue(0xba)).toBe(0x00);
    expect(d.directGetRegValue(0xbb)).toBe(0xcd);
    expect(d.directGetRegValue(0xc0)).toBe(0x00);
    expect(d.directGetRegValue(0xc2)).toBe(0x00);
    expect(d.directGetRegValue(0xc3)).toBe(0x00);
    expect(d.directGetRegValue(0xc4)).toBe(0x01);
    expect(d.directGetRegValue(0xc5)).toBe(0x00);
    expect(d.directGetRegValue(0xc6)).toBe(0x00);
    expect(d.directGetRegValue(0xc7)).toBe(0x00);
    expect(d.directGetRegValue(0xc8)).toBe(0x00);
    expect(d.directGetRegValue(0xc9)).toBe(0x00);
    expect(d.directGetRegValue(0xca)).toBe(0x00);
    expect(d.directGetRegValue(0xcb)).toBe(0x00);
    expect(d.directGetRegValue(0xcc)).toBe(0x00);
    expect(d.directGetRegValue(0xcd)).toBe(0x00);
    expect(d.directGetRegValue(0xce)).toBe(0x00);
    expect(d.directGetRegValue(0xcf)).toBe(0x00);
    expect(d.directGetRegValue(0xd8)).toBe(0x00);
    expect(d.directGetRegValue(0xd9)).toBe(0xff);
    expect(d.directGetRegValue(0xda)).toBe(0x00);
    expect(d.directGetRegValue(0xf0)).toBe(0xff);
    expect(d.directGetRegValue(0xf8)).toBe(0xff);
    expect(d.directGetRegValue(0xf9)).toBe(0xff);
    expect(d.directGetRegValue(0xfa)).toBe(0xff);
  });

  it("Soft reset sets reg $80", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.nextRegDevice;
    d.hardReset();
    d.directSetRegValue(0x80, 0x05);

    // --- Act
    d.reset();
    const value = readNextReg(m, 0x80);

    // --- Assert
    expect(value).toBe(0x55);
  });

  it("Soft reset sets reg $8c", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.nextRegDevice;
    d.hardReset();
    d.directSetRegValue(0x8c, 0x05);

    // --- Act
    d.reset();
    const value = readNextReg(m, 0x8c);

    // --- Assert
    expect(value).toBe(0x55);
  });

  it("Reg $00 read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x00);

    // --- Assert
    expect(value).toBe(0x08);
  });

  it("Reg $00 cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x00, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x00);
    expect(value).toBe(0x08);
  });

  it("Reg $01 read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x01);

    // --- Assert
    expect(value).toBe(0x32);
  });

  it("Reg $01 cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x01, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x01);
    expect(value).toBe(0x32);
  });

  it("Reg $02 busResetRequested #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x02, 0x80);

    // --- Assert
    const value = readNextReg(m, 0x02);
    expect(value).toBe(0x82);
    expect(intDevice.busResetRequested).toBe(true);
    expect(intDevice.mfNmiByIoTrap).toBe(false);
    expect(intDevice.mfNmiByNextReg).toBe(false);
    expect(intDevice.divMccNmiBtNextReg).toBe(false);
    expect(intDevice.lastWasHardReset).toBe(true);
    expect(intDevice.lastWasSoftReset).toBe(false);
  });

  it("Reg $02 busResetRequested #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.lastWasHardReset = false;

    // --- Act
    writeNextReg(m, 0x02, 0xff);

    // --- Assert
    const value = readNextReg(m, 0x02);
    expect(value).toBe(0x80);
    expect(intDevice.busResetRequested).toBe(true);
    expect(intDevice.mfNmiByIoTrap).toBe(false);
    expect(intDevice.mfNmiByNextReg).toBe(false);
    expect(intDevice.divMccNmiBtNextReg).toBe(false);
    expect(intDevice.lastWasHardReset).toBe(false);
    expect(intDevice.lastWasSoftReset).toBe(false);
  });

  it("Reg $02 busResetRequested #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x02, 0x80);

    // --- Assert
    const value = readNextReg(m, 0x02);
    expect(value).toBe(0x82);
    expect(intDevice.busResetRequested).toBe(true);
    expect(intDevice.mfNmiByIoTrap).toBe(false);
    expect(intDevice.mfNmiByNextReg).toBe(false);
    expect(intDevice.divMccNmiBtNextReg).toBe(false);
    expect(intDevice.lastWasHardReset).toBe(true);
    expect(intDevice.lastWasSoftReset).toBe(false);
  });

  it("Reg $03 palette SecondWrite read #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x03);

    // --- Assert
    expect(value & 0x80).toBe(0x00);
  });

  it("Reg $03 set config mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nextDev = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x03, 0x07);

    // --- Assert
    expect(nextDev.configMode).toBe(true);
  });

  it("Reg $03 clear config mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nextDev = m.nextRegDevice;
    writeNextReg(m, 0x03, 0x07);

    // --- Act
    for (let i = 1; i <= 6; i++) {
      writeNextReg(m, 0x03, i);
      expect(nextDev.configMode).toBe(false);
    }
  });

  it("Reg $03 keep config mode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nextDev = m.nextRegDevice;
    writeNextReg(m, 0x03, 0x00);

    // --- Act
    writeNextReg(m, 0x03, 0x00);

    // --- Assert
    expect(nextDev.configMode).toBe(false);
  });

  it("Reg $03 keep config mode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nextDev = m.nextRegDevice;
    writeNextReg(m, 0x03, 0x07);

    // --- Act
    writeNextReg(m, 0x03, 0x00);

    // --- Assert
    expect(nextDev.configMode).toBe(true);
  });

  it("Reg $03 keep userLockDisplayTime #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.userLockOnDisplayTiming = true;

    // --- Act
    writeNextReg(m, 0x03, 0x00);

    // --- Assert
    expect(scrDevice.userLockOnDisplayTiming).toBe(true);
  });

  it("Reg $03 keep userLockDisplayTime #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.userLockOnDisplayTiming = false;

    // --- Act
    writeNextReg(m, 0x03, 0x00);

    // --- Assert
    expect(scrDevice.userLockOnDisplayTiming).toBe(false);
  });

  it("Reg $03 toggles userLockDisplayTime #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.userLockOnDisplayTiming = true;

    // --- Act
    writeNextReg(m, 0x03, 0x08);

    // --- Assert
    expect(scrDevice.userLockOnDisplayTiming).toBe(false);
  });

  it("Reg $03 toggles userLockDisplayTime #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.userLockOnDisplayTiming = false;

    // --- Act
    writeNextReg(m, 0x03, 0x08);

    // --- Assert
    expect(scrDevice.userLockOnDisplayTiming).toBe(true);
  });

  it("Reg $03 keeps machine type when not in config mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    m.nextRegDevice.configMode = false;

    // --- Act
    for (let i = 0; i < 8; i++) {
      writeNextReg(m, 0x03, i);
    }

    // --- Assert
    expect(scrDevice.machineType).toBe(0x03);
  });

  it("Reg $03 set machine type in config mode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    m.nextRegDevice.configMode = true;

    // --- Act
    writeNextReg(m, 0x03, 0x01);

    // --- Assert
    expect(scrDevice.machineType).toBe(0x01);
  });

  it("Reg $03 set machine type in config mode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    m.nextRegDevice.configMode = true;

    // --- Act
    writeNextReg(m, 0x03, 0x02);

    // --- Assert
    expect(scrDevice.machineType).toBe(0x02);
  });

  it("Reg $03 set machine type in config mode #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    m.nextRegDevice.configMode = true;

    // --- Act
    writeNextReg(m, 0x03, 0x03);

    // --- Assert
    expect(scrDevice.machineType).toBe(0x03);
  });

  it("Reg $03 set machine typr in config mode #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    m.nextRegDevice.configMode = true;

    // --- Act
    writeNextReg(m, 0x03, 0x04);

    // --- Assert
    expect(scrDevice.machineType).toBe(0x04);
  });

  it("Reg $03 ignores invalid machine type in config mode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    m.nextRegDevice.configMode = true;

    // --- Act
    writeNextReg(m, 0x03, 0x05);

    // --- Assert
    expect(scrDevice.machineType).toBe(0x03);
  });

  it("Reg $03 ignores invalid machine type in config mode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    m.nextRegDevice.configMode = true;

    // --- Act
    writeNextReg(m, 0x03, 0x06);

    // --- Assert
    expect(scrDevice.machineType).toBe(0x03);
  });

  it("Reg $03 keeps displayTiming with no changes allowed", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.displayTiming = 0x00;
    m.nextRegDevice.configMode = false;

    // --- Act
    for (let i = 0; i < 8; i++) {
      writeNextReg(m, 0x03, i << 4);
      expect(scrDevice.displayTiming).toBe(0x00);
    }
  });

  it("Reg $03 keeps displayTiming with userLockDisplayTiming", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.displayTiming = 0x00;
    scrDevice.userLockOnDisplayTiming = true;
    m.nextRegDevice.configMode = false;

    // --- Act
    for (let i = 0; i < 8; i++) {
      writeNextReg(m, 0x03, 0x80 | (i << 4));
      expect(scrDevice.displayTiming).toBe(0x00);
    }
  });

  it("Reg $03 keeps displayTiming with no userLockDisplayTiming and Bit 3 set to 1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.displayTiming = 0x00;
    scrDevice.userLockOnDisplayTiming = false;
    m.nextRegDevice.configMode = false;

    // --- Act
    for (let i = 0; i < 8; i++) {
      writeNextReg(m, 0x03, 0x80 | (i << 4) | 0x08);
      expect(scrDevice.displayTiming).toBe(0x00);
    }
  });

  const displayTimingCases = [
    [0x80, 0x01],
    [0x90, 0x01],
    [0xa0, 0x02],
    [0xb0, 0x03],
    [0xc0, 0x04],
    [0xd0, 0x03],
    [0xe0, 0x03],
    [0xf0, 0x03]
  ];

  displayTimingCases.forEach((tc, idx) => {
    it(`Reg $03 changes displayTiming #${idx + 1}`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.screenDevice;
      scrDevice.displayTiming = 0x00;
      scrDevice.userLockOnDisplayTiming = false;
      m.nextRegDevice.configMode = false;

      // --- Act
      writeNextReg(m, 0x03, tc[0]);
      expect(scrDevice.displayTiming).toBe(tc[1]);
    });
  });

  it("Reg $04 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x04, 0x2d);

    // --- Assert
    expect(m.memoryDevice.configRomRamBank).toBe(0x2d);
  });

  it("Reg $04 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x04, 0xad);

    // --- Assert
    expect(m.memoryDevice.configRomRamBank).toBe(0x2d);
  });

  it("Reg $04 read #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x04);

    // --- Assert
    expect(value).toBe(0xff);
  });

  it("Reg $04 read #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    readNextReg(m, 0x56);

    // --- Act
    const value = readNextReg(m, 0x04);

    // --- Assert
    expect(value).toBe(0x00);
  });

  const joystick1Modes = [
    { value: 0x00, mode: JoystickMode.Sinclair2 },
    { value: 0x40, mode: JoystickMode.Kempston1 },
    { value: 0x80, mode: JoystickMode.Cursor },
    { value: 0xc0, mode: JoystickMode.Sinclair1 },
    { value: 0x08, mode: JoystickMode.Kempston2 },
    { value: 0x48, mode: JoystickMode.MD1 },
    { value: 0x88, mode: JoystickMode.MD2 },
    { value: 0xc8, mode: JoystickMode.UserDefined }
  ];
  joystick1Modes.forEach((jm) => {
    it(`Reg $05 Joystick 1 mode ${jm.value}`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const jsDevice = m.joystickDevice;

      // --- Act
      writeNextReg(m, 0x05, jm.value);

      // --- Assert
      expect(jsDevice.joystick1Mode).toBe(jm.mode);
    });
  });

  const joystick2Modes = [
    { value: 0x00, mode: JoystickMode.Sinclair2 },
    { value: 0x10, mode: JoystickMode.Kempston1 },
    { value: 0x20, mode: JoystickMode.Cursor },
    { value: 0x30, mode: JoystickMode.Sinclair1 },
    { value: 0x02, mode: JoystickMode.Kempston2 },
    { value: 0x12, mode: JoystickMode.MD1 },
    { value: 0x22, mode: JoystickMode.MD2 },
    { value: 0x32, mode: JoystickMode.UserDefined }
  ];
  joystick2Modes.forEach((jm) => {
    it(`Reg $05 Joystick2 mode ${jm.value}`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const jsDevice = m.joystickDevice;

      // --- Act
      writeNextReg(m, 0x05, jm.value);

      // --- Assert
      expect(jsDevice.joystick2Mode).toBe(jm.mode);
    });
  });

  it("Reg $05 60 Hz mode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;

    // --- Act
    writeNextReg(m, 0x05, 0x00);

    // --- Assert
    expect(scrDevice.hz60Mode).toBe(false);
  });

  it("Reg $05 60 Hz mode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;

    // --- Act
    writeNextReg(m, 0x05, 0x04);

    // --- Assert
    expect(scrDevice.hz60Mode).toBe(true);
  });

  it("Reg $05 scandoubler #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;

    // --- Act
    writeNextReg(m, 0x05, 0x00);

    // --- Assert
    expect(scrDevice.scanDoublerEnabled).toBe(false);
  });

  it("Reg $05 scandoubler #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;

    // --- Act
    writeNextReg(m, 0x05, 0x01);

    // --- Assert
    expect(scrDevice.scanDoublerEnabled).toBe(true);
  });

  it("Reg $06 hotkeyCpuSpeedEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x80);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(true);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 beepOnlyToInternalSpeaker", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x40);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(true);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 hotkey50_60HzEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x20);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(true);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 enableDivMmcNmiByDriveButton", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x10);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(true);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 enableMultifaceNmiByM1Button", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x08);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(true);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 ps2Mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x04);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(true);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 psgMode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x01);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(1);
  });

  it("Reg $06 psgMode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x02);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(2);
  });

  it("Reg $06 all bits", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0xff);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(true);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(true);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(true);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(true);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(true);
    expect(nrDevice.ps2Mode).toBe(true);
    expect(soundDevice.psgMode).toBe(3);
  });

  it("Reg $07 cpu speed #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x07, 0x00);

    // --- Assert
    expect(readNextReg(m, 0x07)).toBe(0x00);
    expect(nrDevice.programmedCpuSpeed).toBe(0x00);
    expect(nrDevice.actualCpuSpeed).toBe(0x00);
  });

  it("Reg $07 cpu speed #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x07, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x07)).toBe(0x11);
    expect(nrDevice.programmedCpuSpeed).toBe(0x01);
    expect(nrDevice.actualCpuSpeed).toBe(0x01);
  });

  it("Reg $07 cpu speed #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x07, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x07)).toBe(0x22);
    expect(nrDevice.programmedCpuSpeed).toBe(0x02);
    expect(nrDevice.actualCpuSpeed).toBe(0x02);
  });

  it("Reg $07 cpu speed #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x07, 0x03);

    // --- Assert
    expect(readNextReg(m, 0x07)).toBe(0x33);
    expect(nrDevice.programmedCpuSpeed).toBe(0x03);
    expect(nrDevice.actualCpuSpeed).toBe(0x03);
  });

  it("Reg $08 unlockPort7ffd", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x80);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(true);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 disableRamPortContention", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x40);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(true);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 ayStereoMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x20);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(true);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 enableInternalSpeaker", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x10);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(true);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 enable8BitDacs", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x08);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(true);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 enablePort0xffTimexVideoModeRead", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x04);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(true);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 enableTurbosound", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x02);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(true);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 implementIssue2Keyboard", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x01);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(true);
  });

  it("Reg $09 ay2Mono", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;

    // --- Act
    writeNextReg(m, 0x09, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x80);
    expect(soundDevice.ay2Mono).toBe(true);
    expect(soundDevice.ay1Mono).toBe(false);
    expect(soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.screenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 ay1Mono", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;

    // --- Act
    writeNextReg(m, 0x09, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x40);
    expect(soundDevice.ay2Mono).toBe(false);
    expect(soundDevice.ay1Mono).toBe(true);
    expect(soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.screenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 ay0Mono", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;

    // --- Act
    writeNextReg(m, 0x09, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x20);
    expect(soundDevice.ay2Mono).toBe(false);
    expect(soundDevice.ay1Mono).toBe(false);
    expect(soundDevice.ay0Mono).toBe(true);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.screenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 spriteIdLockstep", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x09, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x10);
    expect(m.soundDevice.ay2Mono).toBe(false);
    expect(m.soundDevice.ay1Mono).toBe(false);
    expect(m.soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(true);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(m.soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.screenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 resetDivMmcMapramFlag", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x09, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x00);
    expect(m.soundDevice.ay2Mono).toBe(false);
    expect(m.soundDevice.ay1Mono).toBe(false);
    expect(m.soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(true);
    expect(m.soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.screenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 silenceHdmiAudio", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x09, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x04);
    expect(m.soundDevice.ay2Mono).toBe(false);
    expect(m.soundDevice.ay1Mono).toBe(false);
    expect(m.soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(m.soundDevice.silenceHdmiAudio).toBe(true);
    expect(m.screenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 scanlineWeight", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x09, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x02);
    expect(m.soundDevice.ay2Mono).toBe(false);
    expect(m.soundDevice.ay1Mono).toBe(false);
    expect(m.soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(m.soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.screenDevice.scanlineWeight).toBe(2);
  });

  it("Reg $0a multifaceType", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divMmcDevice = m.divMmcDevice;
    const mouseDevice = m.mouseDevice;

    // --- Act
    writeNextReg(m, 0x0a, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x0a)).toBe(0x40);
    expect(divMmcDevice.multifaceType).toBe(0x01);
    expect(divMmcDevice.enableAutomap).toBe(false);
    expect(mouseDevice.swapButtons).toBe(false);
    expect(mouseDevice.dpi).toBe(0x00);
  });

  it("Reg $0a enableAutomap", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divMmcDevice = m.divMmcDevice;
    const mouseDevice = m.mouseDevice;

    // --- Act
    writeNextReg(m, 0x0a, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x0a)).toBe(0x10);
    expect(divMmcDevice.multifaceType).toBe(0x00);
    expect(divMmcDevice.enableAutomap).toBe(true);
    expect(mouseDevice.swapButtons).toBe(false);
    expect(mouseDevice.dpi).toBe(0x00);
  });

  it("Reg $0a swapButtons", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divMmcDevice = m.divMmcDevice;
    const mouseDevice = m.mouseDevice;

    // --- Act
    writeNextReg(m, 0x0a, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x0a)).toBe(0x08);
    expect(divMmcDevice.multifaceType).toBe(0x00);
    expect(divMmcDevice.enableAutomap).toBe(false);
    expect(mouseDevice.swapButtons).toBe(true);
    expect(mouseDevice.dpi).toBe(0x00);
  });

  it("Reg $0a dpi", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divMmcDevice = m.divMmcDevice;
    const mouseDevice = m.mouseDevice;

    // --- Act
    writeNextReg(m, 0x0a, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x0a)).toBe(0x02);
    expect(divMmcDevice.multifaceType).toBe(0x00);
    expect(divMmcDevice.enableAutomap).toBe(false);
    expect(mouseDevice.swapButtons).toBe(false);
    expect(mouseDevice.dpi).toBe(0x02);
  });

  it("Reg $0b ioModeEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const joystickDevice = m.joystickDevice;

    // --- Act
    writeNextReg(m, 0x0b, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x0b)).toBe(0x80);
    expect(joystickDevice.ioModeEnabled).toBe(true);
    expect(joystickDevice.ioMode).toBe(0x00);
    expect(joystickDevice.ioModeParam).toBe(false);
  });

  it("Reg $0b ioMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const joystickDevice = m.joystickDevice;

    // --- Act
    writeNextReg(m, 0x0b, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x0b)).toBe(0x20);
    expect(joystickDevice.ioModeEnabled).toBe(false);
    expect(joystickDevice.ioMode).toBe(0x02);
    expect(joystickDevice.ioModeParam).toBe(false);
  });

  it("Reg $0b ioModeParam", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const joystickDevice = m.joystickDevice;

    // --- Act
    writeNextReg(m, 0x0b, 0x11);

    // --- Assert
    expect(readNextReg(m, 0x0b)).toBe(0x11);
    expect(joystickDevice.ioModeEnabled).toBe(false);
    expect(joystickDevice.ioMode).toBe(0x01);
    expect(joystickDevice.ioModeParam).toBe(true);
  });

  it("Reg $0e read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x0e);

    // --- Assert
    expect(value).toBe(0x00);
  });

  it("Reg $0e cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x0e, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x0e);
    expect(value).toBe(0x00);
  });

  it("Reg $0f read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x0f);

    // --- Assert
    expect(value).toBe(0x02);
  });

  it("Reg $0f cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x0f, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x0f);
    expect(value).toBe(0x02);
  });

  it("Reg $11 videoTimingMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x11, 0x26);

    // --- Assert
    expect(readNextReg(m, 0x11)).toBe(0x06);
    expect(m.screenDevice.videoTimingMode).toBe(0x06);
  });

  it("Reg $12 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x12, 0x03);

    // --- Assert
    expect(layer2Device.activeRamBank).toBe(0x03);
  });

  it("Reg $12 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x12, 0x97);

    // --- Assert
    expect(layer2Device.activeRamBank).toBe(0x17);
  });

  it("Reg $13 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x13, 0x03);

    // --- Assert
    expect(layer2Device.shadowRamBank).toBe(0x03);
  });

  it("Reg $13 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x13, 0x03);

    // --- Assert
    expect(layer2Device.shadowRamBank).toBe(0x03);
  });

  it("Reg $14 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x14, 0xc5);

    // --- Assert
    expect(layer2Device.transparencyColor).toBe(0xc5);
  });

  it("Reg $15 enableLoresMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.screenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x80);

    // --- Assert
    expect(screenDevice.enableLoresMode).toBe(true);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.enableSpriteClipping).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.enableSpritesOverBorder).toBe(false);
    expect(spriteDevice.enableSprites).toBe(false);
  });

  it("Reg $15 sprite0OnTop", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.screenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x40);

    // --- Assert
    expect(screenDevice.enableLoresMode).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(true);
    expect(spriteDevice.enableSpriteClipping).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.enableSpritesOverBorder).toBe(false);
    expect(spriteDevice.enableSprites).toBe(false);
  });

  it("Reg $15 enableSpriteClipping", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.screenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x20);

    // --- Assert
    expect(screenDevice.enableLoresMode).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.enableSpriteClipping).toBe(true);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.enableSpritesOverBorder).toBe(false);
    expect(spriteDevice.enableSprites).toBe(false);
  });

  it("Reg $15 layerPriority", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.screenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x18);

    // --- Assert
    expect(screenDevice.enableLoresMode).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.enableSpriteClipping).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x06);
    expect(spriteDevice.enableSpritesOverBorder).toBe(false);
    expect(spriteDevice.enableSprites).toBe(false);
  });

  it("Reg $15 enableSpritesOverBorder", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.screenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x02);

    // --- Assert
    expect(screenDevice.enableLoresMode).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.enableSpriteClipping).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.enableSpritesOverBorder).toBe(true);
    expect(spriteDevice.enableSprites).toBe(false);
  });

  it("Reg $15 enableSprites", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.screenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x01);

    // --- Assert
    expect(screenDevice.enableLoresMode).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.enableSpriteClipping).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.enableSpritesOverBorder).toBe(false);
    expect(spriteDevice.enableSprites).toBe(true);
  });

  it("Reg $16 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x16, 0x2c);

    // --- Assert
    expect(layer2Device.scrollX).toBe(0x2c);
  });

  it("Reg $17 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x17, 0x2c);

    // --- Assert
    expect(layer2Device.scrollY).toBe(0x2c);
  });

  it("Reg $18 first write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;
    writeNextReg(m, 0x1c, 0x01);

    // --- Act
    writeNextReg(m, 0x18, 0x23);

    // --- Assert
    expect(layer2Device.clipIndex).toBe(0x01);
    expect(layer2Device.clipWindowX1).toBe(0x23);
    expect(layer2Device.clipWindowX2).toBe(0x9f);
    expect(layer2Device.clipWindowY1).toBe(0x00);
    expect(layer2Device.clipWindowY2).toBe(0xff);
  });

  it("Reg $18 second write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;
    writeNextReg(m, 0x1c, 0x01);

    // --- Act
    writeNextReg(m, 0x18, 0x23);
    writeNextReg(m, 0x18, 0x34);

    // --- Assert
    expect(layer2Device.clipIndex).toBe(0x02);
    expect(layer2Device.clipWindowX1).toBe(0x23);
    expect(layer2Device.clipWindowX2).toBe(0x34);
    expect(layer2Device.clipWindowY1).toBe(0x00);
    expect(layer2Device.clipWindowY2).toBe(0xff);
  });

  it("Reg $18 third write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;
    writeNextReg(m, 0x1c, 0x01);

    // --- Act
    writeNextReg(m, 0x18, 0x23);
    writeNextReg(m, 0x18, 0x34);
    writeNextReg(m, 0x18, 0x45);

    // --- Assert
    expect(layer2Device.clipIndex).toBe(0x03);
    expect(layer2Device.clipWindowX1).toBe(0x23);
    expect(layer2Device.clipWindowX2).toBe(0x34);
    expect(layer2Device.clipWindowY1).toBe(0x45);
    expect(layer2Device.clipWindowY2).toBe(0xff);
  });

  it("Reg $18 fourth write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;
    writeNextReg(m, 0x1c, 0x01);

    // --- Act
    writeNextReg(m, 0x18, 0x23);
    writeNextReg(m, 0x18, 0x34);
    writeNextReg(m, 0x18, 0x45);
    writeNextReg(m, 0x18, 0x56);

    // --- Assert
    expect(layer2Device.clipIndex).toBe(0x00);
    expect(layer2Device.clipWindowX1).toBe(0x23);
    expect(layer2Device.clipWindowX2).toBe(0x34);
    expect(layer2Device.clipWindowY1).toBe(0x45);
    expect(layer2Device.clipWindowY2).toBe(0x56);
  });

  it("Reg $1a first write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;
    writeNextReg(m, 0x1c, 0x04);

    // --- Act
    writeNextReg(m, 0x1a, 0x23);

    // --- Assert
    expect(ulaDevice.clipIndex).toBe(0x01);
    expect(ulaDevice.clipWindowX1).toBe(0x23);
    expect(ulaDevice.clipWindowX2).toBe(0xff);
    expect(ulaDevice.clipWindowY1).toBe(0x00);
    expect(ulaDevice.clipWindowY2).toBe(0xbf);
  });

  it("Reg $1a second write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;
    writeNextReg(m, 0x1c, 0x04);

    // --- Act
    writeNextReg(m, 0x1a, 0x23);
    writeNextReg(m, 0x1a, 0x34);

    // --- Assert
    expect(ulaDevice.clipIndex).toBe(0x02);
    expect(ulaDevice.clipWindowX1).toBe(0x23);
    expect(ulaDevice.clipWindowX2).toBe(0x34);
    expect(ulaDevice.clipWindowY1).toBe(0x00);
    expect(ulaDevice.clipWindowY2).toBe(0xbf);
  });

  it("Reg $1a third write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;
    writeNextReg(m, 0x1c, 0x04);

    // --- Act
    writeNextReg(m, 0x1a, 0x23);
    writeNextReg(m, 0x1a, 0x34);
    writeNextReg(m, 0x1a, 0x45);

    // --- Assert
    expect(ulaDevice.clipIndex).toBe(0x03);
    expect(ulaDevice.clipWindowX1).toBe(0x23);
    expect(ulaDevice.clipWindowX2).toBe(0x34);
    expect(ulaDevice.clipWindowY1).toBe(0x45);
    expect(ulaDevice.clipWindowY2).toBe(0xbf);
  });

  it("Reg $1a fourth write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;
    writeNextReg(m, 0x1c, 0x04);

    // --- Act
    writeNextReg(m, 0x1a, 0x23);
    writeNextReg(m, 0x1a, 0x34);
    writeNextReg(m, 0x1a, 0x45);
    writeNextReg(m, 0x1a, 0x56);

    // --- Assert
    expect(ulaDevice.clipIndex).toBe(0x00);
    expect(ulaDevice.clipWindowX1).toBe(0x23);
    expect(ulaDevice.clipWindowX2).toBe(0x34);
    expect(ulaDevice.clipWindowY1).toBe(0x45);
    expect(ulaDevice.clipWindowY2).toBe(0x56);
  });

  it("Reg $1b first write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;
    writeNextReg(m, 0x1c, 0x08);

    // --- Act
    writeNextReg(m, 0x1b, 0x23);

    // --- Assert
    expect(tilemapDevice.clipIndex).toBe(0x01);
    expect(tilemapDevice.clipWindowX1).toBe(0x23);
    expect(tilemapDevice.clipWindowX2).toBe(0x9f);
    expect(tilemapDevice.clipWindowY1).toBe(0x00);
    expect(tilemapDevice.clipWindowY2).toBe(0xff);
  });

  it("Reg $1b second write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;
    writeNextReg(m, 0x1c, 0x08);

    // --- Act
    writeNextReg(m, 0x1b, 0x23);
    writeNextReg(m, 0x1b, 0x34);

    // --- Assert
    expect(tilemapDevice.clipIndex).toBe(0x02);
    expect(tilemapDevice.clipWindowX1).toBe(0x23);
    expect(tilemapDevice.clipWindowX2).toBe(0x34);
    expect(tilemapDevice.clipWindowY1).toBe(0x00);
    expect(tilemapDevice.clipWindowY2).toBe(0xff);
  });

  it("Reg $1b third write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;
    writeNextReg(m, 0x1c, 0x08);

    // --- Act
    writeNextReg(m, 0x1b, 0x23);
    writeNextReg(m, 0x1b, 0x34);
    writeNextReg(m, 0x1b, 0x45);

    // --- Assert
    expect(tilemapDevice.clipIndex).toBe(0x03);
    expect(tilemapDevice.clipWindowX1).toBe(0x23);
    expect(tilemapDevice.clipWindowX2).toBe(0x34);
    expect(tilemapDevice.clipWindowY1).toBe(0x45);
    expect(tilemapDevice.clipWindowY2).toBe(0xff);
  });

  it("Reg $1b fourth write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;
    writeNextReg(m, 0x1c, 0x08);

    // --- Act
    writeNextReg(m, 0x1b, 0x23);
    writeNextReg(m, 0x1b, 0x34);
    writeNextReg(m, 0x1b, 0x45);
    writeNextReg(m, 0x1b, 0x56);

    // --- Assert
    expect(tilemapDevice.clipIndex).toBe(0x00);
    expect(tilemapDevice.clipWindowX1).toBe(0x23);
    expect(tilemapDevice.clipWindowX2).toBe(0x34);
    expect(tilemapDevice.clipWindowY1).toBe(0x45);
    expect(tilemapDevice.clipWindowY2).toBe(0x56);
  });

  it("Reg $1c layer2 clip index reset works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x01);
    writeNextReg(m, 0x1b, 0x23);
    writeNextReg(m, 0x1b, 0x34);
    writeNextReg(m, 0x1b, 0x45);

    // --- Act
    writeNextReg(m, 0x1c, 0x01);

    // --- Assert
    expect(m.layer2Device.clipIndex).toBe(0x00);
  });

  it("Reg $1c sprite clip index reset works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x02);
    writeNextReg(m, 0x19, 0x23);
    writeNextReg(m, 0x19, 0x34);
    writeNextReg(m, 0x19, 0x45);

    // --- Act
    writeNextReg(m, 0x1c, 0x02);

    // --- Assert
    expect(m.spriteDevice.clipIndex).toBe(0x00);
  });

  it("Reg $1c ula clip index reset works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x04);
    writeNextReg(m, 0x1a, 0x23);
    writeNextReg(m, 0x1a, 0x34);
    writeNextReg(m, 0x1a, 0x45);

    // --- Act
    writeNextReg(m, 0x1c, 0x04);

    // --- Assert
    expect(m.ulaDevice.clipIndex).toBe(0x00);
  });

  it("Reg $1c tilemap clip index reset works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x08);
    writeNextReg(m, 0x1b, 0x23);
    writeNextReg(m, 0x1b, 0x34);
    writeNextReg(m, 0x1b, 0x45);

    // --- Act
    writeNextReg(m, 0x1c, 0x08);

    // --- Assert
    expect(m.tilemapDevice.clipIndex).toBe(0x00);
  });

  it("Reg $1c layer2 clip index read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x01);
    writeNextReg(m, 0x18, 0x23);
    writeNextReg(m, 0x18, 0x34);
    writeNextReg(m, 0x18, 0x45);

    // --- Assert
    expect(readNextReg(m, 0x1c) & 0x03).toBe(0x03);
  });

  it("Reg $1c sprite clip index read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x02);
    writeNextReg(m, 0x19, 0x23);
    writeNextReg(m, 0x19, 0x34);
    writeNextReg(m, 0x19, 0x45);

    // --- Assert
    expect(readNextReg(m, 0x1c) & 0x0c).toBe(0x0c);
  });

  it("Reg $1c ula clip index read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x04);
    writeNextReg(m, 0x1a, 0x23);
    writeNextReg(m, 0x1a, 0x34);
    writeNextReg(m, 0x1a, 0x45);

    // --- Assert
    expect(readNextReg(m, 0x1c) & 0x30).toBe(0x30);
  });

  it("Reg $1c tilemap clip index read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x08);
    writeNextReg(m, 0x1b, 0x23);
    writeNextReg(m, 0x1b, 0x34);
    writeNextReg(m, 0x1b, 0x45);

    // --- Assert
    expect(readNextReg(m, 0x1c) & 0xc0).toBe(0xc0);
  });

  it("Reg $1e read #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.activeVideoLine = 0x23;

    // --- Assert
    expect(readNextReg(m, 0x1e)).toBe(0x00);
  });

  it("Reg $1e read #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.activeVideoLine = 0x123;

    // --- Assert
    expect(readNextReg(m, 0x1e)).toBe(0x01);
  });

  it("Reg $1f read #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.activeVideoLine = 0x23;

    // --- Assert
    expect(readNextReg(m, 0x1f)).toBe(0x23);
  });

  it("Reg $1f read #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.screenDevice;
    scrDevice.activeVideoLine = 0x123;

    // --- Assert
    expect(readNextReg(m, 0x1f)).toBe(0x23);
  });

  it("Reg $22 intSignalActive", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x80);
    expect(intDevice.intSignalActive).toBe(true);
    expect(intDevice.ulaInterruptDisabled).toBe(false);
    expect(intDevice.lineInterruptEnabled).toBe(false);
    expect(intDevice.lineInterrupt).toBe(0x00);
  });

  it("Reg $22 ulaInterruptDisabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x04);
    expect(intDevice.intSignalActive).toBe(false);
    expect(intDevice.ulaInterruptDisabled).toBe(true);
    expect(intDevice.lineInterruptEnabled).toBe(false);
    expect(intDevice.lineInterrupt).toBe(0x00);
  });

  it("Reg $22 lineInteeruptEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x02);
    expect(intDevice.intSignalActive).toBe(false);
    expect(intDevice.ulaInterruptDisabled).toBe(false);
    expect(intDevice.lineInterruptEnabled).toBe(true);
    expect(intDevice.lineInterrupt).toBe(0x00);
  });

  it("Reg $22 lineInterruptMsb", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x01);
    expect(intDevice.intSignalActive).toBe(false);
    expect(intDevice.ulaInterruptDisabled).toBe(false);
    expect(intDevice.lineInterruptEnabled).toBe(false);
    expect(intDevice.lineInterrupt).toBe(0x100);
  });

  it("Reg $22 all bit 1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x87);
    expect(intDevice.intSignalActive).toBe(true);
    expect(intDevice.ulaInterruptDisabled).toBe(true);
    expect(intDevice.lineInterruptEnabled).toBe(true);
    expect(intDevice.lineInterrupt).toBe(0x100);
  });

  it("Reg $22 ulaDisableInterrupt alias in $c4 #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    writeNextReg(m, 0xc4, 0x00);

    // --- Act
    writeNextReg(m, 0x22, 0x04);

    // --- Assert
    expect(readNextReg(m, 0xc4)).toBe(0x00);
  });

  it("Reg $22 ulaDisableInterrupt alias in $c4 #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    writeNextReg(m, 0xc4, 0x00);

    // --- Act
    writeNextReg(m, 0x22, 0x00);

    // --- Assert
    expect(readNextReg(m, 0xc4)).toBe(0x01);
  });

  it("Reg $22 lineEnableInterrupt alias in $c4 #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    writeNextReg(m, 0xc4, 0x00);

    // --- Act
    writeNextReg(m, 0x22, 0x06);

    // --- Assert
    expect(readNextReg(m, 0xc4)).toBe(0x02);
  });

  it("Reg $22 lineEnableInterrupt alias in $c4 #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    writeNextReg(m, 0xc4, 0x00);

    // --- Act
    writeNextReg(m, 0x22, 0x02);

    // --- Assert
    expect(readNextReg(m, 0xc4)).toBe(0x03);
  });

  it("Reg $23 read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x23);

    // --- Assert
    expect(value).toBe(0x00);
  });

  it("Reg $23 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x23, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0x23)).toBe(0x5a);
  });

  it("Reg $26 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x26, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0x26)).toBe(0x5a);
    expect(m.ulaDevice.scrollX).toBe(0x5a);
  });

  it("Reg $27 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x27, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0x27)).toBe(0x5a);
    expect(m.ulaDevice.scrollY).toBe(0x5a);
  });

  it("Reg $28 read returns last stored palette value", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x40, 0x20);
    writeNextReg(m, 0x41, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0x28)).toBe(0x5a);
  });

  it("Reg $28 selectKeyJoystick", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x28, 0x80);

    // --- Assert
    expect(m.nextRegDevice.selectKeyJoystick).toBe(true);
  });

  it("Reg $28 ps2KeymapAddressMsb", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x28, 0x01);

    // --- Assert
    expect(m.nextRegDevice.ps2KeymapAddressMsb).toBe(true);
  });

  it("Reg $29 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x29, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0x29)).toBe(0x5a);
    expect(m.nextRegDevice.ps2KeymapAddressLsb).toBe(0x5a);
  });

  it("Reg $2a ps2KeymapDataMsb", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x2a, 0x01);

    // --- Assert
    expect(m.nextRegDevice.ps2KeymapDataMsb).toBe(true);
  });

  it("Reg $2b write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x2b, 0xaa);

    // --- Assert
    expect(readNextReg(m, 0x2b)).toBe(0xaa);
    expect(m.nextRegDevice.ps2KeymapDataLsb).toBe(0xaa);
  });

  it("Reg $2f write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x2b, 0xaa);

    // --- Assert
    expect(readNextReg(m, 0x2b)).toBe(0xaa);
    expect(m.nextRegDevice.ps2KeymapDataLsb).toBe(0xaa);
  });

  it("Reg $2f write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x2f, 0x03);

    // --- Assert
    expect(readNextReg(m, 0x2f)).toBe(0x03);
    expect(m.tilemapDevice.scrollX).toBe(0x300);
  });

  it("Reg $2f write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x2f, 0xfc2);

    // --- Assert
    expect(readNextReg(m, 0x2f)).toBe(0x02);
    expect(m.tilemapDevice.scrollX).toBe(0x200);
  });

  it("Reg $2f write #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x30, 0x5a);

    // --- Act
    writeNextReg(m, 0x2f, 0x03);

    // --- Assert
    expect(readNextReg(m, 0x2f)).toBe(0x03);
    expect(m.tilemapDevice.scrollX).toBe(0x35a);
  });

  it("Reg $30 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x30, 0xb4);

    // --- Assert
    expect(readNextReg(m, 0x30)).toBe(0xb4);
    expect(m.tilemapDevice.scrollX).toBe(0xb4);
  });

  it("Reg $30 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x2f, 0x01);

    // --- Act
    writeNextReg(m, 0x30, 0xb4);

    // --- Assert
    expect(readNextReg(m, 0x30)).toBe(0xb4);
    expect(m.tilemapDevice.scrollX).toBe(0x1b4);
  });

  it("Reg $31 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x31, 0xc5);

    // --- Assert
    expect(readNextReg(m, 0x31)).toBe(0xc5);
    expect(m.tilemapDevice.scrollY).toBe(0xc5);
  });

  it("Reg $32 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x32, 0xa7);

    // --- Assert
    expect(readNextReg(m, 0x32)).toBe(0xa7);
    expect(m.loResDevice.scrollX).toBe(0xa7);
  });

  it("Reg $33 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x33, 0xa7);

    // --- Assert
    expect(readNextReg(m, 0x33)).toBe(0xa7);
    expect(m.loResDevice.scrollY).toBe(0xa7);
  });

  it("Reg $40 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x40, 0x5a);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x5a);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $40 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x40, 0xa5);

    // --- Assert
    expect(pal.paletteIndex).toBe(0xa5);
  });

  it("Reg $42 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x42, 0x3f);

    // --- Assert
    expect(pal.ulaNextByteFormat).toBe(0x3f);
  });

  it("Reg $42 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x42, 0x1f);

    // --- Assert
    expect(pal.ulaNextByteFormat).toBe(0x1f);
  });

  it("Reg $43 disablePaletteWriteAutoInc", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x80);
    expect(pal.disablePaletteWriteAutoInc).toBe(true);
    expect(pal.selectedPalette).toBe(0x00);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 selectedPalette #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x00);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x00);
    expect(pal.getCurrentPalette()).toBe(pal.ulaFirst);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x00);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 selectedPalette #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x10);
    expect(pal.getCurrentPalette()).toBe(pal.layer2First);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x01);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 selectedPalette #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x20);
    expect(pal.getCurrentPalette()).toBe(pal.spriteFirst);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x02);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 selectedPalette #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x30);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x30);
    expect(pal.getCurrentPalette()).toBe(pal.tilemapFirst);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x03);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 selectedPalette #5", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x40);
    expect(pal.getCurrentPalette()).toBe(pal.ulaSecond);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x04);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 selectedPalette #6", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x50);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x50);
    expect(pal.getCurrentPalette()).toBe(pal.layer2Second);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x05);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 selectedPalette #7", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x60);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x60);
    expect(pal.getCurrentPalette()).toBe(pal.spriteSecond);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x06);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 selectedPalette #8", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x70);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x70);
    expect(pal.getCurrentPalette()).toBe(pal.tilemapSecond);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x07);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 secondSpritePalette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x08);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x00);
    expect(pal.secondSpritePalette).toBe(true);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 secondLayer2Palette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x04);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x00);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(true);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 secondUlaPalette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x02);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x00);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(true);
    expect(pal.enableUlaNextMode).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $43 enableUlaNextMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    writeNextReg(m, 0x43, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x43)).toBe(0x01);
    expect(pal.disablePaletteWriteAutoInc).toBe(false);
    expect(pal.selectedPalette).toBe(0x00);
    expect(pal.secondSpritePalette).toBe(false);
    expect(pal.secondLayer2Palette).toBe(false);
    expect(pal.secondUlaPalette).toBe(false);
    expect(pal.enableUlaNextMode).toBe(true);
    expect(pal.secondWrite).toBe(false);
  });

  it("Reg $4a write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x4a, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x4a)).toBe(0xa5);
    expect(m.screenDevice.fallbackColor).toBe(0xa5);
  });

  it("Reg $4b write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x4b, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x4b)).toBe(0xa5);
    expect(m.spriteDevice.transparencyIndex).toBe(0xa5);
  });

  it("Reg $4c write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x4c, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x4c)).toBe(0xa5);
    expect(m.tilemapDevice.transparencyIndex).toBe(0xa5);
  });

  it("Reg $60 first write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x000);

    // --- Act
    writeNextReg(m, 0x60, 0xaa);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x001)).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x001);
  });

  it("Reg $60 second write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x000);
    writeNextReg(m, 0x60, 0xaa);

    // --- Act
    writeNextReg(m, 0x60, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x001)).toBe(0x55);
    expect(m.copperDevice.instructionAddress).toBe(0x002);
  });

  it("Reg $60 address after first write gets to zero", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x7ff);

    // --- Act
    writeNextReg(m, 0x60, 0xaa);

    // --- Assert
    expect(m.copperDevice.readMemory(0x7ff)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x000);
  });

  it("Reg $60 address after second write gets to zero", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x7fe);
    writeNextReg(m, 0x60, 0xaa);

    // --- Act
    writeNextReg(m, 0x60, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x7fe)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x7ff)).toBe(0x55);
    expect(m.copperDevice.instructionAddress).toBe(0x000);
  });

  it("Reg $61 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x62, 0x00);

    // --- Act
    writeNextReg(m, 0x61, 0xbe);

    // --- Assert
    expect(readNextReg(m, 0x61)).toBe(0xbe);
    expect(m.copperDevice.instructionAddress).toBe(0xbe);
  });

  it("Reg $61 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x62, 0x04);

    // --- Act
    writeNextReg(m, 0x61, 0xbe);

    // --- Assert
    expect(readNextReg(m, 0x61)).toBe(0xbe);
    expect(m.copperDevice.instructionAddress).toBe(0x4be);
  });

  it("Reg $62 startMode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x00);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x00);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 startMode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x40);
    expect(m.copperDevice.startMode).toBe(0x01);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 startMode #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x80);
    expect(m.copperDevice.startMode).toBe(0x02);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 startMode #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0xc0);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0xc0);
    expect(m.copperDevice.startMode).toBe(0x03);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 address MSB #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x00);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x00);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 address MSB #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x01);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0100);
  });

  it("Reg $62 address MSB #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x06);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x06);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0600);
  });

  it("Reg $62 address MSB #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x07);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x07);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0700);
  });

  it("Reg $63 first even write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x000);

    // --- Act
    writeNextReg(m, 0x63, 0xaa);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.readMemory(0x001)).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x001);
  });

  it("Reg $63 first even write, second odd write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x000);

    // --- Act
    writeNextReg(m, 0x63, 0xaa);
    writeNextReg(m, 0x63, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x001)).toBe(0x55);
    expect(m.copperDevice.instructionAddress).toBe(0x002);
  });

  it("Reg $63 first odd write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x001);

    // --- Act
    writeNextReg(m, 0x63, 0xaa);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.readMemory(0x001)).toBe(0xaa);
    expect(m.copperDevice.instructionAddress).toBe(0x002);
  });

  it("Reg $63 first odd write, second even", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x001);
    writeNextReg(m, 0x63, 0xaa);

    // --- Act
    writeNextReg(m, 0x63, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.readMemory(0x001)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x002)).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x003);
  });

  it("Reg $63 first odd write, second even, third odd", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x001);
    writeNextReg(m, 0x63, 0xaa);
    writeNextReg(m, 0x63, 0x55);

    // --- Act
    writeNextReg(m, 0x63, 0x23);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.readMemory(0x001)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x002)).toBe(0x55);
    expect(m.copperDevice.readMemory(0x003)).toBe(0x23);
    expect(m.copperDevice.instructionAddress).toBe(0x004);
  });

  it("Reg $63 address gets zero after two writes", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x7fe);

    // --- Act
    writeNextReg(m, 0x63, 0xaa);
    writeNextReg(m, 0x63, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x7fe)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x7ff)).toBe(0x55);
    expect(m.copperDevice.instructionAddress).toBe(0x000);
  });

  it("Reg $64 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x64, 0xbe);

    // --- Assert
    expect(readNextReg(m, 0x64)).toBe(0xbe);
    expect(m.copperDevice.verticalLineOffset).toBe(0xbe);
  });

  it("Reg $68 disableUlaOutput", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;

    // --- Act
    writeNextReg(m, 0x68, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x68)).toBe(0x80);
    expect(ulaDevice.disableUlaOutput).toBe(true);
    expect(ulaDevice.blendingInSluMode).toBe(0x00);
    expect(m.keyboardDevice.cancelExtendedKeyEntries).toBe(false);
    expect(ulaDevice.enableUlaPlus).toBe(false);
    expect(ulaDevice.halfPixelScroll).toBe(false);
    expect(ulaDevice.enableStencilMode).toBe(false);

  });

  it("Reg $68 blendingInSluMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;

    // --- Act
    writeNextReg(m, 0x68, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x68)).toBe(0x40);
    expect(ulaDevice.disableUlaOutput).toBe(false);
    expect(ulaDevice.blendingInSluMode).toBe(0x02);
    expect(m.keyboardDevice.cancelExtendedKeyEntries).toBe(false);
    expect(ulaDevice.enableUlaPlus).toBe(false);
    expect(ulaDevice.halfPixelScroll).toBe(false);
    expect(ulaDevice.enableStencilMode).toBe(false);
  });

  it("Reg $68 cancelExtendedKeyEntries", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;

    // --- Act
    writeNextReg(m, 0x68, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x68)).toBe(0x10);
    expect(ulaDevice.disableUlaOutput).toBe(false);
    expect(ulaDevice.blendingInSluMode).toBe(0x00);
    expect(m.keyboardDevice.cancelExtendedKeyEntries).toBe(true);
    expect(ulaDevice.enableUlaPlus).toBe(false);
    expect(ulaDevice.halfPixelScroll).toBe(false);
    expect(ulaDevice.enableStencilMode).toBe(false);
  });

  it("Reg $68 enableUlaPlus", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;

    // --- Act
    writeNextReg(m, 0x68, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x68)).toBe(0x08);
    expect(ulaDevice.disableUlaOutput).toBe(false);
    expect(ulaDevice.blendingInSluMode).toBe(0x00);
    expect(m.keyboardDevice.cancelExtendedKeyEntries).toBe(false);
    expect(ulaDevice.enableUlaPlus).toBe(true);
    expect(ulaDevice.halfPixelScroll).toBe(false);
    expect(ulaDevice.enableStencilMode).toBe(false);
  });

  it("Reg $68 halfPixelScroll", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;

    // --- Act
    writeNextReg(m, 0x68, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x68)).toBe(0x04);
    expect(ulaDevice.disableUlaOutput).toBe(false);
    expect(ulaDevice.blendingInSluMode).toBe(0x00);
    expect(m.keyboardDevice.cancelExtendedKeyEntries).toBe(false);
    expect(ulaDevice.enableUlaPlus).toBe(false);
    expect(ulaDevice.halfPixelScroll).toBe(true);
    expect(ulaDevice.enableStencilMode).toBe(false);
  });

  it("Reg $68 enableStencilMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;

    // --- Act
    writeNextReg(m, 0x68, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x68)).toBe(0x01);
    expect(ulaDevice.disableUlaOutput).toBe(false);
    expect(ulaDevice.blendingInSluMode).toBe(0x00);
    expect(m.keyboardDevice.cancelExtendedKeyEntries).toBe(false);
    expect(ulaDevice.enableUlaPlus).toBe(false);
    expect(ulaDevice.halfPixelScroll).toBe(false);
    expect(ulaDevice.enableStencilMode).toBe(true);
  });

  it("Reg $6a isRadastanMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const loResDevice = m.loResDevice;

    // --- Act
    writeNextReg(m, 0x6a, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x6a)).toBe(0x20);
    expect(loResDevice.isRadastanMode).toBe(true);
    expect(loResDevice.radastanTimexXor).toBe(false);
    expect(loResDevice.paletteOffset).toBe(0);
  });

  it("Reg $6a radastanTimexXor", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const loResDevice = m.loResDevice;

    // --- Act
    writeNextReg(m, 0x6a, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x6a)).toBe(0x10);
    expect(loResDevice.isRadastanMode).toBe(false);
    expect(loResDevice.radastanTimexXor).toBe(true);
    expect(loResDevice.paletteOffset).toBe(0);
  });

  it("Reg $6a paletteOffset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const loResDevice = m.loResDevice;

    // --- Act
    writeNextReg(m, 0x6a, 0x0a);

    // --- Assert
    expect(readNextReg(m, 0x6a)).toBe(0x0a);
    expect(loResDevice.isRadastanMode).toBe(false);
    expect(loResDevice.radastanTimexXor).toBe(false);
    expect(loResDevice.paletteOffset).toBe(0x0a);
  });

  it("Reg $6b enableTilemap", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6b, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x6b)).toBe(0x80);
    expect(tilemapDevice.enableTilemap).toBe(true);
    expect(tilemapDevice.mode80x32).toBe(false);
    expect(tilemapDevice.eliminateAttribute).toBe(false);
    expect(tilemapDevice.paletteSelect).toBe(false);
    expect(tilemapDevice.selectTextMode).toBe(false);
    expect(tilemapDevice.activate512TileMode).toBe(false);
    expect(tilemapDevice.forceTilemapOnTop).toBe(false);
  });

  it("Reg $6b mode80x32", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6b, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x6b)).toBe(0x40);
    expect(tilemapDevice.enableTilemap).toBe(false);
    expect(tilemapDevice.mode80x32).toBe(true);
    expect(tilemapDevice.eliminateAttribute).toBe(false);
    expect(tilemapDevice.paletteSelect).toBe(false);
    expect(tilemapDevice.selectTextMode).toBe(false);
    expect(tilemapDevice.activate512TileMode).toBe(false);
    expect(tilemapDevice.forceTilemapOnTop).toBe(false);
  });

  it("Reg $6b eliminateAttribute", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6b, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x6b)).toBe(0x20);
    expect(tilemapDevice.enableTilemap).toBe(false);
    expect(tilemapDevice.mode80x32).toBe(false);
    expect(tilemapDevice.eliminateAttribute).toBe(true);
    expect(tilemapDevice.paletteSelect).toBe(false);
    expect(tilemapDevice.selectTextMode).toBe(false);
    expect(tilemapDevice.activate512TileMode).toBe(false);
    expect(tilemapDevice.forceTilemapOnTop).toBe(false);
  });

  it("Reg $6b paletteSelect", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6b, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x6b)).toBe(0x10);
    expect(tilemapDevice.enableTilemap).toBe(false);
    expect(tilemapDevice.mode80x32).toBe(false);
    expect(tilemapDevice.eliminateAttribute).toBe(false);
    expect(tilemapDevice.paletteSelect).toBe(true);
    expect(tilemapDevice.selectTextMode).toBe(false);
    expect(tilemapDevice.activate512TileMode).toBe(false);
    expect(tilemapDevice.forceTilemapOnTop).toBe(false);
  });

  it("Reg $6b selectTextMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6b, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x6b)).toBe(0x08);
    expect(tilemapDevice.enableTilemap).toBe(false);
    expect(tilemapDevice.mode80x32).toBe(false);
    expect(tilemapDevice.eliminateAttribute).toBe(false);
    expect(tilemapDevice.paletteSelect).toBe(false);
    expect(tilemapDevice.selectTextMode).toBe(true);
    expect(tilemapDevice.activate512TileMode).toBe(false);
    expect(tilemapDevice.forceTilemapOnTop).toBe(false);
  });

  it("Reg $6b activate512TileMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6b, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x6b)).toBe(0x02);
    expect(tilemapDevice.enableTilemap).toBe(false);
    expect(tilemapDevice.mode80x32).toBe(false);
    expect(tilemapDevice.eliminateAttribute).toBe(false);
    expect(tilemapDevice.paletteSelect).toBe(false);
    expect(tilemapDevice.selectTextMode).toBe(false);
    expect(tilemapDevice.activate512TileMode).toBe(true);
    expect(tilemapDevice.forceTilemapOnTop).toBe(false);
  });

  it("Reg $6b forceTilemapOnTop", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6b, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x6b)).toBe(0x01);
    expect(tilemapDevice.enableTilemap).toBe(false);
    expect(tilemapDevice.mode80x32).toBe(false);
    expect(tilemapDevice.eliminateAttribute).toBe(false);
    expect(tilemapDevice.paletteSelect).toBe(false);
    expect(tilemapDevice.selectTextMode).toBe(false);
    expect(tilemapDevice.activate512TileMode).toBe(false);
    expect(tilemapDevice.forceTilemapOnTop).toBe(true);
  });

  it("Reg $6c paletteOffset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6c, 0xa0);

    // --- Assert
    expect(readNextReg(m, 0x6c)).toBe(0xa0);
    expect(tilemapDevice.paletteOffset).toBe(0x0a);
    expect(tilemapDevice.mirrorX).toBe(false);
    expect(tilemapDevice.mirrorY).toBe(false);
    expect(tilemapDevice.rotate).toBe(false);
    expect(tilemapDevice.ulaOverTilemap).toBe(false);
  });

  it("Reg $6c mirrorX", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6c, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x6c)).toBe(0x08);
    expect(tilemapDevice.paletteOffset).toBe(0x00);
    expect(tilemapDevice.mirrorX).toBe(true);
    expect(tilemapDevice.mirrorY).toBe(false);
    expect(tilemapDevice.rotate).toBe(false);
    expect(tilemapDevice.ulaOverTilemap).toBe(false);
  });

  it("Reg $6c mirrorY", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6c, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x6c)).toBe(0x04);
    expect(tilemapDevice.paletteOffset).toBe(0x00);
    expect(tilemapDevice.mirrorX).toBe(false);
    expect(tilemapDevice.mirrorY).toBe(true);
    expect(tilemapDevice.rotate).toBe(false);
    expect(tilemapDevice.ulaOverTilemap).toBe(false);
  });

  it("Reg $6c rotate", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6c, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x6c)).toBe(0x02);
    expect(tilemapDevice.paletteOffset).toBe(0x00);
    expect(tilemapDevice.mirrorX).toBe(false);
    expect(tilemapDevice.mirrorY).toBe(false);
    expect(tilemapDevice.rotate).toBe(true);
    expect(tilemapDevice.ulaOverTilemap).toBe(false);
  });

  it("Reg $6c ulaOverTilemap", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6c, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x6c)).toBe(0x01);
    expect(tilemapDevice.paletteOffset).toBe(0x00);
    expect(tilemapDevice.mirrorX).toBe(false);
    expect(tilemapDevice.mirrorY).toBe(false);
    expect(tilemapDevice.rotate).toBe(false);
    expect(tilemapDevice.ulaOverTilemap).toBe(true);
  });

  it("Reg $6e baseAddressUseBank7", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6e, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x6e)).toBe(0x80);
    expect(tilemapDevice.baseAddressUseBank7).toBe(true);
    expect(tilemapDevice.baseAddressMsb).toBe(0);
  });

  it("Reg $6e baseAddressMsb", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6e, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x6e)).toBe(0x02);
    expect(tilemapDevice.baseAddressUseBank7).toBe(false);
    expect(tilemapDevice.baseAddressMsb).toBe(0x02);
  });

  it("Reg $6f definitionAddressUseBank7", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6f, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x6f)).toBe(0x80);
    expect(tilemapDevice.definitionAddressUseBank7).toBe(true);
    expect(tilemapDevice.definitionAddressMsb).toBe(0);
  });

  it("Reg $6f definitionAddressMsb", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const tilemapDevice = m.tilemapDevice;

    // --- Act
    writeNextReg(m, 0x6f, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x6f)).toBe(0x02);
    expect(tilemapDevice.definitionAddressUseBank7).toBe(false);
    expect(tilemapDevice.definitionAddressMsb).toBe(0x02);
  });

  it("Reg $70 resolution #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x70, 0x20);

    // --- Assert
    expect(layer2Device.resolution).toBe(Layer2Resolution.R640x256x4);
  });

  it("Reg $70 resolution #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x70, 0xa0);

    // --- Assert
    expect(layer2Device.resolution).toBe(Layer2Resolution.R640x256x4);
  });

  it("Reg $70 paletteOffset #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x70, 0x2a);

    // --- Assert
    expect(layer2Device.paletteOffset).toBe(0x0a);
  });

  it("Reg $70 paletteOffset #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x70, 0xca);

    // --- Assert
    expect(layer2Device.paletteOffset).toBe(0x0a);
  });

  it("Reg $71 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x71, 0x01);

    // --- Assert
    expect(layer2Device.scrollX).toBe(0x100);
  });

  it("Reg $71 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x71, 0xb3);

    // --- Assert
    expect(layer2Device.scrollX).toBe(0x100);
  });

  it("Reg $71 write #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const layer2Device = m.layer2Device;

    // --- Act
    writeNextReg(m, 0x71, 0xbe);

    // --- Assert
    expect(layer2Device.scrollX).toBe(0x00);
  });

  it("Reg $7f write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x7f, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x7f)).toBe(0xa5);
    expect(m.nextRegDevice.userRegister0).toBe(0xa5);
  });

  it("Reg $80 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x80, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x80)).toBe(0xa5);
  });

  it("Reg $81 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x81, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x81)).toBe(0xa3);
  });

  it("Reg $81 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x81, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x81)).toBe(0xf3);
  });

  it("Reg $82 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x82, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0xa5);
  });

  it("Reg $83 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x83, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0xa5);
  });

  it("Reg $84 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x84, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0xa3);
  });

  it("Reg $85 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x85, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x8f);
  });

  it("Reg $86 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x86, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x86)).toBe(0xa3);
  });

  it("Reg $87 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x87, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x87)).toBe(0xa3);
  });

  it("Reg $88 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x88, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x88)).toBe(0xa3);
  });

  it("Reg $89 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x89, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x89)).toBe(0x8f);
  });

  it("Reg $8a write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x8a, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x8a)).toBe(0xa3);
  });

  it("Reg $8f write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x8f, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x8f)).toBe(0x03);
    expect(m.memoryDevice.mappingMode).toBe(0x03);
  });

  it("Reg $90 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x90, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x90)).toBe(0xa5);
  });

  it("Reg $91 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x91, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x91)).toBe(0xa5);
  });

  it("Reg $92 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x92, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x92)).toBe(0xa5);
  });

  it("Reg $93 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x93, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x93)).toBe(0x0f);
  });

  it("Reg $98 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x98, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x98)).toBe(0xa5);
  });

  it("Reg $99 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x99, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x99)).toBe(0xa5);
  });

  it("Reg $9a write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x9a, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x9a)).toBe(0xa5);
  });

  it("Reg $9b write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x9b, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x9b)).toBe(0x0f);
  });

  it("Reg $a0 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa0, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0xa0)).toBe(0xa5);
  });

  it("Reg $a2 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa2, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xa2)).toBe(0xdf);
  });

  it("Reg $a2 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa2, 0x00);

    // --- Assert
    expect(readNextReg(m, 0xa2)).toBe(0x02);
  });

  it("Reg $a8 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa8, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xa8)).toBe(0x01);
  });

  it("Reg $a9 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa9, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xa9)).toBe(0x05);
  });

  it("Reg $b8 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const div = m.divMmcDevice;

    // --- Act
    writeNextReg(m, 0xb8, 0x55);

    // --- Assert
    expect(readNextReg(m, 0xb8)).toBe(0x55);
    expect(div.rstTraps[7].enabled).toBe(false);
    expect(div.rstTraps[6].enabled).toBe(true);
    expect(div.rstTraps[5].enabled).toBe(false);
    expect(div.rstTraps[4].enabled).toBe(true);
    expect(div.rstTraps[3].enabled).toBe(false);
    expect(div.rstTraps[2].enabled).toBe(true);
    expect(div.rstTraps[1].enabled).toBe(false);
    expect(div.rstTraps[0].enabled).toBe(true);
  });

  it("Reg $b9 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const div = m.divMmcDevice;

    // --- Act
    writeNextReg(m, 0xb9, 0xaa);

    // --- Assert
    expect(readNextReg(m, 0xb9)).toBe(0xaa);
    expect(div.rstTraps[7].onlyWithRom3).toBe(true);
    expect(div.rstTraps[6].onlyWithRom3).toBe(false);
    expect(div.rstTraps[5].onlyWithRom3).toBe(true);
    expect(div.rstTraps[4].onlyWithRom3).toBe(false);
    expect(div.rstTraps[3].onlyWithRom3).toBe(true);
    expect(div.rstTraps[2].onlyWithRom3).toBe(false);
    expect(div.rstTraps[1].onlyWithRom3).toBe(true);
    expect(div.rstTraps[0].onlyWithRom3).toBe(false);
  });

  it("Reg $ba write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const div = m.divMmcDevice;

    // --- Act
    writeNextReg(m, 0xba, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xba)).toBe(0x5a);
    expect(div.rstTraps[7].instantMapping).toBe(false);
    expect(div.rstTraps[6].instantMapping).toBe(true);
    expect(div.rstTraps[5].instantMapping).toBe(false);
    expect(div.rstTraps[4].instantMapping).toBe(true);
    expect(div.rstTraps[3].instantMapping).toBe(true);
    expect(div.rstTraps[2].instantMapping).toBe(false);
    expect(div.rstTraps[1].instantMapping).toBe(true);
    expect(div.rstTraps[0].instantMapping).toBe(false);
  });

  it("Reg $bb write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const div = m.divMmcDevice;

    // --- Act
    writeNextReg(m, 0xbb, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xbb)).toBe(0x5a);
    expect(div.automapOn3dxx).toBe(false);
    expect(div.disableAutomapOn1ff8).toBe(true);
    expect(div.automapOn056a).toBe(false);
    expect(div.automapOn04d7).toBe(true);
    expect(div.automapOn0562).toBe(true);
    expect(div.automapOn04c6).toBe(false);
    expect(div.automapOn0066).toBe(true);
    expect(div.automapOn0066Delayed).toBe(false);
  });

  it("Reg $c0 im2TopBits", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc0, 0xe0);

    // --- Assert
    expect(readNextReg(m, 0xc0)).toBe(0xe0);
    expect(intDevice.im2TopBits).toBe(0xe0);
    expect(intDevice.enableStacklessNmi).toBe(false);
    expect(intDevice.hwIm2Mode).toBe(false);
  });

  it("Reg $c0 enableStacklessNmi", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc0, 0x08);

    // --- Assert
    expect(readNextReg(m, 0xc0)).toBe(0x08);
    expect(intDevice.im2TopBits).toBe(0x00);
    expect(intDevice.enableStacklessNmi).toBe(true);
    expect(intDevice.hwIm2Mode).toBe(false);
  });

  it("Reg $c0 hwIm22Mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);

    // --- Assert
    expect(readNextReg(m, 0xc0)).toBe(0x01);
    expect(intDevice.im2TopBits).toBe(0x00);
    expect(intDevice.enableStacklessNmi).toBe(false);
    expect(intDevice.hwIm2Mode).toBe(true);
  });

  it("Reg $c0 currentInterruptMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    m.interruptMode = 0x01;

    // --- Act
    m.interruptMode = 0x01;

    // --- Assert
    expect(readNextReg(m, 0xc0)).toBe(0x02);
    expect(intDevice.currentInterruptMode).toBe(0x01);
  });

  it("Reg $c2 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc2, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0xc2)).toBe(0xa5);
  });

  it("Reg $c3 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc3, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0xc3)).toBe(0xa5);
  });

  it("Reg $c4 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc4, 0x80);

    // --- Assert
    expect(readNextReg(m, 0xc4)).toBe(0x80);
    expect(intDevice.ulaInterruptDisabled).toBe(true);
    expect(intDevice.lineInterruptEnabled).toBe(false);
  });

  it("Reg $c4 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc4, 0x81);

    // --- Assert
    expect(readNextReg(m, 0xc4)).toBe(0x81);
    expect(intDevice.ulaInterruptDisabled).toBe(false);
    expect(intDevice.lineInterruptEnabled).toBe(false);
  });

  it("Reg $c4 write #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc4, 0x02);

    // --- Assert
    expect(readNextReg(m, 0xc4)).toBe(0x02);
    expect(intDevice.ulaInterruptDisabled).toBe(true);
    expect(intDevice.lineInterruptEnabled).toBe(true);
  });

  it("Reg $c4 write #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc4, 0x03);

    // --- Assert
    expect(readNextReg(m, 0xc4)).toBe(0x03);
    expect(intDevice.ulaInterruptDisabled).toBe(false);
    expect(intDevice.lineInterruptEnabled).toBe(true);
  });

  it("Reg $c5 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc5, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0xc5)).toBe(0xa5);
    expect(intDevice.ctcIntEnabled[7]).toBe(true);
    expect(intDevice.ctcIntEnabled[6]).toBe(false);
    expect(intDevice.ctcIntEnabled[5]).toBe(true);
    expect(intDevice.ctcIntEnabled[4]).toBe(false);
    expect(intDevice.ctcIntEnabled[3]).toBe(false);
    expect(intDevice.ctcIntEnabled[2]).toBe(true);
    expect(intDevice.ctcIntEnabled[1]).toBe(false);
    expect(intDevice.ctcIntEnabled[0]).toBe(true);
  });

  it("Reg $c6 uart1TxEmpty", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x40);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x40);
    expect(intDevice.uart1TxEmpty).toBe(true);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart1TxNearFull", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x20);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x20);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(true);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart1TxAvailable", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x10);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x10);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(true);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart0RxEmpty", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x04);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x04);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(true);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart0RxNearFull", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x02);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x02);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(true);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart0RxAvailable", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x01);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x01);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(true);
  });

  it("Reg $c8 lineInterruptStatus", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.lineInterruptStatus = true;

    // --- Act
    writeNextReg(m, 0xc8, 0x01);

    // --- Assert
    expect(intDevice.lineInterruptStatus).toBe(true);
    expect(intDevice.ulaInterruptStatus).toBe(false);
  });

  it("Reg $c8 ulaInterruptStatus", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ulaInterruptStatus = true;

    // --- Act
    writeNextReg(m, 0xc8, 0x02);

    // --- Assert
    expect(intDevice.lineInterruptStatus).toBe(false);
    expect(intDevice.ulaInterruptStatus).toBe(true);
  });

  it("Reg $c8 lineInterruptStatus - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.lineInterruptStatus = true;

    // --- Act
    writeNextReg(m, 0xc8, 0x02);

    // --- Assert
    expect(intDevice.lineInterruptStatus).toBe(false);
  });

  it("Reg $c8 lineInterruptStatus - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.lineInterruptStatus = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc8, 0x02);

    // --- Assert
    expect(intDevice.lineInterruptStatus).toBe(true);
  });

  it("Reg $c8 ulaInterruptStatus - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ulaInterruptStatus = true;

    // --- Act
    writeNextReg(m, 0xc8, 0x01);

    // --- Assert
    expect(intDevice.ulaInterruptStatus).toBe(false);
  });

  it("Reg $c8 ulaInterruptStatus - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ulaInterruptStatus = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc8, 0x01);

    // --- Assert
    expect(intDevice.ulaInterruptStatus).toBe(true);
  });

  it("Reg $c9 ctcChannelInterruptStatus 0 - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[0] = true;

    // --- Act
    writeNextReg(m, 0xc9, 0x01);

    // --- Assert
    expect(intDevice.ctcIntStatus[0]).toBe(false);
  });

  it("Reg $c9 ctcChannelInterruptStatus 0 - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[0] = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc9, 0x01);

    // --- Assert
    expect(intDevice.ctcIntStatus[0]).toBe(true);
  });

  it("Reg $c9 ctcChannelInterruptStatus 1 - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[1] = true;

    // --- Act
    writeNextReg(m, 0xc9, 0x02);

    // --- Assert
    expect(intDevice.ctcIntStatus[1]).toBe(false);
  });

  it("Reg $c9 ctcChannelInterruptStatus 1 - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[1] = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc9, 0x02);

    // --- Assert
    expect(intDevice.ctcIntStatus[1]).toBe(true);
  });

  it("Reg $c9 ctcChannelInterruptStatus 2 - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[2] = true;

    // --- Act
    writeNextReg(m, 0xc9, 0x04);

    // --- Assert
    expect(intDevice.ctcIntStatus[2]).toBe(false);
  });

  it("Reg $c9 ctcChannelInterruptStatus 2 - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[2] = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc9, 0x04);

    // --- Assert
    expect(intDevice.ctcIntStatus[2]).toBe(true);
  });

  it("Reg $c9 ctcChannelInterruptStatus 3 - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[3] = true;

    // --- Act
    writeNextReg(m, 0xc9, 0x08);

    // --- Assert
    expect(intDevice.ctcIntStatus[3]).toBe(false);
  });

  it("Reg $c9 ctcChannelInterruptStatus 3 - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[3] = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc9, 0x08);

    // --- Assert
    expect(intDevice.ctcIntStatus[3]).toBe(true);
  });

  it("Reg $c9 ctcChannelInterruptStatus 4 - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[4] = true;

    // --- Act
    writeNextReg(m, 0xc9, 0x10);

    // --- Assert
    expect(intDevice.ctcIntStatus[4]).toBe(false);
  });

  it("Reg $c9 ctcChannelInterruptStatus 4 - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[4] = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc9, 0x10);

    // --- Assert
    expect(intDevice.ctcIntStatus[4]).toBe(true);
  });

  it("Reg $c9 ctcChannelInterruptStatus 5 - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[5] = true;

    // --- Act
    writeNextReg(m, 0xc9, 0x20);

    // --- Assert
    expect(intDevice.ctcIntStatus[5]).toBe(false);
  });

  it("Reg $c9 ctcChannelInterruptStatus 5 - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[5] = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc9, 0x20);

    // --- Assert
    expect(intDevice.ctcIntStatus[5]).toBe(true);
  });

  it("Reg $c9 ctcChannelInterruptStatus 6 - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[6] = true;

    // --- Act
    writeNextReg(m, 0xc9, 0x40);

    // --- Assert
    expect(intDevice.ctcIntStatus[6]).toBe(false);
  });

  it("Reg $c9 ctcChannelInterruptStatus 6 - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.ctcIntStatus[6] = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xc9, 0x40);

    // --- Assert
    expect(intDevice.ctcIntStatus[6]).toBe(true);
  });

  it("Reg $ca uart1TxEmptyStatus - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart1TxEmptyStatus = true;

    // --- Act
    writeNextReg(m, 0xca, 0x40);

    // --- Assert
    expect(intDevice.uart1TxEmptyStatus).toBe(false);
  });

  it("Reg $ca uart1TxEmptyStatus - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart1TxEmptyStatus = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xca, 0x40);

    // --- Assert
    expect(intDevice.uart1TxEmptyStatus).toBe(true);
  });

  it("Reg $ca uart1RxNearFullStatus - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart1RxNearFullStatus = true;

    // --- Act
    writeNextReg(m, 0xca, 0x20);

    // --- Assert
    expect(intDevice.uart1RxNearFullStatus).toBe(false);
  });

  it("Reg $ca uart1RxNearFullStatus - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart1RxNearFullStatus = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xca, 0x20);

    // --- Assert
    expect(intDevice.uart1RxNearFullStatus).toBe(true);
  });

  it("Reg $ca uart1RxAvailableStatus - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart1RxAvailableStatus = true;

    // --- Act
    writeNextReg(m, 0xca, 0x10);

    // --- Assert
    expect(intDevice.uart1RxAvailableStatus).toBe(false);
  });

  it("Reg $ca uart1RxAvailableStatus - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart1RxAvailableStatus = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xca, 0x10);

    // --- Assert
    expect(intDevice.uart1RxAvailableStatus).toBe(true);
  });

  it("Reg $ca uart0TxEmptyStatus - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart0TxEmptyStatus = true;

    // --- Act
    writeNextReg(m, 0xca, 0x04);

    // --- Assert
    expect(intDevice.uart0TxEmptyStatus).toBe(false);
  });

  it("Reg $ca uart0TxEmptyStatus - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart0TxEmptyStatus = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xca, 0x04);

    // --- Assert
    expect(intDevice.uart0TxEmptyStatus).toBe(true);
  });

  it("Reg $ca uart0RxNearFullStatus - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart0RxNearFullStatus = true;

    // --- Act
    writeNextReg(m, 0xca, 0x02);

    // --- Assert
    expect(intDevice.uart0RxNearFullStatus).toBe(false);
  });

  it("Reg $ca uart0RxNearFullStatus - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart0RxNearFullStatus = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xca, 0x02);

    // --- Assert
    expect(intDevice.uart0RxNearFullStatus).toBe(true);
  });

  it("Reg $ca uart0RxAvailableStatus - clear", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart0RxAvailableStatus = true;

    // --- Act
    writeNextReg(m, 0xca, 0x01);

    // --- Assert
    expect(intDevice.uart0RxAvailableStatus).toBe(false);
  });

  it("Reg $ca uart0RxAvailableStatus - no clear with HW IM2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    intDevice.uart0RxAvailableStatus = true;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);
    writeNextReg(m, 0xca, 0x01);

    // --- Assert
    expect(intDevice.uart0RxAvailableStatus).toBe(true);
  });

  it("Reg $cc enableNmiToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcc, 0x80);

    // --- Assert
    expect(intDevice.enableNmiToIntDma).toBe(true);
    expect(intDevice.enableLineIntToIntDma).toBe(false);
    expect(intDevice.enableUlaIntToIntDma).toBe(false);
  });

  it("Reg $cc enableLineIntToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcc, 0x02);

    // --- Assert
    expect(intDevice.enableNmiToIntDma).toBe(false);
    expect(intDevice.enableLineIntToIntDma).toBe(true);
    expect(intDevice.enableUlaIntToIntDma).toBe(false);
  });

  it("Reg $cc enableUlaIntToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcc, 0x01);

    // --- Assert
    expect(intDevice.enableNmiToIntDma).toBe(false);
    expect(intDevice.enableLineIntToIntDma).toBe(false);
    expect(intDevice.enableUlaIntToIntDma).toBe(true);
  });

  it("Reg $cd enableCtcToIntDma 0", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcd, 0x01);

    // --- Assert
    expect(intDevice.enableCtcToIntDma[0]).toBe(true);
    expect(intDevice.enableCtcToIntDma[1]).toBe(false);
    expect(intDevice.enableCtcToIntDma[2]).toBe(false);
    expect(intDevice.enableCtcToIntDma[3]).toBe(false);
    expect(intDevice.enableCtcToIntDma[4]).toBe(false);
    expect(intDevice.enableCtcToIntDma[5]).toBe(false);
    expect(intDevice.enableCtcToIntDma[6]).toBe(false);
    expect(intDevice.enableCtcToIntDma[7]).toBe(false);
  });

  it("Reg $cd enableCtcToIntDma 1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcd, 0x02);

    // --- Assert
    expect(intDevice.enableCtcToIntDma[0]).toBe(false);
    expect(intDevice.enableCtcToIntDma[1]).toBe(true);
    expect(intDevice.enableCtcToIntDma[2]).toBe(false);
    expect(intDevice.enableCtcToIntDma[3]).toBe(false);
    expect(intDevice.enableCtcToIntDma[4]).toBe(false);
    expect(intDevice.enableCtcToIntDma[5]).toBe(false);
    expect(intDevice.enableCtcToIntDma[6]).toBe(false);
    expect(intDevice.enableCtcToIntDma[7]).toBe(false);
  });

  it("Reg $cd enableCtcToIntDma 2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcd, 0x04);

    // --- Assert
    expect(intDevice.enableCtcToIntDma[0]).toBe(false);
    expect(intDevice.enableCtcToIntDma[1]).toBe(false);
    expect(intDevice.enableCtcToIntDma[2]).toBe(true);
    expect(intDevice.enableCtcToIntDma[3]).toBe(false);
    expect(intDevice.enableCtcToIntDma[4]).toBe(false);
    expect(intDevice.enableCtcToIntDma[5]).toBe(false);
    expect(intDevice.enableCtcToIntDma[6]).toBe(false);
    expect(intDevice.enableCtcToIntDma[7]).toBe(false);
  });

  it("Reg $cd enableCtcToIntDma 3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcd, 0x08);

    // --- Assert
    expect(intDevice.enableCtcToIntDma[0]).toBe(false);
    expect(intDevice.enableCtcToIntDma[1]).toBe(false);
    expect(intDevice.enableCtcToIntDma[2]).toBe(false);
    expect(intDevice.enableCtcToIntDma[3]).toBe(true);
    expect(intDevice.enableCtcToIntDma[4]).toBe(false);
    expect(intDevice.enableCtcToIntDma[5]).toBe(false);
    expect(intDevice.enableCtcToIntDma[6]).toBe(false);
    expect(intDevice.enableCtcToIntDma[7]).toBe(false);
  });

  it("Reg $cd enableCtcToIntDma 4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcd, 0x10);

    // --- Assert
    expect(intDevice.enableCtcToIntDma[0]).toBe(false);
    expect(intDevice.enableCtcToIntDma[1]).toBe(false);
    expect(intDevice.enableCtcToIntDma[2]).toBe(false);
    expect(intDevice.enableCtcToIntDma[3]).toBe(false);
    expect(intDevice.enableCtcToIntDma[4]).toBe(true);
    expect(intDevice.enableCtcToIntDma[5]).toBe(false);
    expect(intDevice.enableCtcToIntDma[6]).toBe(false);
    expect(intDevice.enableCtcToIntDma[7]).toBe(false);
  });

  it("Reg $cd enableCtcToIntDma 5", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcd, 0x20);

    // --- Assert
    expect(intDevice.enableCtcToIntDma[0]).toBe(false);
    expect(intDevice.enableCtcToIntDma[1]).toBe(false);
    expect(intDevice.enableCtcToIntDma[2]).toBe(false);
    expect(intDevice.enableCtcToIntDma[3]).toBe(false);
    expect(intDevice.enableCtcToIntDma[4]).toBe(false);
    expect(intDevice.enableCtcToIntDma[5]).toBe(true);
    expect(intDevice.enableCtcToIntDma[6]).toBe(false);
    expect(intDevice.enableCtcToIntDma[7]).toBe(false);
  });

  it("Reg $cd enableCtcToIntDma 6", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcd, 0x40);

    // --- Assert
    expect(intDevice.enableCtcToIntDma[0]).toBe(false);
    expect(intDevice.enableCtcToIntDma[1]).toBe(false);
    expect(intDevice.enableCtcToIntDma[2]).toBe(false);
    expect(intDevice.enableCtcToIntDma[3]).toBe(false);
    expect(intDevice.enableCtcToIntDma[4]).toBe(false);
    expect(intDevice.enableCtcToIntDma[5]).toBe(false);
    expect(intDevice.enableCtcToIntDma[6]).toBe(true);
    expect(intDevice.enableCtcToIntDma[7]).toBe(false);
  });

  it("Reg $cd enableCtcToIntDma 7", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xcd, 0x80);

    // --- Assert
    expect(intDevice.enableCtcToIntDma[0]).toBe(false);
    expect(intDevice.enableCtcToIntDma[1]).toBe(false);
    expect(intDevice.enableCtcToIntDma[2]).toBe(false);
    expect(intDevice.enableCtcToIntDma[3]).toBe(false);
    expect(intDevice.enableCtcToIntDma[4]).toBe(false);
    expect(intDevice.enableCtcToIntDma[5]).toBe(false);
    expect(intDevice.enableCtcToIntDma[6]).toBe(false);
    expect(intDevice.enableCtcToIntDma[7]).toBe(true);
  });

  it("Reg $ce enableUart1EmptyToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xce, 0x40);

    // --- Assert
    expect(intDevice.enableUart1TxEmptyToIntDma).toBe(true);
    expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
    expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
  });

  it("Reg $ce enableUart1RxNearFullToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xce, 0x20);

    // --- Assert
    expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart1RxNearFullToIntDma).toBe(true);
    expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
    expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
  });

  it("Reg $ce enableUart1RxAvailableToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xce, 0x10);

    // --- Assert
    expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart1RxAvailableToIntDma).toBe(true);
    expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
  });

  it("Reg $ce enableUart0TxEmptyToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xce, 0x04);

    // --- Assert
    expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
    expect(intDevice.enableUart0TxEmptyToIntDma).toBe(true);
    expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
  });

  it("Reg $ce enableUart0RxNearFullToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xce, 0x02);

    // --- Assert
    expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
    expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart0RxNearFullToIntDma).toBe(true);
    expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
  });

  it("Reg $ce enableUart0RxAvailableToIntDma", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xce, 0x01);

    // --- Assert
    expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
    expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
    expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
    expect(intDevice.enableUart0RxAvailableToIntDma).toBe(true);
  });

  it("Reg $d8 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xd8, 0x00);

    // --- Assert
    expect(readNextReg(m, 0xd8)).toBe(0x00);
    expect(m.nextRegDevice.fdcIoTrap).toBe(false);
  });

  it("Reg $d8 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xd8, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xd8)).toBe(0x01);
    expect(m.nextRegDevice.fdcIoTrap).toBe(true);
  });

  it("Reg $d9 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xd9, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xd9)).toBe(0xff);
  });

  it("Reg $f0 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xf0, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xf0)).toBe(0x5a);
  });

  it("Reg $f8 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xf8, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xf8)).toBe(0x5a);
  });

  it("Reg $f9 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xf9, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xf9)).toBe(0x5a);
  });

  it("Reg $fa write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xfa, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xfa)).toBe(0x5a);
  });
});

function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(m: IZxNextMachine, reg: number): number {
  m.nextRegDevice.setNextRegisterIndex(reg);
  return m.nextRegDevice.getNextRegisterValue();
}
